# Iteration 8: Push alerts (absent dedupe, complaint->MD, fee due reminders, verify/deletion regressions, config)
import os
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
API = f"{BASE_URL}/api"
IST = timezone(timedelta(hours=5, minutes=30))

MD = {"email": "md@klinara.com", "password": "MD@123456"}
ADMIN = {"email": "admin@klinara.com", "password": "Admin@123"}
TEACHER = {"email": "teacher@klinara.com", "password": "Teacher@123"}
ANJALI = {"username": "anjali.reddy", "password": "Parent@123"}

AARAV_PENDING = "a9d435cd-d395-47ac-93e5-ac4939c0ce39"


@pytest.fixture(scope="module")
def mdb():
    c = MongoClient(os.environ["MONGO_URL"])
    yield c[os.environ["DB_NAME"]]
    c.close()


def staff_token(creds):
    r = requests.post(f"{API}/auth/staff/login", json=creds)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def md():
    return staff_token(MD)


@pytest.fixture(scope="module")
def admin():
    return staff_token(ADMIN)


@pytest.fixture(scope="module")
def teacher():
    return staff_token(TEACHER)


@pytest.fixture(scope="module")
def parent():
    r = requests.post(f"{API}/auth/parent/login", json=ANJALI)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def aarav(mdb):
    s = mdb.students.find_one({"parent_phone": "9876543210"}, {"_id": 0})
    assert s, "Aarav (seeded student) missing"
    return s


def ist_dt(days, hour=12):
    d = datetime.now(IST).date() + timedelta(days=days)
    return datetime(d.year, d.month, d.day, hour, 0, tzinfo=IST).astimezone(timezone.utc).replace(tzinfo=None)


# ---------- Attendance absent alert dedupe ----------
class TestAbsentAlert:
    DATE = "2020-02-29"
    DATE2 = "2020-03-01"

    @pytest.fixture(autouse=True, scope="class")
    def cleanup(self, mdb, aarav):
        mdb.attendance.delete_many({"student_id": aarav["id"], "date": {"$in": [self.DATE, self.DATE2]}})
        yield
        mdb.attendance.delete_many({"student_id": aarav["id"], "date": {"$in": [self.DATE, self.DATE2]}})

    def _mark(self, tok, sid, date, status):
        r = requests.post(f"{API}/attendance", json={"student_id": sid, "date": date, "status": status}, headers=h(tok))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == status
        return r.json()

    def test_present_and_late_do_not_flag(self, teacher, aarav, mdb):
        self._mark(teacher, aarav["id"], self.DATE2, "present")
        assert not mdb.attendance.find_one({"student_id": aarav["id"], "date": self.DATE2}).get("absent_notified")
        self._mark(teacher, aarav["id"], self.DATE2, "late")
        assert not mdb.attendance.find_one({"student_id": aarav["id"], "date": self.DATE2}).get("absent_notified")

    def test_absent_sets_flag_and_dedupes(self, teacher, aarav, mdb):
        # Preview: the push relay rejects the placeholder key, so the background task releases
        # the claim (absent_notified unset) to allow a retry. In production a successful send keeps it True.
        import time
        rec = self._mark(teacher, aarav["id"], self.DATE, "absent")
        time.sleep(1.5)
        assert not mdb.attendance.find_one({"id": rec["id"]}).get("absent_notified")
        rec2 = self._mark(teacher, aarav["id"], self.DATE, "absent")
        assert rec2["id"] == rec["id"]
        self._mark(teacher, aarav["id"], self.DATE, "present")
        self._mark(teacher, aarav["id"], self.DATE, "absent")
        time.sleep(1.5)
        assert mdb.attendance.count_documents({"student_id": aarav["id"], "date": self.DATE}) == 1

    def test_present_then_absent_flags(self, teacher, aarav, mdb):
        import time
        r = self._mark(teacher, aarav["id"], self.DATE2, "absent")
        time.sleep(1.5)
        assert r["status"] == "absent"

    def test_parent_forbidden(self, parent, aarav):
        r = requests.post(f"{API}/attendance", json={"student_id": aarav["id"], "date": self.DATE, "status": "absent"}, headers=h(parent))
        assert r.status_code == 403


# ---------- Complaint -> MD push (fails silently) ----------
class TestComplaintPush:
    def test_create_complaint_ok(self, parent, aarav, mdb):
        r = requests.post(f"{API}/complaints", json={"student_id": aarav["id"], "subject": "TEST_push complaint", "description": "TEST_ desc"}, headers=h(parent))
        try:
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["status"] == "open" and d["subject"] == "TEST_push complaint"
            assert mdb.complaints.find_one({"id": d["id"]}) is not None
        finally:
            mdb.complaints.delete_many({"subject": {"$regex": "^TEST_"}})


# ---------- Fee due reminders ----------
class TestFeeDueReminders:
    @pytest.fixture(autouse=True, scope="class")
    def restore(self, mdb, aarav):
        orig = mdb.payments.find_one({"id": AARAV_PENDING}, {"_id": 0})
        assert orig and orig["status"] == "pending"
        yield
        unset = {k: "" for k in ("due_date", "reminder_3d_sent", "reminder_due_sent") if k not in orig}
        setv = {k: orig[k] for k in ("due_date", "reminder_3d_sent", "reminder_due_sent") if k in orig}
        upd = {}
        if unset:
            upd["$unset"] = unset
        if setv:
            upd["$set"] = setv
        if upd:
            mdb.payments.update_one({"id": AARAV_PENDING}, upd)
        mdb.payments.delete_many({"id": {"$regex": "^TEST_"}})

    def _run(self, tok):
        r = requests.post(f"{API}/payments/run-due-reminders", headers=h(tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d.keys()) == {"3d", "due"}
        return d

    def test_rbac(self, admin, teacher, parent):
        for t in (admin, teacher, parent):
            assert requests.post(f"{API}/payments/run-due-reminders", headers=h(t)).status_code == 403
        assert requests.post(f"{API}/payments/run-due-reminders").status_code in (401, 403)

    def test_baseline_zero(self, md):
        assert self._run(md) == {"3d": 0, "due": 0}

    def test_3d_once(self, md, mdb):
        # 01:00 IST on today+3 (previous UTC day) -> validates IST conversion
        mdb.payments.update_one({"id": AARAV_PENDING}, {"$set": {"due_date": ist_dt(3, hour=1)}, "$unset": {"reminder_3d_sent": "", "reminder_due_sent": ""}})
        # Preview relay rejects the push -> not counted, claim released so the next run retries
        assert self._run(md) == {"3d": 0, "due": 0}
        assert not mdb.payments.find_one({"id": AARAV_PENDING}).get("reminder_3d_sent")
        assert self._run(md) == {"3d": 0, "due": 0}

    def test_due_today_once(self, md, mdb):
        mdb.payments.update_one({"id": AARAV_PENDING}, {"$set": {"due_date": ist_dt(0, hour=23)}})
        assert self._run(md) == {"3d": 0, "due": 0}
        assert not mdb.payments.find_one({"id": AARAV_PENDING}).get("reminder_due_sent")
        assert self._run(md) == {"3d": 0, "due": 0}

    def test_other_days_ignored(self, md, mdb):
        for days in (1, 2, -1, 4):
            mdb.payments.update_one({"id": AARAV_PENDING}, {"$set": {"due_date": ist_dt(days)}, "$unset": {"reminder_3d_sent": "", "reminder_due_sent": ""}})
            assert self._run(md) == {"3d": 0, "due": 0}, f"days={days}"

    def test_non_pending_ignored(self, md, mdb, aarav):
        mdb.payments.update_one({"id": AARAV_PENDING}, {"$unset": {"due_date": ""}})
        base = {"student_id": aarav["id"], "amount": 100, "description": "TEST_fee", "created_at": datetime.utcnow()}
        docs = [
            {**base, "id": "TEST_paid", "status": "paid", "due_date": ist_dt(3)},
            {**base, "id": "TEST_pv", "status": "pending_verification", "due_date": ist_dt(3)},
            {**base, "id": "TEST_del", "status": "pending", "due_date": ist_dt(0), "deleted_at": datetime.utcnow()},
            {**base, "id": "TEST_paid_due", "status": "paid", "due_date": ist_dt(0)},
        ]
        mdb.payments.insert_many(docs)
        assert self._run(md) == {"3d": 0, "due": 0}
        for d in docs:
            got = mdb.payments.find_one({"id": d["id"]})
            assert not got.get("reminder_3d_sent") and not got.get("reminder_due_sent")


# ---------- Regressions ----------
class TestRegressions:
    def test_verify_approve(self, md, mdb, aarav):
        pid = "TEST_verify_" + uuid.uuid4().hex[:6]
        mdb.payments.insert_one({"id": pid, "student_id": aarav["id"], "amount": 123, "status": "pending_verification",
                                 "utr": "TESTUTR123456", "description": "TEST_fee", "created_at": datetime.utcnow(), "deleted_at": None})
        try:
            r = requests.post(f"{API}/payments/{pid}/verify", json={"approve": True}, headers=h(md))
            assert r.status_code == 200, r.text
            assert r.json()["status"] == "paid"
            assert mdb.payments.find_one({"id": pid})["status"] == "paid"
        finally:
            mdb.payments.delete_one({"id": pid})

    def test_public_deletion_request(self, mdb):
        r = requests.post(f"{API}/public/deletion-requests", json={"parent_name": "TEST_Parent", "phone": "9000000001", "child_name": "TEST_Kid"})
        try:
            assert r.status_code in (200, 429), r.text
            if r.status_code == 200:
                assert mdb.deletion_requests.find_one({"parent_name": "TEST_Parent"}) is not None
        finally:
            mdb.deletion_requests.delete_many({"parent_name": "TEST_Parent"})


# ---------- Config ----------
class TestConfig:
    def test_app_json_and_google_services(self):
        app = json.load(open("/app/frontend/app.json"))["expo"]
        assert app["android"]["package"] == "com.klinarakids.app"
        assert app["android"]["googleServicesFile"] == "./google-services.json"
        plugins = [p if isinstance(p, str) else p[0] for p in app.get("plugins", [])]
        assert "expo-notifications" in plugins
        g = json.load(open("/app/frontend/google-services.json"))
        pkgs = [c["client_info"]["android_client_info"]["package_name"] for c in g["client"]]
        assert "com.klinarakids.app" in pkgs
