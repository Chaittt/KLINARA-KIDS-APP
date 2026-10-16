"""Iteration 2 — Schedule + Heatmap endpoints."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://little-klinara.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/staff/login", json={"email": "admin@klinara.com", "password": "Admin@123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def teacher_token(session):
    r = session.post(f"{API}/auth/staff/login", json={"email": "teacher@klinara.com", "password": "Teacher@123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def parent_token(session):
    session.post(f"{API}/auth/parent/send-otp", json={"phone": "9999999999"})
    r = session.post(f"{API}/auth/parent/verify-otp", json={"phone": "9999999999", "otp": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ---------- Schedule ----------
class TestScheduleToday:
    def test_parent_schedule(self, session, parent_token):
        r = session.get(f"{API}/schedule/today", headers=_h(parent_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["class_name"] == "Sunshine"
        assert "date" in data and isinstance(data["date"], str)
        assert "day_of_week" in data and 0 <= data["day_of_week"] <= 6
        assert isinstance(data["items"], list)
        # Mon-Fri => 8 items, Sat/Sun => 1 item
        if data["day_of_week"] < 5:
            assert len(data["items"]) == 8
        else:
            assert len(data["items"]) == 1
        if data["items"]:
            it = data["items"][0]
            for k in ("start_time", "end_time", "activity", "icon"):
                assert k in it

    def test_teacher_schedule(self, session, teacher_token):
        r = session.get(f"{API}/schedule/today", headers=_h(teacher_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["class_name"] == "Sunshine"
        assert isinstance(data["items"], list)

    def test_schedule_no_auth(self, session):
        r = session.get(f"{API}/schedule/today")
        assert r.status_code == 401


# ---------- Heatmap ----------
class TestHeatmap:
    def test_admin_heatmap_default(self, session, admin_token):
        r = session.get(f"{API}/reports/heatmap", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "dates" in data and "rows" in data
        assert len(data["dates"]) == 14
        assert isinstance(data["rows"], list) and len(data["rows"]) >= 1
        row = data["rows"][0]
        for k in ("class_name", "student_count", "cells"):
            assert k in row
        assert len(row["cells"]) == 14
        cell = row["cells"][0]
        for k in ("date", "pct", "present", "total"):
            assert k in cell

    def test_admin_heatmap_custom_days(self, session, admin_token):
        r = session.get(f"{API}/reports/heatmap?days=7", headers=_h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data["dates"]) == 7
        assert all(len(row["cells"]) == 7 for row in data["rows"])

    def test_teacher_heatmap_allowed(self, session, teacher_token):
        r = session.get(f"{API}/reports/heatmap?days=14", headers=_h(teacher_token))
        assert r.status_code == 200

    def test_parent_heatmap_forbidden(self, session, parent_token):
        r = session.get(f"{API}/reports/heatmap", headers=_h(parent_token))
        assert r.status_code == 403
