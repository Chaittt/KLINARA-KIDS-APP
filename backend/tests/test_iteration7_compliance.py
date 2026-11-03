# Iteration 7: Compliance (privacy pages, consent, Elthea gating, data deletion requests)
import os
import time
import uuid
import random
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
API = f"{BASE_URL}/api"

MD = {"email": "md@klinara.com", "password": "MD@123456"}
ADMIN = {"email": "admin@klinara.com", "password": "Admin@123"}
TEACHER = {"email": "teacher@klinara.com", "password": "Teacher@123"}
ANJALI = {"username": "anjali.reddy", "password": "Parent@123"}


def staff_token(creds):
    r = requests.post(f"{API}/auth/staff/login", json=creds)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def parent_login(creds):
    return requests.post(f"{API}/auth/parent/login", json=creds)


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def md():
    return staff_token(MD)


@pytest.fixture(scope="module")
def anjali():
    r = parent_login(ANJALI)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def anjali_original(anjali):
    me = requests.get(f"{API}/auth/me", headers=h(anjali)).json()
    return me


# ---------- Public pages ----------
class TestPublicPages:
    def test_privacy_html(self):
        r = requests.get(f"{API}/privacy")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "privacy" in r.text.lower()

    def test_delete_account_html(self):
        r = requests.get(f"{API}/delete-account")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "public/deletion-requests" in r.text

    def test_public_bad_phone_400(self):
        r = requests.post(f"{API}/public/deletion-requests", json={
            "parent_name": "TEST_Bad", "phone": "12345", "child_name": "TEST_Kid"})
        assert r.status_code == 400

    def test_public_missing_fields_422(self):
        r = requests.post(f"{API}/public/deletion-requests", json={"phone": "1234567890"})
        assert r.status_code == 422


# ---------- Consent & Elthea gating ----------
class TestConsentElthea:
    def test_consent_and_elthea_gate(self, anjali, anjali_original):
        students = requests.get(f"{API}/students", headers=h(anjali)).json()
        assert isinstance(students, list) and students, students
        sid = students[0]["id"]
        # elthea off
        r = requests.post(f"{API}/me/consent", json={"accept_privacy": True, "elthea": False}, headers=h(anjali))
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/auth/me", headers=h(anjali)).json()
        assert me["privacy_consent_at"] and me["elthea_consent"] is False
        r = requests.post(f"{API}/elthea/launch", params={"student_id": sid}, headers=h(anjali))
        assert r.status_code == 403, r.text
        # elthea on
        r = requests.post(f"{API}/me/consent", json={"elthea": True}, headers=h(anjali))
        assert r.status_code == 200 and r.json()["elthea_consent"] is True
        r = requests.post(f"{API}/elthea/launch", params={"student_id": sid}, headers=h(anjali))
        assert r.status_code == 200 and "launch_url" in r.json()
        # back off
        requests.post(f"{API}/me/consent", json={"elthea": False}, headers=h(anjali))

    def test_consent_staff_forbidden(self, md):
        r = requests.post(f"{API}/me/consent", json={"accept_privacy": True}, headers=h(md))
        assert r.status_code == 403


# ---------- Deletion requests: RBAC + reject (anjali) ----------
class TestDeletionReject:
    def test_non_md_forbidden(self, anjali):
        for creds in (ADMIN, TEACHER):
            t = staff_token(creds)
            assert requests.get(f"{API}/deletion-requests", headers=h(t)).status_code == 403
        assert requests.get(f"{API}/deletion-requests", headers=h(anjali)).status_code == 403
        assert requests.post(f"{API}/deletion-requests/x/complete", headers=h(anjali)).status_code == 403

    def test_anjali_request_idempotent_and_reject(self, anjali, md):
        r1 = requests.post(f"{API}/me/deletion-request", json={"reason": "TEST_reason"}, headers=h(anjali))
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["status"] == "pending" and d1["matched"] is True and d1["source"] == "app"
        r2 = requests.post(f"{API}/me/deletion-request", json={}, headers=h(anjali))
        assert r2.json()["id"] == d1["id"]
        g = requests.get(f"{API}/me/deletion-request", headers=h(anjali)).json()
        assert g["id"] == d1["id"] and g["status"] == "pending"
        lst = requests.get(f"{API}/deletion-requests", headers=h(md)).json()
        assert any(x["id"] == d1["id"] for x in lst)
        # reject needs reason
        assert requests.post(f"{API}/deletion-requests/{d1['id']}/reject", json={"reason": ""}, headers=h(md)).status_code == 422
        rj = requests.post(f"{API}/deletion-requests/{d1['id']}/reject", json={"reason": "TEST_reject"}, headers=h(md))
        assert rj.status_code == 200 and rj.json()["status"] == "rejected" and rj.json()["reject_reason"] == "TEST_reject"
        g = requests.get(f"{API}/me/deletion-request", headers=h(anjali)).json()
        assert g["status"] == "rejected"
        # second reject / complete -> 400
        assert requests.post(f"{API}/deletion-requests/{d1['id']}/complete", headers=h(md)).status_code == 400
        # anjali can still log in
        assert parent_login(ANJALI).status_code == 200

    def test_complete_unknown_404(self, md):
        assert requests.post(f"{API}/deletion-requests/nope/complete", headers=h(md)).status_code == 404


# ---------- Full erase with a fresh parent ----------
class TestErase:
    def test_unmatched_web_request_complete_400(self, md):
        phone = "5" + "".join(random.choice("0123456789") for _ in range(9))
        r = requests.post(f"{API}/public/deletion-requests", json={
            "parent_name": "TEST_Unmatched", "username": "test_nobody_" + uuid.uuid4().hex[:5],
            "phone": phone, "child_name": "TEST_Kid", "note": "TEST"})
        if r.status_code == 429:
            pytest.skip("rate limited (shared ingress IP)")
        assert r.status_code == 200, r.text
        lst = requests.get(f"{API}/deletion-requests", headers=h(md)).json()
        d = next(x for x in lst if x["phone"] == phone)
        assert d["matched"] is False and d["source"] == "web"
        rc = requests.post(f"{API}/deletion-requests/{d['id']}/complete", headers=h(md))
        assert rc.status_code == 400, rc.text
        requests.post(f"{API}/deletion-requests/{d['id']}/reject", json={"reason": "TEST cleanup"}, headers=h(md))

    def test_erase_fresh_parent(self, md):
        phone = "7" + "".join(random.choice("0123456789") for _ in range(9))
        uname = "test_erase_" + uuid.uuid4().hex[:6]
        pw = "TestPass@123"
        r = requests.post(f"{API}/students", headers=h(md), json={
            "name": "TEST_EraseKid", "class_name": "Sunshine",
            "parent_phone": phone, "parent_name": "TEST_EraseParent", "total_fees": 10000,
            "plan_type": "single", "parent_username": uname, "parent_password": pw})
        assert r.status_code in (200, 201), r.text
        sid = r.json().get("id") or r.json().get("student", {}).get("id")
        lr = parent_login({"username": uname, "password": pw})
        assert lr.status_code == 200, lr.text
        ptok = lr.json()["access_token"]
        # add a complaint as parent (best effort)
        requests.post(f"{API}/complaints", headers=h(ptok), json={"student_id": sid, "subject": "TEST", "description": "TEST complaint"})
        dr = requests.post(f"{API}/me/deletion-request", json={"reason": "TEST"}, headers=h(ptok)).json()
        assert dr["status"] == "pending" and "TEST_EraseKid" in (dr["child_name"] or "")
        pays_before = requests.get(f"{API}/payments", params={"student_id": sid}, headers=h(md))
        rc = requests.post(f"{API}/deletion-requests/{dr['id']}/complete", headers=h(md))
        assert rc.status_code == 200, rc.text
        erased = rc.json()["erased"]
        assert erased["students"] == 1
        # parent cannot log in; old token invalid
        assert parent_login({"username": uname, "password": pw}).status_code == 401
        assert requests.get(f"{API}/auth/me", headers=h(ptok)).status_code == 401
        # student gone
        assert requests.get(f"{API}/students/{sid}", headers=h(md)).status_code == 404
        # request now completed
        lst = requests.get(f"{API}/deletion-requests", headers=h(md)).json()
        d = next(x for x in lst if x["id"] == dr["id"])
        assert d["status"] == "completed" and d["username"] is None
        print("payments before:", pays_before.status_code, "erased:", erased)


# ---------- Rate limit (run last) ----------
class TestZRateLimit:
    def test_public_rate_limit_429(self):
        codes = []
        for i in range(12):
            r = requests.post(f"{API}/public/deletion-requests", json={
                "parent_name": f"TEST_Rate{i}", "phone": "4" + "".join(random.choice("0123456789") for _ in range(9)),
                "child_name": "TEST_Kid"})
            codes.append(r.status_code)
        print("codes", codes)
        assert 429 in codes
