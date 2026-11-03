# Seed helper for iteration 7 UI tests: a fresh parent with pending deletion request + an unmatched web request
import os, random, uuid, requests, json
API = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
md = requests.post(f"{API}/auth/staff/login", json={"email": "md@klinara.com", "password": "MD@123456"}).json()["access_token"]
H = {"Authorization": f"Bearer {md}"}
phone = "7" + "".join(random.choice("0123456789") for _ in range(9))
uname = "test_ui_" + uuid.uuid4().hex[:6]
s = requests.post(f"{API}/students", headers=H, json={"name": "TEST_UIKid", "class_name": "Sunshine", "parent_phone": phone,
    "parent_name": "TEST_UIParent", "total_fees": 5000, "plan_type": "single", "parent_username": uname, "parent_password": "TestPass@123"})
print("student", s.status_code)
pt = requests.post(f"{API}/auth/parent/login", json={"username": uname, "password": "TestPass@123"}).json()["access_token"]
d = requests.post(f"{API}/me/deletion-request", json={"reason": "TEST ui"}, headers={"Authorization": f"Bearer {pt}"}).json()
uphone = "5" + "".join(random.choice("0123456789") for _ in range(9))
w = requests.post(f"{API}/public/deletion-requests", json={"parent_name": "TEST_UIUnmatched", "phone": uphone, "child_name": "TEST_Nobody"})
print("web", w.status_code, w.text[:80])
lst = requests.get(f"{API}/deletion-requests", headers=H).json()
out = {"fresh_id": d["id"], "fresh_user": uname, "unmatched_id": next((x["id"] for x in lst if x["phone"] == uphone), None),
       "anjali_id": next((x["id"] for x in lst if x.get("username") == "anjali.reddy" and x["status"] == "pending"), None)}
print(json.dumps(out))
