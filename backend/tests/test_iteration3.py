"""Iteration 3 — Klinara Kids Phase-1 upgrade.

Covers:
- Auth security: no debug_otp / debug_token in responses
- Staff & parent login (deactivated user 403 enforcement)
- MD-only user management: GET /users, PATCH /users/{id}/status, POST /users/{id}/reset-password
- Manual UPI flow: initiate -> submit-upi -> verify (approve + reject) -> remind
- POST /register-push non-blocking response
"""
import os
import pytest
import requests

def _read_frontend_backend_url():
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None


BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or _read_frontend_backend_url() or "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set (env or /app/frontend/.env)"
API = f"{BASE_URL}/api"


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _staff_login(session, email, password):
    r = session.post(f"{API}/auth/staff/login", json={"email": email, "password": password})
    return r


@pytest.fixture(scope="module")
def admin_token(session):
    r = _staff_login(session, "admin@klinara.com", "Admin@123")
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def md_token(session):
    r = _staff_login(session, "md@klinara.com", "MD@123456")
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def teacher_token(session):
    r = _staff_login(session, "teacher@klinara.com", "Teacher@123")
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def parent_token(session):
    session.post(f"{API}/auth/parent/send-otp", json={"phone": "9999999999"})
    r = session.post(f"{API}/auth/parent/verify-otp", json={"phone": "9999999999", "otp": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def md_user_id(session, md_token):
    r = session.get(f"{API}/auth/me", headers=_h(md_token))
    assert r.status_code == 200
    return r.json()["id"]


# ---------- Auth security ----------
class TestAuthSecurity:
    def test_send_otp_no_debug_otp_in_response(self, session):
        r = session.post(f"{API}/auth/parent/send-otp", json={"phone": "9999999999"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "debug_otp" not in body, f"debug_otp leaked: {body}"
        assert "otp" not in body, f"otp leaked: {body}"

    def test_forgot_password_no_debug_token(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": "admin@klinara.com"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "debug_token" not in body, f"debug_token leaked: {body}"
        assert "token" not in body, f"token leaked: {body}"

    def test_all_credentials_work(self, admin_token, md_token, teacher_token, parent_token):
        for t in (admin_token, md_token, teacher_token, parent_token):
            assert isinstance(t, str) and len(t) > 20


# ---------- MD user management ----------
class TestUserManagement:
    def test_md_list_users(self, session, md_token):
        r = session.get(f"{API}/users", headers=_h(md_token))
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list) and len(users) >= 4
        roles = {u["role"] for u in users}
        assert {"admin", "md", "teacher", "parent"}.issubset(roles)
        for u in users:
            for k in ("id", "name", "role", "active"):
                assert k in u, f"missing {k} in {u}"
            # login identifier: staff -> email; parent -> phone
            assert u.get("email") or u.get("phone")

    def test_md_list_users_filter_by_role(self, session, md_token):
        r = session.get(f"{API}/users?role=teacher", headers=_h(md_token))
        assert r.status_code == 200
        users = r.json()
        assert all(u["role"] == "teacher" for u in users)

    def test_admin_list_users_forbidden(self, session, admin_token):
        r = session.get(f"{API}/users", headers=_h(admin_token))
        assert r.status_code == 403

    def test_teacher_list_users_forbidden(self, session, teacher_token):
        r = session.get(f"{API}/users", headers=_h(teacher_token))
        assert r.status_code == 403

    def test_md_cannot_deactivate_self(self, session, md_token, md_user_id):
        r = session.patch(f"{API}/users/{md_user_id}/status", headers=_h(md_token),
                          json={"active": False})
        assert r.status_code == 400

    def test_deactivate_then_reactivate_teacher_login(self, session, md_token):
        # find teacher id
        r = session.get(f"{API}/users?role=teacher", headers=_h(md_token))
        assert r.status_code == 200
        teacher = next((u for u in r.json() if u.get("email") == "teacher@klinara.com"), None)
        assert teacher, "seeded teacher missing"

        # deactivate
        r = session.patch(f"{API}/users/{teacher['id']}/status", headers=_h(md_token),
                          json={"active": False})
        assert r.status_code == 200
        assert r.json()["active"] is False

        # deactivated login must 403
        r = session.post(f"{API}/auth/staff/login",
                         json={"email": "teacher@klinara.com", "password": "Teacher@123"})
        assert r.status_code == 403
        assert "deactivated" in r.text.lower()

        # reactivate
        r = session.patch(f"{API}/users/{teacher['id']}/status", headers=_h(md_token),
                          json={"active": True})
        assert r.status_code == 200 and r.json()["active"] is True

        # login works again
        r = session.post(f"{API}/auth/staff/login",
                         json={"email": "teacher@klinara.com", "password": "Teacher@123"})
        assert r.status_code == 200

    def test_reset_teacher_password_and_login(self, session, md_token):
        r = session.get(f"{API}/users?role=teacher", headers=_h(md_token))
        teacher = next(u for u in r.json() if u.get("email") == "teacher@klinara.com")

        r = session.post(f"{API}/users/{teacher['id']}/reset-password", headers=_h(md_token))
        assert r.status_code == 200, r.text
        temp = r.json().get("temp_password")
        assert temp and len(temp) >= 8

        # temp password can log in
        r = session.post(f"{API}/auth/staff/login",
                         json={"email": "teacher@klinara.com", "password": temp})
        assert r.status_code == 200

        # restore original password using MD reset (loop won't work — instead re-reset then set via a direct login test)
        # Simpler: reset again — but we can't easily set a known password. Just make sure teacher login with old
        # password now fails.
        r2 = session.post(f"{API}/auth/staff/login",
                          json={"email": "teacher@klinara.com", "password": "Teacher@123"})
        assert r2.status_code == 401

        # cleanup: log the temp password so main agent can reset via seed if needed
        print(f"[cleanup-needed] Teacher temp password set to: {temp}. Restart backend to re-seed.")

    def test_reset_parent_password_rejected(self, session, md_token):
        r = session.get(f"{API}/users?role=parent", headers=_h(md_token))
        parent = next((u for u in r.json() if u.get("phone") == "9999999999"), None)
        assert parent, "seeded parent missing"
        r = session.post(f"{API}/users/{parent['id']}/reset-password", headers=_h(md_token))
        assert r.status_code == 400


# ---------- Manual UPI flow ----------
class TestManualUpi:
    @pytest.fixture(scope="class")
    def student_id(self, session, parent_token):
        r = session.get(f"{API}/students", headers=_h(parent_token))
        assert r.status_code == 200
        students = r.json()
        assert students, "parent has no students"
        return students[0]["id"]

    def _create_pending(self, session, parent_token, student_id, amount=1000):
        r = session.post(f"{API}/payments/initiate", headers=_h(parent_token),
                         json={"student_id": student_id, "amount": amount,
                               "description": "TEST_iteration3 fee"})
        assert r.status_code == 200, r.text
        return r.json()["payment"]

    def test_submit_upi_transitions_to_pending_verification(self, session, parent_token, student_id):
        p = self._create_pending(session, parent_token, student_id)
        r = session.post(f"{API}/payments/{p['id']}/submit-upi", headers=_h(parent_token),
                         json={"utr": "TESTUTR123456"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending_verification"
        assert (r.json().get("utr") or "").upper() == "TESTUTR123456"

    def test_admin_approves_becomes_paid(self, session, parent_token, admin_token, student_id):
        p = self._create_pending(session, parent_token, student_id)
        session.post(f"{API}/payments/{p['id']}/submit-upi", headers=_h(parent_token),
                     json={"utr": "TESTAPPROVE01"})
        r = session.post(f"{API}/payments/{p['id']}/verify", headers=_h(admin_token),
                         json={"approve": True})
        assert r.status_code == 200
        assert r.json()["status"] == "paid"
        # verify via GET
        r = session.get(f"{API}/payments/student/{student_id}", headers=_h(admin_token))
        rec = next(x for x in r.json() if x["id"] == p["id"])
        assert rec["status"] == "paid"

    def test_admin_rejects_back_to_pending(self, session, parent_token, admin_token, student_id):
        p = self._create_pending(session, parent_token, student_id)
        session.post(f"{API}/payments/{p['id']}/submit-upi", headers=_h(parent_token),
                     json={"utr": "TESTREJECT001"})
        r = session.post(f"{API}/payments/{p['id']}/verify", headers=_h(admin_token),
                         json={"approve": False, "reason": "Amount mismatch"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "pending"
        assert body.get("reject_reason") == "Amount mismatch"

    def test_pending_verification_list(self, session, parent_token, admin_token, student_id):
        p = self._create_pending(session, parent_token, student_id)
        session.post(f"{API}/payments/{p['id']}/submit-upi", headers=_h(parent_token),
                     json={"utr": "TESTPENDLIST01"})
        r = session.get(f"{API}/payments/pending-verification", headers=_h(admin_token))
        assert r.status_code == 200
        ids = {x["id"] for x in r.json()}
        assert p["id"] in ids


# ---------- Fee reminder ----------
class TestFeeReminder:
    def test_reminder_success_on_pending(self, session, parent_token, admin_token):
        # create fresh pending payment
        r = session.get(f"{API}/students", headers=_h(parent_token))
        student_id = r.json()[0]["id"]
        r = session.post(f"{API}/payments/initiate", headers=_h(parent_token),
                         json={"student_id": student_id, "amount": 500,
                               "description": "TEST_reminder"})
        p = r.json()["payment"]

        r = session.post(f"{API}/payments/{p['id']}/remind", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        assert "message" in r.json()

    def test_reminder_fails_on_paid(self, session, parent_token, admin_token):
        r = session.get(f"{API}/students", headers=_h(parent_token))
        student_id = r.json()[0]["id"]
        r = session.post(f"{API}/payments/initiate", headers=_h(parent_token),
                         json={"student_id": student_id, "amount": 500,
                               "description": "TEST_paid_reminder"})
        p = r.json()["payment"]
        # submit + approve to reach paid
        session.post(f"{API}/payments/{p['id']}/submit-upi", headers=_h(parent_token),
                     json={"utr": "TESTREMPAID01"})
        session.post(f"{API}/payments/{p['id']}/verify", headers=_h(admin_token),
                     json={"approve": True})

        r = session.post(f"{API}/payments/{p['id']}/remind", headers=_h(admin_token))
        assert r.status_code == 400
        assert "paid" in r.text.lower()

    def test_reminder_forbidden_for_parent(self, session, parent_token):
        # any id — will 403 before reaching lookup
        r = session.post(f"{API}/payments/deadbeef/remind", headers=_h(parent_token))
        assert r.status_code == 403


# ---------- Push registration ----------
class TestPushRegister:
    def test_register_push_returns_2xx(self, session, parent_token):
        r = session.post(
            f"{API}/register-push",
            headers=_h(parent_token),  # endpoint is open in code but sending auth doesn't hurt
            json={"user_id": "test-user-id", "platform": "ios", "device_token": "TEST_TOKEN_123"},
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("status") in ("skipped", "registered")
