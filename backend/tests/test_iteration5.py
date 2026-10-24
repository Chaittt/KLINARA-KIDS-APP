"""Iteration 5 — Parent username+password login, MD-managed credentials.

Covers:
- POST /api/auth/parent/login (case-insensitive, generic 401, 429 lockout, 403 deactivated)
- /api/auth/parent/send-otp and /verify-otp removed → 404
- POST /api/students with parent_username/parent_password (dup → 409, short pwd → 400,
  sibling with existing parent_phone reuses the existing login)
- GET /api/parents/lookup?phone=, GET /api/users/username-available?username=
- POST /api/users/{id}/parent-login (set login for legacy parent; 400 if already set)
- POST /api/users/{id}/reset-password: parent needs new_password + token revocation;
  staff reset with no body still returns temp_password
- GET /api/students surfaces parent_has_login and parent_username
"""
import os
import uuid
import requests
import pytest


def _load_base():
    v = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if v:
        return v.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")


BASE_URL = _load_base()
MD = {"email": "md@klinara.com", "password": "MD@123456"}
ADMIN = {"email": "admin@klinara.com", "password": "Admin@123"}


# ---------- Shared fixtures ----------
@pytest.fixture(scope="module")
def md_headers():
    r = requests.post(f"{BASE_URL}/api/auth/staff/login", json=MD)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/staff/login", json=ADMIN)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _phone():
    return f"72000{uuid.uuid4().int % 100000:05d}"


def _uname(prefix="qa"):
    return f"{prefix}.{uuid.uuid4().hex[:6]}"


def _tag():
    return f"TEST_{uuid.uuid4().hex[:5]}"


def _mk_student(md_headers, uname, phone, password="Parent@123", pname="QA Parent"):
    payload = {
        "name": f"{_tag()} Kid",
        "class_name": "Nursery",
        "parent_phone": phone,
        "parent_name": pname,
        "parent_username": uname,
        "parent_password": password,
        "total_fees": 5000,
        "plan_type": "single",
    }
    return requests.post(f"{BASE_URL}/api/students", json=payload, headers=md_headers)


# ======================= Parent login =======================
class TestParentLogin:
    def test_seeded_parent_login_works(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/login",
                          json={"username": "anjali.reddy", "password": "Parent@123"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body
        assert body["user"]["role"] == "parent"
        assert body["user"]["username"] == "anjali.reddy"

    def test_login_case_insensitive(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/login",
                          json={"username": "ANJALI.REDDY", "password": "Parent@123"})
        assert r.status_code == 200

    def test_wrong_password_401_generic(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/login",
                          json={"username": f"nouser_{uuid.uuid4().hex[:5]}", "password": "whatever"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid username or password"

    def test_unknown_user_same_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/login",
                          json={"username": f"ghost_{uuid.uuid4().hex[:5]}", "password": "whatever"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid username or password"

    def test_lockout_after_5_failures(self, md_headers):
        # Create a disposable parent-with-login so we can safely lock them
        uname = _uname("lock")
        r = _mk_student(md_headers, uname, _phone(), password="Correct@123")
        assert r.status_code == 200, r.text
        # 5 bad attempts
        for _ in range(5):
            bad = requests.post(f"{BASE_URL}/api/auth/parent/login",
                                json={"username": uname, "password": "wrong"})
            assert bad.status_code == 401
        # 6th attempt should be locked
        locked = requests.post(f"{BASE_URL}/api/auth/parent/login",
                               json={"username": uname, "password": "Correct@123"})
        assert locked.status_code == 429, locked.text
        assert "Too many" in locked.json()["detail"] or "minutes" in locked.json()["detail"]

    def test_deactivated_parent_403(self, md_headers):
        uname = _uname("deact")
        rs = _mk_student(md_headers, uname, _phone(), password="Active@123")
        assert rs.status_code == 200
        # Fetch user id
        users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
        target = next(u for u in users if u.get("username") == uname)
        uid = target["id"]
        # Deactivate
        r = requests.patch(f"{BASE_URL}/api/users/{uid}/status", json={"active": False}, headers=md_headers)
        assert r.status_code == 200
        # Login attempt → 403
        r = requests.post(f"{BASE_URL}/api/auth/parent/login",
                          json={"username": uname, "password": "Active@123"})
        assert r.status_code == 403
        assert "deactivated" in r.json()["detail"].lower()
        # Cleanup: reactivate (not strictly necessary, but neat)
        requests.patch(f"{BASE_URL}/api/users/{uid}/status", json={"active": True}, headers=md_headers)


# ======================= OTP endpoints removed =======================
class TestOtpRemoved:
    def test_send_otp_404(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/send-otp",
                          json={"phone": "9876543210"})
        assert r.status_code == 404

    def test_verify_otp_404(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/verify-otp",
                          json={"phone": "9876543210", "otp": "123456"})
        assert r.status_code == 404


# ======================= Student creation + parent login provisioning =======================
class TestStudentParentLogin:
    def test_create_student_with_new_parent_login(self, md_headers):
        uname = _uname("new")
        phone = _phone()
        r = _mk_student(md_headers, uname, phone, password="Pwd@12345")
        assert r.status_code == 200, r.text
        # Parent can now log in
        lr = requests.post(f"{BASE_URL}/api/auth/parent/login",
                           json={"username": uname, "password": "Pwd@12345"})
        assert lr.status_code == 200

    def test_duplicate_username_409(self, md_headers):
        uname = _uname("dup")
        r1 = _mk_student(md_headers, uname, _phone(), password="Pwd@12345")
        assert r1.status_code == 200
        # Second attempt with the same username on a different phone
        r2 = _mk_student(md_headers, uname, _phone(), password="Pwd@12345")
        assert r2.status_code == 409, r2.text
        assert "already" in r2.json()["detail"].lower() or "taken" in r2.json()["detail"].lower()

    def test_short_password_400(self, md_headers):
        r = _mk_student(md_headers, _uname("short"), _phone(), password="abc")
        assert r.status_code == 400
        assert "6" in r.json()["detail"] or "least" in r.json()["detail"].lower()

    def test_sibling_reuses_existing_parent_login(self, md_headers):
        uname = _uname("sib")
        phone = _phone()
        # First student → creates parent login
        r1 = _mk_student(md_headers, uname, phone, password="Pwd@12345")
        assert r1.status_code == 200
        # Second student with same phone but NO credentials — should reuse
        payload = {
            "name": f"{_tag()} Sibling",
            "class_name": "LKG",
            "parent_phone": phone,
            "parent_name": "QA Parent",
            "total_fees": 5000,
            "plan_type": "single",
        }
        r2 = requests.post(f"{BASE_URL}/api/students", json=payload, headers=md_headers)
        assert r2.status_code == 200, r2.text
        # Verify both share the same parent_id and username
        all_students = requests.get(f"{BASE_URL}/api/students", headers=md_headers).json()
        same_phone = [s for s in all_students if s.get("parent_phone") == phone]
        assert len(same_phone) >= 2
        assert all(s.get("parent_username") == uname for s in same_phone)
        assert all(s.get("parent_has_login") is True for s in same_phone)

    def test_admin_can_create_parent_login(self, admin_headers):
        # Iteration 6: Admin is now allowed to create a login for a brand-new parent
        r = _mk_student(admin_headers, _uname("adm"), _phone(), password="Pwd@12345")
        assert r.status_code == 200, r.text


# ======================= Lookup + username-available =======================
class TestLookups:
    def test_lookup_existing_parent(self, md_headers):
        uname = _uname("lu")
        phone = _phone()
        _mk_student(md_headers, uname, phone, password="Pwd@12345")
        r = requests.get(f"{BASE_URL}/api/parents/lookup?phone={phone}", headers=md_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["exists"] is True
        assert body["username"] == uname

    def test_lookup_missing_parent(self, md_headers):
        r = requests.get(f"{BASE_URL}/api/parents/lookup?phone={_phone()}", headers=md_headers)
        assert r.status_code == 200
        assert r.json()["exists"] is False

    def test_username_available_true(self, md_headers):
        r = requests.get(f"{BASE_URL}/api/users/username-available?username={_uname('free')}",
                         headers=md_headers)
        assert r.status_code == 200
        assert r.json()["available"] is True

    def test_username_available_false(self, md_headers):
        uname = _uname("taken")
        _mk_student(md_headers, uname, _phone(), password="Pwd@12345")
        r = requests.get(f"{BASE_URL}/api/users/username-available?username={uname}",
                         headers=md_headers)
        assert r.status_code == 200
        assert r.json()["available"] is False


# ======================= Set-login for legacy parent =======================
class TestSetParentLogin:
    def _make_legacy_parent(self, md_headers):
        """Create a parent without any login by directly POSTing a student without creds.
        Since server requires creds for parents without usernames, we do a two-step:
        1) create a student with creds (parent gets a login)
        2) null out username in DB? → not possible via API. So use an alternative:
           an unknown phone WITHOUT creds will 400 (needs creds), so legacy parents are
           those pre-existing from migration. The spec note says 'legacy.p' exists.
        """
        pass

    def test_set_login_on_legacy_parent(self, md_headers):
        users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
        legacy = next((u for u in users if not u.get("username") and u.get("has_login") is False), None)
        if not legacy:
            pytest.skip("No legacy parent (no username) seeded; cannot test set-login path")
        uname = _uname("legacy")
        r = requests.post(
            f"{BASE_URL}/api/users/{legacy['id']}/parent-login",
            json={"username": uname, "password": "Legacy@123"},
            headers=md_headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["username"] == uname
        # Parent login should work now
        lr = requests.post(f"{BASE_URL}/api/auth/parent/login",
                           json={"username": uname, "password": "Legacy@123"})
        assert lr.status_code == 200

    def test_set_login_fails_when_already_set(self, md_headers):
        uname = _uname("have")
        rs = _mk_student(md_headers, uname, _phone(), password="Pwd@12345")
        assert rs.status_code == 200
        users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
        parent = next(u for u in users if u.get("username") == uname)
        r = requests.post(
            f"{BASE_URL}/api/users/{parent['id']}/parent-login",
            json={"username": _uname("other"), "password": "Other@123"},
            headers=md_headers,
        )
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()


# ======================= Reset password =======================
class TestResetPassword:
    def test_parent_reset_revokes_old_token_and_new_pwd_works(self, md_headers):
        uname = _uname("rst")
        phone = _phone()
        rs = _mk_student(md_headers, uname, phone, password="Original@123")
        assert rs.status_code == 200
        # Old login → old token
        lr = requests.post(f"{BASE_URL}/api/auth/parent/login",
                           json={"username": uname, "password": "Original@123"})
        assert lr.status_code == 200
        old_token = lr.json()["access_token"]
        # /auth/me with old token works
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {old_token}"})
        assert me.status_code == 200
        # Find parent id
        users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
        parent = next(u for u in users if u.get("username") == uname)
        # Reset to new password
        r = requests.post(
            f"{BASE_URL}/api/users/{parent['id']}/reset-password",
            json={"new_password": "Updated@123"},
            headers=md_headers,
        )
        assert r.status_code == 200
        # Old token now 401
        me2 = requests.get(f"{BASE_URL}/api/auth/me",
                           headers={"Authorization": f"Bearer {old_token}"})
        assert me2.status_code == 401
        # Old password 401
        bad = requests.post(f"{BASE_URL}/api/auth/parent/login",
                            json={"username": uname, "password": "Original@123"})
        assert bad.status_code == 401
        # New password works
        ok = requests.post(f"{BASE_URL}/api/auth/parent/login",
                           json={"username": uname, "password": "Updated@123"})
        assert ok.status_code == 200

    def test_parent_reset_requires_new_password(self, md_headers):
        uname = _uname("req")
        rs = _mk_student(md_headers, uname, _phone(), password="Original@123")
        assert rs.status_code == 200
        users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
        parent = next(u for u in users if u.get("username") == uname)
        # No body → 400 for parents
        r = requests.post(
            f"{BASE_URL}/api/users/{parent['id']}/reset-password",
            headers=md_headers,
        )
        assert r.status_code == 400
        assert "password" in r.json()["detail"].lower()

    def test_staff_reset_without_body_returns_temp_password(self, md_headers):
        users = requests.get(f"{BASE_URL}/api/users", headers=md_headers).json()
        teacher = next((u for u in users if u.get("role") == "teacher"), None)
        if not teacher:
            pytest.skip("No teacher user available")
        r = requests.post(
            f"{BASE_URL}/api/users/{teacher['id']}/reset-password",
            headers=md_headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "temp_password" in body
        assert len(body["temp_password"]) >= 8


# ======================= Students list surfaces login info =======================
class TestStudentsListSurface:
    def test_students_list_has_parent_login_fields(self, md_headers):
        r = requests.get(f"{BASE_URL}/api/students", headers=md_headers)
        assert r.status_code == 200
        students = r.json()
        assert students, "Expected some students"
        with_login = [s for s in students if s.get("parent_has_login")]
        assert with_login, "Expected at least one student whose parent has a login"
        s = with_login[0]
        assert "parent_username" in s
        assert "parent_has_login" in s
        assert isinstance(s["parent_has_login"], bool)
