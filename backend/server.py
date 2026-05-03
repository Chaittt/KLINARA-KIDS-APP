from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# -------------------- Setup --------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 24  # 1 day for mobile convenience
OTP_TTL_SECONDS = 120
OTP_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_THRESHOLD = 5
LOGIN_LOCKOUT_MINUTES = 15

app = FastAPI(title="Klinara Kids API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("klinara")


# -------------------- Helpers --------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "iat": now_utc(),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serialize_user(u: dict) -> dict:
    if not u:
        return u
    return {
        "id": u.get("id"),
        "name": u.get("name"),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "role": u.get("role"),
        "created_at": u.get("created_at").isoformat() if u.get("created_at") else None,
    }


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep


# -------------------- Models --------------------
class StaffLoginIn(BaseModel):
    email: EmailStr
    password: str


class SendOtpIn(BaseModel):
    phone: str


class VerifyOtpIn(BaseModel):
    phone: str
    otp: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class StudentIn(BaseModel):
    name: str
    class_name: str = Field(..., alias="class_name")
    parent_phone: str
    age: Optional[int] = None
    photo: Optional[str] = None  # base64


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    class_name: Optional[str] = None
    parent_phone: Optional[str] = None
    age: Optional[int] = None
    photo: Optional[str] = None


class TeacherIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    class_name: Optional[str] = None


class AttendanceIn(BaseModel):
    student_id: str
    date: str  # YYYY-MM-DD
    status: Literal["present", "absent", "late"]


class ActivityIn(BaseModel):
    student_id: str
    description: str
    photo_base64: Optional[str] = None  # data:image/...;base64,...


class PaymentInitIn(BaseModel):
    student_id: str
    amount: float
    description: Optional[str] = "Monthly Fee"


class PaymentMarkPaidIn(BaseModel):
    payment_id: str
    transaction_id: Optional[str] = None


class EltheaCompleteIn(BaseModel):
    student_id: str
    grow_scores: dict  # {"G": 80, "R": 65, "O": 70, "W": 75}
    archetype_name: str
    archetype_description: str


# -------------------- Auth: Staff --------------------
@api.post("/auth/staff/login")
async def staff_login(body: StaffLoginIn, request: Request):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    # Brute force check
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= LOGIN_LOCKOUT_THRESHOLD:
        locked_until = rec.get("locked_until")
        if locked_until and locked_until > now_utc():
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email, "role": {"$in": ["teacher", "admin", "md"]}})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": now_utc() + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(24)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "expires_at": now_utc() + timedelta(hours=1),
            "used": False,
            "created_at": now_utc(),
        })
        log.info(f"[MOCK RESET] Reset token for {email}: {token}")
        return {"message": "If the email exists, a reset link has been sent.", "debug_token": token}
    return {"message": "If the email exists, a reset link has been sent."}


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec or rec["expires_at"] < now_utc():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"message": "Password reset successfully"}


# -------------------- Auth: Parent OTP --------------------
@api.post("/auth/parent/send-otp")
async def parent_send_otp(body: SendOtpIn):
    phone = body.phone.strip()
    user = await db.users.find_one({"phone": phone, "role": "parent"})
    if not user:
        raise HTTPException(status_code=404, detail="Phone number not registered")

    # Use mock OTP from env, but always allow real generation in DB
    mock_otp = os.environ.get("MOCK_OTP", "123456")
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {
            "phone": phone,
            "otp": mock_otp,
            "expires_at": now_utc() + timedelta(seconds=OTP_TTL_SECONDS),
            "attempts": 0,
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    log.info(f"[MOCK OTP] OTP for {phone}: {mock_otp}")
    return {"message": "OTP sent successfully", "debug_otp": mock_otp, "expires_in": OTP_TTL_SECONDS}


@api.post("/auth/parent/verify-otp")
async def parent_verify_otp(body: VerifyOtpIn):
    phone = body.phone.strip()
    rec = await db.otps.find_one({"phone": phone})
    if not rec:
        raise HTTPException(status_code=400, detail="No OTP sent for this phone")
    if rec["expires_at"] < now_utc():
        raise HTTPException(status_code=400, detail="OTP expired")
    if rec.get("attempts", 0) >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")
    if rec["otp"] != body.otp.strip():
        await db.otps.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=401, detail="Invalid OTP")

    await db.otps.delete_one({"phone": phone})
    user = await db.users.find_one({"phone": phone, "role": "parent"})
    if not user:
        raise HTTPException(status_code=404, detail="Parent not found")
    token = create_access_token(user["id"], "parent")
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@api.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"message": "Logged out"}


# -------------------- Students --------------------
def serialize_student(s: dict) -> dict:
    return {
        "id": s.get("id"),
        "name": s.get("name"),
        "class_name": s.get("class_name"),
        "parent_phone": s.get("parent_phone"),
        "parent_id": s.get("parent_id"),
        "age": s.get("age"),
        "photo": s.get("photo"),
        "elthea_grow": s.get("elthea_grow"),
        "elthea_archetype_name": s.get("elthea_archetype_name"),
        "elthea_archetype_description": s.get("elthea_archetype_description"),
        "elthea_last_assessed_at": s.get("elthea_last_assessed_at").isoformat() if s.get("elthea_last_assessed_at") else None,
        "created_at": s.get("created_at").isoformat() if s.get("created_at") else None,
    }


@api.get("/students")
async def list_students(user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        students = await db.students.find({"parent_phone": user["phone"]}).to_list(100)
    elif user["role"] == "teacher":
        teacher = await db.users.find_one({"id": user["id"]})
        cls = teacher.get("class_name") if teacher else None
        q = {"class_name": cls} if cls else {}
        students = await db.students.find(q).to_list(500)
    else:  # admin / md
        students = await db.students.find().to_list(1000)
    return [serialize_student(s) for s in students]


@api.get("/students/{student_id}")
async def get_student(student_id: str, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": student_id})
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    if user["role"] == "parent" and s.get("parent_phone") != user.get("phone"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return serialize_student(s)


@api.post("/students")
async def create_student(body: StudentIn, user: dict = Depends(require_roles("admin", "md"))):
    parent = await db.users.find_one({"phone": body.parent_phone, "role": "parent"})
    parent_id = parent["id"] if parent else None
    if not parent:
        # Auto-create parent user (omit email to avoid unique-null collisions)
        parent_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": parent_id,
            "name": f"Parent of {body.name}",
            "phone": body.parent_phone,
            "password_hash": None,
            "role": "parent",
            "created_at": now_utc(),
        })

    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "class_name": body.class_name,
        "parent_phone": body.parent_phone,
        "parent_id": parent_id,
        "age": body.age,
        "photo": body.photo,
        "elthea_grow": None,
        "elthea_archetype_name": None,
        "elthea_archetype_description": None,
        "elthea_last_assessed_at": None,
        "created_at": now_utc(),
    }
    await db.students.insert_one(doc)
    return serialize_student(doc)


@api.put("/students/{student_id}")
async def update_student(student_id: str, body: StudentUpdate, user: dict = Depends(require_roles("admin", "md"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.students.update_one({"id": student_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    s = await db.students.find_one({"id": student_id})
    return serialize_student(s)


@api.delete("/students/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_roles("admin", "md"))):
    res = await db.students.delete_one({"id": student_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"message": "Deleted"}


# -------------------- Teachers (admin/md) --------------------
@api.get("/teachers")
async def list_teachers(user: dict = Depends(require_roles("admin", "md"))):
    teachers = await db.users.find({"role": "teacher"}, {"_id": 0, "password_hash": 0}).to_list(200)
    return [serialize_user(t) | {"class_name": t.get("class_name")} for t in teachers]


@api.post("/teachers")
async def create_teacher(body: TeacherIn, user: dict = Depends(require_roles("admin", "md"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email,
        "phone": None,
        "password_hash": hash_password(body.password),
        "role": "teacher",
        "class_name": body.class_name,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return serialize_user(doc) | {"class_name": doc.get("class_name")}


@api.delete("/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str, user: dict = Depends(require_roles("admin", "md"))):
    res = await db.users.delete_one({"id": teacher_id, "role": "teacher"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return {"message": "Deleted"}


# -------------------- Attendance --------------------
def serialize_attendance(a: dict) -> dict:
    return {
        "id": a.get("id"),
        "student_id": a.get("student_id"),
        "date": a.get("date"),
        "status": a.get("status"),
        "marked_by": a.get("marked_by"),
        "created_at": a.get("created_at").isoformat() if a.get("created_at") else None,
    }


@api.post("/attendance")
async def mark_attendance(body: AttendanceIn, user: dict = Depends(require_roles("teacher", "admin", "md"))):
    existing = await db.attendance.find_one({"student_id": body.student_id, "date": body.date})
    if existing:
        await db.attendance.update_one(
            {"id": existing["id"]},
            {"$set": {"status": body.status, "marked_by": user["id"]}},
        )
        rec = await db.attendance.find_one({"id": existing["id"]})
        return serialize_attendance(rec)
    doc = {
        "id": str(uuid.uuid4()),
        "student_id": body.student_id,
        "date": body.date,
        "status": body.status,
        "marked_by": user["id"],
        "created_at": now_utc(),
    }
    await db.attendance.insert_one(doc)
    return serialize_attendance(doc)


@api.get("/attendance/student/{student_id}")
async def get_student_attendance(student_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        s = await db.students.find_one({"id": student_id})
        if not s or s.get("parent_phone") != user.get("phone"):
            raise HTTPException(status_code=403, detail="Forbidden")
    records = await db.attendance.find({"student_id": student_id}).sort("date", -1).to_list(200)
    return [serialize_attendance(r) for r in records]


@api.get("/attendance/today")
async def attendance_today(class_name: Optional[str] = None, user: dict = Depends(require_roles("teacher", "admin", "md"))):
    today = now_utc().strftime("%Y-%m-%d")
    q = {}
    if class_name:
        students = await db.students.find({"class_name": class_name}).to_list(500)
        q["student_id"] = {"$in": [s["id"] for s in students]}
    records = await db.attendance.find({**q, "date": today}).to_list(500)
    return [serialize_attendance(r) for r in records]


# -------------------- Activities --------------------
def serialize_activity(a: dict) -> dict:
    return {
        "id": a.get("id"),
        "student_id": a.get("student_id"),
        "description": a.get("description"),
        "photo_base64": a.get("photo_base64"),
        "uploaded_by": a.get("uploaded_by"),
        "uploader_name": a.get("uploader_name"),
        "created_at": a.get("created_at").isoformat() if a.get("created_at") else None,
    }


@api.post("/activities")
async def create_activity(body: ActivityIn, user: dict = Depends(require_roles("teacher", "admin", "md"))):
    doc = {
        "id": str(uuid.uuid4()),
        "student_id": body.student_id,
        "description": body.description,
        "photo_base64": body.photo_base64,
        "uploaded_by": user["id"],
        "uploader_name": user["name"],
        "created_at": now_utc(),
    }
    await db.activities.insert_one(doc)
    return serialize_activity(doc)


@api.get("/activities/student/{student_id}")
async def get_student_activities(student_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        s = await db.students.find_one({"id": student_id})
        if not s or s.get("parent_phone") != user.get("phone"):
            raise HTTPException(status_code=403, detail="Forbidden")
    records = await db.activities.find({"student_id": student_id}).sort("created_at", -1).to_list(100)
    return [serialize_activity(r) for r in records]


@api.get("/activities/feed")
async def feed(user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        students = await db.students.find({"parent_phone": user["phone"]}).to_list(50)
        ids = [s["id"] for s in students]
        recs = await db.activities.find({"student_id": {"$in": ids}}).sort("created_at", -1).to_list(100)
    else:
        recs = await db.activities.find().sort("created_at", -1).to_list(100)
    return [serialize_activity(r) for r in recs]


# -------------------- Payments --------------------
def serialize_payment(p: dict) -> dict:
    return {
        "id": p.get("id"),
        "student_id": p.get("student_id"),
        "amount": p.get("amount"),
        "status": p.get("status"),
        "transaction_id": p.get("transaction_id"),
        "description": p.get("description"),
        "created_at": p.get("created_at").isoformat() if p.get("created_at") else None,
        "paid_at": p.get("paid_at").isoformat() if p.get("paid_at") else None,
    }


@api.post("/payments/initiate")
async def initiate_payment(body: PaymentInitIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "student_id": body.student_id,
        "amount": body.amount,
        "status": "pending",
        "transaction_id": None,
        "description": body.description or "Monthly Fee",
        "created_at": now_utc(),
        "paid_at": None,
    }
    await db.payments.insert_one(doc)
    # Mock UPI URL
    upi_url = f"upi://pay?pa=klinarakids@upi&pn=Klinara%20Kids&am={body.amount}&tn={doc['id']}&cu=INR"
    return {"payment": serialize_payment(doc), "upi_url": upi_url}


@api.post("/payments/mark-paid")
async def mark_payment_paid(body: PaymentMarkPaidIn, user: dict = Depends(get_current_user)):
    p = await db.payments.find_one({"id": body.payment_id})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    txn = body.transaction_id or f"MOCK{uuid.uuid4().hex[:10].upper()}"
    await db.payments.update_one(
        {"id": body.payment_id},
        {"$set": {"status": "paid", "transaction_id": txn, "paid_at": now_utc()}},
    )
    p = await db.payments.find_one({"id": body.payment_id})
    return serialize_payment(p)


@api.get("/payments/student/{student_id}")
async def list_student_payments(student_id: str, user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        s = await db.students.find_one({"id": student_id})
        if not s or s.get("parent_phone") != user.get("phone"):
            raise HTTPException(status_code=403, detail="Forbidden")
    recs = await db.payments.find({"student_id": student_id}).sort("created_at", -1).to_list(200)
    return [serialize_payment(r) for r in recs]


@api.get("/payments")
async def list_all_payments(user: dict = Depends(require_roles("admin", "md"))):
    recs = await db.payments.find().sort("created_at", -1).to_list(1000)
    return [serialize_payment(r) for r in recs]


# -------------------- Elthea (mocked) --------------------
@api.post("/elthea/launch")
async def elthea_launch(student_id: str, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": student_id})
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    if user["role"] == "parent" and s.get("parent_phone") != user.get("phone"):
        raise HTTPException(status_code=403, detail="Forbidden")
    session_id = uuid.uuid4().hex
    # Mocked launch URL — in production this would call api.elthea.xyz/v1/launch
    launch_url = f"https://api.elthea.xyz/mock/assessment/{session_id}?student={student_id}"
    return {"launch_url": launch_url, "session_id": session_id, "expires_in": 1800}


@api.post("/elthea/complete")
async def elthea_complete(body: EltheaCompleteIn, user: dict = Depends(get_current_user)):
    s = await db.students.find_one({"id": body.student_id})
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    await db.students.update_one(
        {"id": body.student_id},
        {"$set": {
            "elthea_grow": body.grow_scores,
            "elthea_archetype_name": body.archetype_name,
            "elthea_archetype_description": body.archetype_description,
            "elthea_last_assessed_at": now_utc(),
        }},
    )
    s = await db.students.find_one({"id": body.student_id})
    return serialize_student(s)


# -------------------- Reports (admin/md) --------------------
@api.get("/reports/financial")
async def financial_report(user: dict = Depends(require_roles("admin", "md"))):
    payments = await db.payments.find().to_list(5000)
    total_revenue = sum(p["amount"] for p in payments if p["status"] == "paid")
    pending = sum(p["amount"] for p in payments if p["status"] == "pending")
    paid_count = sum(1 for p in payments if p["status"] == "paid")
    pending_count = sum(1 for p in payments if p["status"] == "pending")

    # Monthly revenue (last 6 months)
    by_month = {}
    for p in payments:
        if p["status"] != "paid" or not p.get("paid_at"):
            continue
        key = p["paid_at"].strftime("%Y-%m")
        by_month[key] = by_month.get(key, 0) + p["amount"]
    monthly = [{"month": k, "revenue": v} for k, v in sorted(by_month.items())]

    return {
        "total_revenue": total_revenue,
        "pending_amount": pending,
        "paid_count": paid_count,
        "pending_count": pending_count,
        "monthly_revenue": monthly,
    }


@api.get("/reports/attendance")
async def attendance_report(user: dict = Depends(require_roles("admin", "md", "teacher"))):
    today = now_utc().strftime("%Y-%m-%d")
    students = await db.students.find().to_list(2000)
    today_records = await db.attendance.find({"date": today}).to_list(2000)
    present = sum(1 for r in today_records if r["status"] == "present")
    absent = sum(1 for r in today_records if r["status"] == "absent")
    late = sum(1 for r in today_records if r["status"] == "late")
    return {
        "total_students": len(students),
        "present_today": present,
        "absent_today": absent,
        "late_today": late,
        "unmarked": len(students) - len(today_records),
    }


# -------------------- Stats (admin/md home) --------------------
@api.get("/stats/overview")
async def overview(user: dict = Depends(require_roles("admin", "md"))):
    students_count = await db.students.count_documents({})
    teachers_count = await db.users.count_documents({"role": "teacher"})
    parents_count = await db.users.count_documents({"role": "parent"})
    payments = await db.payments.find().to_list(5000)
    revenue = sum(p["amount"] for p in payments if p["status"] == "paid")
    pending = sum(p["amount"] for p in payments if p["status"] == "pending")
    return {
        "students": students_count,
        "teachers": teachers_count,
        "parents": parents_count,
        "revenue": revenue,
        "pending_fees": pending,
    }


# -------------------- Health --------------------
@api.get("/")
async def root():
    return {"app": "Klinara Kids API", "status": "ok"}


# -------------------- Seed Data --------------------
async def seed():
    # Indexes
    try:
        # Drop legacy non-sparse email index if present
        try:
            existing = await db.users.index_information()
            if "email_1" in existing and not existing["email_1"].get("sparse"):
                await db.users.drop_index("email_1")
        except Exception as _e:
            log.warning(f"email index drop: {_e}")
        await db.users.create_index("email", unique=True, sparse=True)
        await db.users.create_index("phone", sparse=True)
        await db.students.create_index("id", unique=True)
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        log.warning(f"Index creation: {e}")

    # Admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Klinara Admin",
            "email": admin_email,
            "phone": None,
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "role": "admin",
            "created_at": now_utc(),
        })
    else:
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(os.environ["ADMIN_PASSWORD"])}})

    # MD
    md_email = os.environ["MD_EMAIL"].lower()
    md = await db.users.find_one({"email": md_email})
    if not md:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Klinara MD",
            "email": md_email,
            "phone": None,
            "password_hash": hash_password(os.environ["MD_PASSWORD"]),
            "role": "md",
            "created_at": now_utc(),
        })
    else:
        await db.users.update_one({"email": md_email}, {"$set": {"password_hash": hash_password(os.environ["MD_PASSWORD"])}})

    # Teacher
    t_email = os.environ["TEACHER_EMAIL"].lower()
    teacher = await db.users.find_one({"email": t_email})
    if not teacher:
        teacher_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": teacher_id,
            "name": "Ms. Priya Sharma",
            "email": t_email,
            "phone": None,
            "password_hash": hash_password(os.environ["TEACHER_PASSWORD"]),
            "role": "teacher",
            "class_name": "Sunshine",
            "created_at": now_utc(),
        })
    else:
        await db.users.update_one({"email": t_email}, {"$set": {"password_hash": hash_password(os.environ["TEACHER_PASSWORD"])}})
        teacher_id = teacher["id"]

    # Parent
    parent_phone = os.environ["PARENT_PHONE"]
    parent = await db.users.find_one({"phone": parent_phone, "role": "parent"})
    if not parent:
        parent_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": parent_id,
            "name": "Anjali Reddy",
            "phone": parent_phone,
            "password_hash": None,
            "role": "parent",
            "created_at": now_utc(),
        })
    else:
        parent_id = parent["id"]

    # Student
    students = await db.students.find({"parent_phone": parent_phone}).to_list(10)
    aarav = next((s for s in students if s.get("name") == "Aarav Reddy"), None)
    if aarav:
        # Reset Aarav's elthea profile on every startup to avoid test pollution
        await db.students.update_one(
            {"id": aarav["id"]},
            {"$set": {
                "elthea_grow": {"G": 78, "R": 65, "O": 82, "W": 71},
                "elthea_archetype_name": "The Explorer",
                "elthea_archetype_description": "Curious, energetic, and naturally drawn to discovery. Aarav thrives when given space to explore new ideas and environments.",
                "elthea_last_assessed_at": now_utc() - timedelta(days=7),
            }},
        )
    if not students:
        s_id = str(uuid.uuid4())
        await db.students.insert_one({
            "id": s_id,
            "name": "Aarav Reddy",
            "class_name": "Sunshine",
            "parent_phone": parent_phone,
            "parent_id": parent_id,
            "age": 4,
            "photo": None,
            "elthea_grow": {"G": 78, "R": 65, "O": 82, "W": 71},
            "elthea_archetype_name": "The Explorer",
            "elthea_archetype_description": "Curious, energetic, and naturally drawn to discovery. Aarav thrives when given space to explore new ideas and environments.",
            "elthea_last_assessed_at": now_utc() - timedelta(days=7),
            "created_at": now_utc() - timedelta(days=120),
        })
        # Sample attendance (last 7 days)
        for i in range(7):
            d = (now_utc() - timedelta(days=i)).strftime("%Y-%m-%d")
            status_v = "present" if i % 4 != 0 else ("late" if i == 4 else "absent")
            await db.attendance.insert_one({
                "id": str(uuid.uuid4()),
                "student_id": s_id,
                "date": d,
                "status": status_v,
                "marked_by": teacher_id,
                "created_at": now_utc() - timedelta(days=i),
            })
        # Activities
        sample_activities = [
            ("Aarav had a wonderful time during finger painting today! He created beautiful flowers and showed great creativity.", None),
            ("Storytime was a hit! Aarav listened attentively and even answered questions about the characters.", None),
            ("Outdoor playtime: Aarav showed great teamwork during the obstacle course. So proud of him!", None),
        ]
        for i, (desc, photo) in enumerate(sample_activities):
            await db.activities.insert_one({
                "id": str(uuid.uuid4()),
                "student_id": s_id,
                "description": desc,
                "photo_base64": photo,
                "uploaded_by": teacher_id,
                "uploader_name": "Ms. Priya Sharma",
                "created_at": now_utc() - timedelta(days=i),
            })
        # Payments
        await db.payments.insert_one({
            "id": str(uuid.uuid4()),
            "student_id": s_id,
            "amount": 8500.0,
            "status": "paid",
            "transaction_id": "MOCKABC123",
            "description": "Monthly Fee - January",
            "created_at": now_utc() - timedelta(days=30),
            "paid_at": now_utc() - timedelta(days=29),
        })
        await db.payments.insert_one({
            "id": str(uuid.uuid4()),
            "student_id": s_id,
            "amount": 8500.0,
            "status": "pending",
            "transaction_id": None,
            "description": "Monthly Fee - February",
            "created_at": now_utc() - timedelta(days=2),
            "paid_at": None,
        })

    log.info("Seed complete")


# -------------------- App wiring --------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
