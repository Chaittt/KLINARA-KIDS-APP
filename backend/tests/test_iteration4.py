"""Iteration 4 — Fee plans at student registration."""
import os
import time
import uuid
import requests
import pytest

def _load_base():
    v = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if v:
        return v.rstrip("/")
    envp = "/app/frontend/.env"
    with open(envp) as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")


BASE_URL = _load_base()

MD = {"email": "md@klinara.com", "password": "MD@123456"}


@pytest.fixture(scope="module")
def md_token():
    r = requests.post(f"{BASE_URL}/api/auth/staff/login", json=MD)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def md_headers(md_token):
    return {"Authorization": f"Bearer {md_token}"}


def _tag():
    return f"TEST_{uuid.uuid4().hex[:6]}"


def _phone():
    # Distinctive throwaway phone
    return f"70000{uuid.uuid4().int % 100000:05d}"


# ---------- Single plan creation ----------
def test_single_plan_creates_one_pending_payment(md_headers):
    payload = {
        "name": f"{_tag()} SingleKid",
        "class_name": "Nursery",
        "parent_phone": _phone(),
        "parent_name": "Ravi Kumar",
        "total_fees": 30000,
        "plan_type": "single",
    }
    r = requests.post(f"{BASE_URL}/api/students", json=payload, headers=md_headers)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["total_fees"] == 30000
    assert s["plan_type"] == "single"
    sid = s["id"]
    pays = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    assert len(pays) == 1
    p = pays[0]
    assert p["amount"] == 30000
    assert p["status"] == "pending"
    assert p["description"] == "Full Fee (One-time)"
    assert p["plan_type"] == "single"
    assert p["due_date"]


# ---------- Term plan creation ----------
def test_term_plan_creates_three_pending_payments(md_headers):
    payload = {
        "name": f"{_tag()} TermKid",
        "class_name": "LKG",
        "parent_phone": _phone(),
        "parent_name": "Suman Gupta",
        "total_fees": 30000,
        "plan_type": "term",
        "term_amounts": [10000, 10000, 10000],
    }
    r = requests.post(f"{BASE_URL}/api/students", json=payload, headers=md_headers)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    pays = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    assert len(pays) == 3
    # Sort by term_index
    pays_sorted = sorted(pays, key=lambda x: x["term_index"])
    for i, p in enumerate(pays_sorted, start=1):
        assert p["term_index"] == i
        assert p["term_total"] == 3
        assert p["plan_type"] == "term"
        assert p["amount"] == 10000
        assert p["status"] == "pending"
        assert p["description"] == f"Term {i} of 3"
        assert p["due_date"]
    # Verify due-date spacing (approx 3 months apart)
    from datetime import datetime
    d1 = datetime.fromisoformat(pays_sorted[0]["due_date"].replace("Z", "+00:00"))
    d2 = datetime.fromisoformat(pays_sorted[1]["due_date"].replace("Z", "+00:00"))
    d3 = datetime.fromisoformat(pays_sorted[2]["due_date"].replace("Z", "+00:00"))
    assert 85 < (d2 - d1).days < 95
    assert 175 < (d3 - d1).days < 190


# ---------- Validation errors ----------
def test_term_amounts_dont_sum_400(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} Bad", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "X", "total_fees": 30000,
        "plan_type": "term", "term_amounts": [10000, 10000, 9999],
    }, headers=md_headers)
    assert r.status_code == 400


def test_term_amounts_wrong_count_400(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} Bad", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "X", "total_fees": 30000,
        "plan_type": "term", "term_amounts": [15000, 15000],
    }, headers=md_headers)
    assert r.status_code == 400


def test_term_amount_zero_or_negative_400(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} Bad", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "X", "total_fees": 30000,
        "plan_type": "term", "term_amounts": [15000, 15000, 0],
    }, headers=md_headers)
    assert r.status_code == 400


def test_total_fees_zero_400(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} Bad", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "X", "total_fees": 0, "plan_type": "single",
    }, headers=md_headers)
    assert r.status_code == 400


# ---------- Parent name behaviour ----------
def test_new_parent_gets_entered_name(md_headers):
    phone = _phone()
    parent_name = f"NewParent_{uuid.uuid4().hex[:5]}"
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} K", "class_name": "N", "parent_phone": phone,
        "parent_name": parent_name, "total_fees": 5000, "plan_type": "single",
    }, headers=md_headers)
    assert r.status_code == 200
    users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
    match = [u for u in users if u["phone"] == phone]
    assert match, "Parent user was not created"
    assert match[0]["name"] == parent_name
    assert "Parent of" not in match[0]["name"]


def test_existing_parent_name_updated(md_headers):
    phone = _phone()
    # First student
    requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} K1", "class_name": "N", "parent_phone": phone,
        "parent_name": "First Name", "total_fees": 5000, "plan_type": "single",
    }, headers=md_headers)
    # Second student with same phone, new name
    new_name = f"Updated_{uuid.uuid4().hex[:5]}"
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} K2", "class_name": "N", "parent_phone": phone,
        "parent_name": new_name, "total_fees": 5000, "plan_type": "single",
    }, headers=md_headers)
    assert r.status_code == 200
    users = requests.get(f"{BASE_URL}/api/users?role=parent", headers=md_headers).json()
    match = [u for u in users if u["phone"] == phone]
    assert len(match) == 1  # Not duplicated
    assert match[0]["name"] == new_name


# ---------- Student list surfaces total_fees & plan_type ----------
def test_students_list_returns_fees_fields(md_headers):
    r = requests.get(f"{BASE_URL}/api/students", headers=md_headers)
    assert r.status_code == 200
    students = r.json()
    with_fees = [s for s in students if s.get("total_fees") is not None]
    assert with_fees, "Expected at least one student with total_fees"
    assert "plan_type" in with_fees[0]


# ---------- Fee-plan endpoint (unlocked) ----------
def test_set_fee_plan_soft_cancels_prior(md_headers):
    # Create student with single plan
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} SetP", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "P", "total_fees": 12000, "plan_type": "single",
    }, headers=md_headers)
    sid = r.json()["id"]
    before = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    assert len(before) == 1
    old_id = before[0]["id"]
    # Change to term
    r2 = requests.post(f"{BASE_URL}/api/students/{sid}/fee-plan", json={
        "total_fees": 12000, "plan_type": "term", "term_amounts": [4000, 4000, 4000],
    }, headers=md_headers)
    assert r2.status_code == 200, r2.text
    after = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    assert len(after) == 3
    # Old payment must NOT appear
    ids = [p["id"] for p in after]
    assert old_id not in ids
    # And must NOT appear in overall list either
    all_pays = requests.get(f"{BASE_URL}/api/payments", headers=md_headers).json()
    assert old_id not in [p["id"] for p in all_pays]


# ---------- Fee-plan lock ----------
def test_fee_plan_locked_when_submitted(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} Locked", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "P", "total_fees": 8000, "plan_type": "single",
    }, headers=md_headers)
    sid = r.json()["id"]
    pays = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    pid = pays[0]["id"]
    # Submit UPI as MD (allowed since not parent-restricted)
    rs = requests.post(f"{BASE_URL}/api/payments/{pid}/submit-upi",
                       json={"utr": "TESTUTR12345"}, headers=md_headers)
    assert rs.status_code == 200
    # Try to change plan
    rf = requests.post(f"{BASE_URL}/api/students/{sid}/fee-plan", json={
        "total_fees": 9000, "plan_type": "single",
    }, headers=md_headers)
    assert rf.status_code == 400
    assert "locked" in rf.json()["detail"].lower() or "progress" in rf.json()["detail"].lower()


def test_fee_plan_locked_when_paid(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} Paid", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "P", "total_fees": 7000, "plan_type": "single",
    }, headers=md_headers)
    sid = r.json()["id"]
    pays = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    pid = pays[0]["id"]
    requests.post(f"{BASE_URL}/api/payments/{pid}/submit-upi",
                  json={"utr": "PAIDUTR99999"}, headers=md_headers)
    rv = requests.post(f"{BASE_URL}/api/payments/{pid}/verify",
                       json={"approve": True}, headers=md_headers)
    assert rv.status_code == 200
    rf = requests.post(f"{BASE_URL}/api/students/{sid}/fee-plan", json={
        "total_fees": 9000, "plan_type": "single",
    }, headers=md_headers)
    assert rf.status_code == 400


# ---------- Regression: manual UPI + reminder on a term fee ----------
def test_upi_flow_and_reminder_on_term_fee(md_headers):
    r = requests.post(f"{BASE_URL}/api/students", json={
        "name": f"{_tag()} TermReg", "class_name": "N", "parent_phone": _phone(),
        "parent_name": "P", "total_fees": 30000, "plan_type": "term",
        "term_amounts": [10000, 10000, 10000],
    }, headers=md_headers)
    sid = r.json()["id"]
    pays = requests.get(f"{BASE_URL}/api/payments/student/{sid}", headers=md_headers).json()
    term1 = sorted(pays, key=lambda x: x["term_index"])[0]
    # Reminder on pending term
    rr = requests.post(f"{BASE_URL}/api/payments/{term1['id']}/remind", headers=md_headers)
    assert rr.status_code == 200
    # Submit → pending_verification → verify → paid
    rs = requests.post(f"{BASE_URL}/api/payments/{term1['id']}/submit-upi",
                       json={"utr": "TERMUTR12345"}, headers=md_headers)
    assert rs.status_code == 200
    assert rs.json()["status"] == "pending_verification"
    rv = requests.post(f"{BASE_URL}/api/payments/{term1['id']}/verify",
                       json={"approve": True}, headers=md_headers)
    assert rv.status_code == 200
    assert rv.json()["status"] == "paid"
    # Reminder on paid should 400
    rr2 = requests.post(f"{BASE_URL}/api/payments/{term1['id']}/remind", headers=md_headers)
    assert rr2.status_code == 400
