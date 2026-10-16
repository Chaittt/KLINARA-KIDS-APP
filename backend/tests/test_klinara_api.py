"""Klinara Kids API tests — pytest JUnit output.

Covers auth (staff + parent OTP), students, teachers, attendance,
activities, payments, Elthea (mocked), reports, RBAC.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL"
) else "https://little-klinara.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Login helpers / tokens ----------
@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/staff/login", json={"email": "admin@klinara.com", "password": "Admin@123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def md_token(session):
    r = session.post(f"{API}/auth/staff/login", json={"email": "md@klinara.com", "password": "MD@123456"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "md"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def teacher_token(session):
    r = session.post(f"{API}/auth/staff/login", json={"email": "teacher@klinara.com", "password": "Teacher@123"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "teacher"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def parent_token(session):
    # Send OTP
    r = session.post(f"{API}/auth/parent/send-otp", json={"phone": "9999999999"})
    assert r.status_code == 200, r.text
    otp = r.json().get("debug_otp")
    assert otp == "123456"
    r2 = session.post(f"{API}/auth/parent/verify-otp", json={"phone": "9999999999", "otp": otp})
    assert r2.status_code == 200, r2.text
    data = r2.json()
    assert data["user"]["role"] == "parent"
    return data["access_token"]


# ---------- Health ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_staff_wrong_password(self, session):
        r = session.post(f"{API}/auth/staff/login", json={"email": "admin@klinara.com", "password": "wrongpass"})
        assert r.status_code in (401, 429)

    def test_parent_wrong_otp(self, session):
        session.post(f"{API}/auth/parent/send-otp", json={"phone": "9999999999"})
        r = session.post(f"{API}/auth/parent/verify-otp", json={"phone": "9999999999", "otp": "000000"})
        assert r.status_code == 401

    def test_auth_me(self, session, admin_token):
        r = session.get(f"{API}/auth/me", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["email"] == "admin@klinara.com"
        assert r.json()["role"] == "admin"

    def test_auth_me_no_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_forgot_and_reset_password(self, session):
        # Use MD account so we don't break admin login for subsequent tests
        r = session.post(f"{API}/auth/forgot-password", json={"email": "md@klinara.com"})
        assert r.status_code == 200
        token = r.json().get("debug_token")
        assert token
        # Reset to same password so other tests keep passing
        r2 = session.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "MD@123456"})
        assert r2.status_code == 200
        # Verify login still works
        r3 = session.post(f"{API}/auth/staff/login", json={"email": "md@klinara.com", "password": "MD@123456"})
        assert r3.status_code == 200


# ---------- Students ----------
class TestStudents:
    def test_list_as_admin_includes_aarav(self, session, admin_token):
        r = session.get(f"{API}/students", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        names = [s["name"] for s in r.json()]
        assert "Aarav Reddy" in names

    def test_list_as_parent_only_own(self, session, parent_token):
        r = session.get(f"{API}/students", headers=_auth_headers(parent_token))
        assert r.status_code == 200
        students = r.json()
        assert len(students) >= 1
        for s in students:
            assert s["parent_phone"] == "9999999999"

    def test_create_update_delete(self, session, admin_token):
        phone = f"90000{uuid.uuid4().hex[:5]}"
        payload = {"name": "TEST_Student", "class_name": "Sunshine", "parent_phone": phone, "age": 4}
        r = session.post(f"{API}/students", headers=_auth_headers(admin_token), json=payload)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        # GET verify persistence
        rg = session.get(f"{API}/students/{sid}", headers=_auth_headers(admin_token))
        assert rg.status_code == 200
        assert rg.json()["name"] == "TEST_Student"
        # PUT update
        ru = session.put(f"{API}/students/{sid}", headers=_auth_headers(admin_token), json={"age": 5})
        assert ru.status_code == 200
        assert ru.json()["age"] == 5
        # DELETE
        rd = session.delete(f"{API}/students/{sid}", headers=_auth_headers(admin_token))
        assert rd.status_code == 200
        # GET 404
        r404 = session.get(f"{API}/students/{sid}", headers=_auth_headers(admin_token))
        assert r404.status_code == 404


# ---------- Teachers ----------
class TestTeachers:
    def test_list_create_delete(self, session, admin_token):
        r = session.get(f"{API}/teachers", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        email = f"test_{uuid.uuid4().hex[:6]}@klinara.com"
        cr = session.post(f"{API}/teachers", headers=_auth_headers(admin_token),
                          json={"name": "TEST_Teacher", "email": email, "password": "Temp@12345", "class_name": "Rainbow"})
        assert cr.status_code == 200, cr.text
        tid = cr.json()["id"]
        dr = session.delete(f"{API}/teachers/{tid}", headers=_auth_headers(admin_token))
        assert dr.status_code == 200


# ---------- Attendance ----------
class TestAttendance:
    def test_mark_and_list(self, session, teacher_token, admin_token, parent_token):
        # Get Aarav id
        rs = session.get(f"{API}/students", headers=_auth_headers(admin_token))
        aarav = [s for s in rs.json() if s["name"] == "Aarav Reddy"][0]
        sid = aarav["id"]
        today = time.strftime("%Y-%m-%d")
        r = session.post(f"{API}/attendance", headers=_auth_headers(teacher_token),
                         json={"student_id": sid, "date": today, "status": "present"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "present"
        # Idempotent update
        r2 = session.post(f"{API}/attendance", headers=_auth_headers(teacher_token),
                          json={"student_id": sid, "date": today, "status": "late"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "late"
        # Parent history
        rh = session.get(f"{API}/attendance/student/{sid}", headers=_auth_headers(parent_token))
        assert rh.status_code == 200
        assert len(rh.json()) >= 1


# ---------- Activities ----------
class TestActivities:
    def test_create_and_feed(self, session, teacher_token, admin_token, parent_token):
        rs = session.get(f"{API}/students", headers=_auth_headers(admin_token))
        sid = [s for s in rs.json() if s["name"] == "Aarav Reddy"][0]["id"]
        b64 = "data:image/png;base64,iVBORw0KGgo="
        r = session.post(f"{API}/activities", headers=_auth_headers(teacher_token),
                         json={"student_id": sid, "description": "TEST_Activity", "photo_base64": b64})
        assert r.status_code == 200, r.text
        assert r.json()["description"] == "TEST_Activity"
        # Parent feed
        rf = session.get(f"{API}/activities/feed", headers=_auth_headers(parent_token))
        assert rf.status_code == 200
        descs = [a["description"] for a in rf.json()]
        assert "TEST_Activity" in descs


# ---------- Payments ----------
class TestPayments:
    def test_initiate_and_mark_paid(self, session, parent_token, admin_token):
        rs = session.get(f"{API}/students", headers=_auth_headers(admin_token))
        sid = [s for s in rs.json() if s["name"] == "Aarav Reddy"][0]["id"]
        r = session.post(f"{API}/payments/initiate", headers=_auth_headers(parent_token),
                         json={"student_id": sid, "amount": 100.0, "description": "TEST_Fee"})
        assert r.status_code == 200, r.text
        pid = r.json()["payment"]["id"]
        assert r.json()["payment"]["status"] == "pending"
        assert "upi_url" in r.json()
        rp = session.post(f"{API}/payments/mark-paid", headers=_auth_headers(parent_token),
                          json={"payment_id": pid})
        assert rp.status_code == 200
        assert rp.json()["status"] == "paid"
        assert rp.json()["transaction_id"].startswith("MOCK")


# ---------- Elthea ----------
class TestElthea:
    def test_launch_and_complete(self, session, parent_token, admin_token):
        rs = session.get(f"{API}/students", headers=_auth_headers(admin_token))
        sid = [s for s in rs.json() if s["name"] == "Aarav Reddy"][0]["id"]
        r = session.post(f"{API}/elthea/launch?student_id={sid}", headers=_auth_headers(parent_token))
        assert r.status_code == 200, r.text
        assert "launch_url" in r.json()
        assert "api.elthea.xyz/mock" in r.json()["launch_url"]
        rc = session.post(f"{API}/elthea/complete", headers=_auth_headers(parent_token),
                          json={"student_id": sid,
                                "grow_scores": {"G": 80, "R": 70, "O": 75, "W": 65},
                                "archetype_name": "TEST_Archetype",
                                "archetype_description": "TEST description"})
        assert rc.status_code == 200
        assert rc.json()["elthea_archetype_name"] == "TEST_Archetype"
        assert rc.json()["elthea_grow"]["G"] == 80


# ---------- Reports / Stats ----------
class TestReports:
    def test_financial(self, session, admin_token):
        r = session.get(f"{API}/reports/financial", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        for k in ("total_revenue", "pending_amount", "paid_count", "pending_count", "monthly_revenue"):
            assert k in data

    def test_attendance_report(self, session, admin_token):
        r = session.get(f"{API}/reports/attendance", headers=_auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "total_students" in data and data["total_students"] >= 1

    def test_stats_overview_md(self, session, md_token):
        r = session.get(f"{API}/stats/overview", headers=_auth_headers(md_token))
        assert r.status_code == 200
        data = r.json()
        for k in ("students", "teachers", "parents", "revenue", "pending_fees"):
            assert k in data


# ---------- RBAC ----------
class TestRBAC:
    def test_parent_cannot_access_teachers(self, session, parent_token):
        r = session.get(f"{API}/teachers", headers=_auth_headers(parent_token))
        assert r.status_code == 403

    def test_teacher_cannot_access_stats(self, session, teacher_token):
        r = session.get(f"{API}/stats/overview", headers=_auth_headers(teacher_token))
        assert r.status_code == 403

    def test_parent_cannot_create_student(self, session, parent_token):
        r = session.post(f"{API}/students", headers=_auth_headers(parent_token),
                         json={"name": "x", "class_name": "y", "parent_phone": "1"})
        assert r.status_code == 403
