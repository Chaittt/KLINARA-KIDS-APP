"""Iteration 6 — Admin can add students + create parent login via shared Add Student form.

Covers:
- POST /api/students as Admin with parent_username/parent_password -> 200, parent can log in
- Duplicate username (as Admin) -> 409 'Username already taken'
- Sibling (same phone) without credentials as Admin -> 200, reuses login
- Admin missing credentials for brand new parent -> 400
- Admin 403 on /users/{id}/parent-login, /users/{id}/reset-password, DELETE /students/{id}
- Admin can use /parents/lookup (existing phone 9876543210 -> anjali.reddy)
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
CREATED = []


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/staff/login", json=creds)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def md_headers():
    h = _login(MD)
    yield h
    # cleanup created students (MD only)
    for sid in CREATED:
        requests.delete(f"{BASE_URL}/api/students/{sid}", headers=h)


@pytest.fixture(scope="module")
def admin_headers():
    return _login(ADMIN)


def _phone():
    return f"73000{uuid.uuid4().int % 100000:05d}"


def _uname(prefix="adm6"):
    return f"{prefix}.{uuid.uuid4().hex[:6]}"


def _payload(phone, uname=None, pwd=None, plan="single"):
    p = {
        "name": f"TEST_{uuid.uuid4().hex[:5]} Kid",
        "class_name": "Nursery",
        "parent_phone": phone,
        "parent_name": "TEST Admin Parent",
        "age": 4,
        "total_fees": 9000,
        "plan_type": plan,
        "parent_username": uname,
        "parent_password": pwd,
    }
    if plan == "term":
        p["term_amounts"] = [3000, 3000, 3000]
    return p


# Admin student creation with parent login
class TestAdminAddStudent:
    state = {}

    def test_admin_create_with_login(self, admin_headers, md_headers):
        phone, uname = _phone(), _uname()
        r = requests.post(f"{BASE_URL}/api/students", json=_payload(phone, uname, "Secret@1", "term"), headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["parent_phone"] == phone and d["plan_type"] == "term" and d["total_fees"] == 9000
        assert "_id" not in d
        CREATED.append(d["id"])
        self.state.update(phone=phone, uname=uname, sid=d["id"], parent_id=d["parent_id"])
        # persisted + login flags visible
        lst = requests.get(f"{BASE_URL}/api/students", headers=admin_headers).json()
        me = [s for s in lst if s["id"] == d["id"]]
        assert me and me[0]["parent_username"] == uname and me[0]["parent_has_login"] is True

    def test_new_parent_can_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/parent/login",
                          json={"username": self.state["uname"], "password": "Secret@1"})
        assert r.status_code == 200, r.text
        assert r.json().get("access_token")

    def test_duplicate_username_409(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/students", json=_payload(_phone(), self.state["uname"], "Secret@1"), headers=admin_headers)
        assert r.status_code == 409
        assert r.json()["detail"] == "Username already taken"

    def test_duplicate_seeded_username_409(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/students", json=_payload(_phone(), "anjali.reddy", "Secret@1"), headers=admin_headers)
        assert r.status_code == 409

    def test_sibling_without_creds(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/students", json=_payload(self.state["phone"]), headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        CREATED.append(d["id"])
        assert d["parent_id"] == self.state["parent_id"]

    def test_new_parent_missing_creds_400(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/students", json=_payload(_phone()), headers=admin_headers)
        assert r.status_code in (400, 422), r.text

    def test_short_password_400(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/students", json=_payload(_phone(), _uname(), "abc"), headers=admin_headers)
        assert r.status_code == 400, r.text

    def test_term_mismatch_400(self, admin_headers):
        p = _payload(_phone(), _uname(), "Secret@1", "term")
        p["term_amounts"] = [1000, 1000, 1000]
        r = requests.post(f"{BASE_URL}/api/students", json=p, headers=admin_headers)
        assert r.status_code == 400

    def test_admin_lookup_existing_phone(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/parents/lookup?phone=9876543210", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["exists"] is True and r.json()["username"] == "anjali.reddy"


# MD-only endpoints must reject Admin
class TestAdminForbidden:
    def test_admin_parent_login_403(self, admin_headers):
        pid = TestAdminAddStudent.state.get("parent_id", "x")
        r = requests.post(f"{BASE_URL}/api/users/{pid}/parent-login",
                          json={"username": _uname(), "password": "Secret@1"}, headers=admin_headers)
        assert r.status_code == 403

    def test_admin_reset_password_403(self, admin_headers):
        pid = TestAdminAddStudent.state.get("parent_id", "x")
        r = requests.post(f"{BASE_URL}/api/users/{pid}/reset-password",
                          json={"new_password": "Other@123"}, headers=admin_headers)
        assert r.status_code == 403

    def test_admin_delete_student_403(self, admin_headers):
        sid = TestAdminAddStudent.state.get("sid", "x")
        r = requests.delete(f"{BASE_URL}/api/students/{sid}", headers=admin_headers)
        assert r.status_code == 403

    def test_student_still_exists_after_admin_delete(self, admin_headers):
        sid = TestAdminAddStudent.state.get("sid")
        lst = requests.get(f"{BASE_URL}/api/students", headers=admin_headers).json()
        assert any(s["id"] == sid for s in lst)
