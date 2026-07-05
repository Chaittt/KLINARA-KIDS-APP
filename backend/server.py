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
async def update_student(student_id: str, body: StudentUpdate, user: dict = Depends(require_roles("md"))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.students.update_one({"id": student_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    s = await db.students.find_one({"id": student_id})
    return serialize_student(s)


@api.delete("/students/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_roles("md"))):
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
async def create_teacher(body: TeacherIn, user: dict = Depends(require_roles("md"))):
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
async def delete_teacher(teacher_id: str, user: dict = Depends(require_roles("md"))):
    res = await db.users.delete_one({"id": teacher_id, "role": "teacher"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return {"message": "Deleted"}


# -------------------- Admins (MD only) --------------------
class AdminIn(BaseModel):
    name: str
    email: EmailStr
    password: str


@api.get("/admins")
async def list_admins(user: dict = Depends(require_roles("md", "admin"))):
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "password_hash": 0}).to_list(200)
    return [serialize_user(a) for a in admins]


@api.post("/admins")
async def create_admin(body: AdminIn, user: dict = Depends(require_roles("md"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email,
        "phone": None,
        "password_hash": hash_password(body.password),
        "role": "admin",
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return serialize_user(doc)


@api.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, user: dict = Depends(require_roles("md"))):
    res = await db.users.delete_one({"id": admin_id, "role": "admin"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
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


@api.get("/reports/heatmap")
async def attendance_heatmap(days: int = 14, user: dict = Depends(require_roles("admin", "md", "teacher"))):
    days = max(1, min(days, 60))
    today = now_utc().date()
    date_strs = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days - 1, -1, -1)]

    students = await db.students.find().to_list(2000)
    # Group students by class
    by_class: dict = {}
    for s in students:
        by_class.setdefault(s.get("class_name") or "Unassigned", []).append(s["id"])

    # Fetch all attendance for date range
    att = await db.attendance.find({"date": {"$in": date_strs}}).to_list(50000)
    # index: (student_id, date) -> status
    idx: dict = {(a["student_id"], a["date"]): a["status"] for a in att}

    rows = []
    for cls, student_ids in sorted(by_class.items()):
        cells = []
        for d in date_strs:
            present = 0
            total = 0
            for sid in student_ids:
                status = idx.get((sid, d))
                if status is None:
                    continue
                total += 1
                if status == "present":
                    present += 1
            pct = round((present / total) * 100) if total else None
            cells.append({"date": d, "pct": pct, "present": present, "total": total})
        rows.append({"class_name": cls, "student_count": len(student_ids), "cells": cells})
    return {"dates": date_strs, "rows": rows}


# -------------------- Schedule --------------------
def serialize_schedule(s: dict) -> dict:
    return {
        "id": s.get("id"),
        "class_name": s.get("class_name"),
        "day_of_week": s.get("day_of_week"),  # 0=Mon .. 6=Sun
        "start_time": s.get("start_time"),
        "end_time": s.get("end_time"),
        "activity": s.get("activity"),
        "icon": s.get("icon"),
    }


@api.get("/schedule/today")
async def schedule_today(user: dict = Depends(get_current_user)):
    today_dow = now_utc().weekday()  # 0-6
    today_str = now_utc().strftime("%A, %d %B")
    # Determine class
    class_name: Optional[str] = None
    if user["role"] == "parent":
        s = await db.students.find_one({"parent_phone": user.get("phone")})
        if s:
            class_name = s.get("class_name")
    else:
        teacher = await db.users.find_one({"id": user["id"]})
        class_name = teacher.get("class_name") if teacher else None
    items = []
    if class_name:
        recs = await db.schedules.find({"class_name": class_name, "day_of_week": today_dow}).sort("start_time", 1).to_list(50)
        items = [serialize_schedule(r) for r in recs]
    return {"class_name": class_name, "date": today_str, "day_of_week": today_dow, "items": items}


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


# -------------------- Salaries (MD only) --------------------
class SalaryIn(BaseModel):
    monthly_amount: float
    currency: str = "INR"
    notes: Optional[str] = None


@api.get("/salaries")
async def list_salaries(user: dict = Depends(require_roles("md"))):
    staff = await db.users.find({"role": {"$in": ["teacher", "admin"]}}, {"_id": 0, "password_hash": 0}).to_list(500)
    sal = {s["user_id"]: s for s in await db.salaries.find().to_list(1000)}
    out = []
    for u in staff:
        s = sal.get(u["id"], {})
        out.append({
            "user": serialize_user(u) | {"class_name": u.get("class_name")},
            "monthly_amount": s.get("monthly_amount"),
            "currency": s.get("currency", "INR"),
            "notes": s.get("notes"),
        })
    return out


@api.put("/salaries/{user_id}")
async def set_salary(user_id: str, body: SalaryIn, user: dict = Depends(require_roles("md"))):
    target = await db.users.find_one({"id": user_id})
    if not target or target.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=404, detail="Staff member not found")
    await db.salaries.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "monthly_amount": body.monthly_amount, "currency": body.currency, "notes": body.notes, "updated_at": now_utc()}},
        upsert=True,
    )
    return {"message": "Salary updated", "monthly_amount": body.monthly_amount, "currency": body.currency}


# -------------------- Fee Structure --------------------
class FeeStructureIn(BaseModel):
    monthly_amount: float


@api.get("/fee-structure")
async def list_fee_structure(user: dict = Depends(get_current_user)):
    items = await db.fee_structure.find().to_list(200)
    return [{"class_name": it["class_name"], "monthly_amount": it["monthly_amount"]} for it in items]


@api.put("/fee-structure/{class_name}")
async def upsert_fee_structure(class_name: str, body: FeeStructureIn, user: dict = Depends(require_roles("md", "admin"))):
    await db.fee_structure.update_one(
        {"class_name": class_name},
        {"$set": {"class_name": class_name, "monthly_amount": body.monthly_amount, "updated_at": now_utc()}},
        upsert=True,
    )
    return {"class_name": class_name, "monthly_amount": body.monthly_amount}


# -------------------- Academic Year --------------------
class AcademicYearIn(BaseModel):
    year_label: str
    start_date: str
    end_date: str
    notes: Optional[str] = None


@api.get("/academic-year")
async def list_academic_years(user: dict = Depends(get_current_user)):
    items = await db.academic_years.find().to_list(200)
    return [{
        "class_name": it["class_name"],
        "year_label": it.get("year_label"),
        "start_date": it.get("start_date"),
        "end_date": it.get("end_date"),
        "notes": it.get("notes"),
    } for it in items]


@api.put("/academic-year/{class_name}")
async def upsert_academic_year(class_name: str, body: AcademicYearIn, user: dict = Depends(require_roles("md", "admin"))):
    await db.academic_years.update_one(
        {"class_name": class_name},
        {"$set": {"class_name": class_name, **body.dict(), "updated_at": now_utc()}},
        upsert=True,
    )
    return {"class_name": class_name, **body.dict()}


# -------------------- Curriculum (admin/md) --------------------
class CurriculumIn(BaseModel):
    year_label: str
    content: str


@api.get("/curriculum")
async def list_curriculum(user: dict = Depends(get_current_user)):
    items = await db.curriculum.find().to_list(200)
    return [{
        "class_name": it["class_name"],
        "year_label": it.get("year_label", ""),
        "content": it.get("content", ""),
        "updated_at": it.get("updated_at").isoformat() if it.get("updated_at") else None,
    } for it in items]


@api.put("/curriculum/{class_name}")
async def upsert_curriculum(class_name: str, body: CurriculumIn, user: dict = Depends(require_roles("admin", "md"))):
    await db.curriculum.update_one(
        {"class_name": class_name},
        {"$set": {
            "class_name": class_name,
            "year_label": body.year_label,
            "content": body.content,
            "updated_at": now_utc(),
        }},
        upsert=True,
    )
    return {"class_name": class_name, "year_label": body.year_label, "content": body.content}


# -------------------- Events --------------------
class EventIn(BaseModel):
    title: str
    description: str
    date: str
    class_name: Optional[str] = None


def serialize_event(e: dict) -> dict:
    return {
        "id": e.get("id"),
        "title": e.get("title"),
        "description": e.get("description"),
        "date": e.get("date"),
        "class_name": e.get("class_name"),
        "created_at": e.get("created_at").isoformat() if e.get("created_at") else None,
    }


@api.get("/events/this-week")
async def events_this_week(user: dict = Depends(get_current_user)):
    today = now_utc().date()
    end = today + timedelta(days=7)
    items = await db.events.find({"date": {"$gte": today.strftime("%Y-%m-%d"), "$lte": end.strftime("%Y-%m-%d")}}).sort("date", 1).to_list(200)
    return [serialize_event(e) for e in items]


@api.post("/events")
async def create_event(body: EventIn, user: dict = Depends(require_roles("md", "admin"))):
    doc = {"id": str(uuid.uuid4()), "created_by": user["id"], "created_at": now_utc(), **body.dict()}
    await db.events.insert_one(doc)
    return serialize_event(doc)


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(require_roles("md", "admin"))):
    res = await db.events.delete_one({"id": event_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Deleted"}


# -------------------- Homework --------------------
class HomeworkIn(BaseModel):
    class_name: str
    title: str
    description: str
    due_date: Optional[str] = None
    attachment_base64: Optional[str] = None


def serialize_homework(h: dict) -> dict:
    return {
        "id": h.get("id"),
        "class_name": h.get("class_name"),
        "title": h.get("title"),
        "description": h.get("description"),
        "due_date": h.get("due_date"),
        "attachment_base64": h.get("attachment_base64"),
        "uploader_name": h.get("uploader_name"),
        "created_at": h.get("created_at").isoformat() if h.get("created_at") else None,
    }


@api.get("/homework")
async def list_homework(user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        s = await db.students.find_one({"parent_phone": user.get("phone")})
        if not s:
            return []
        items = await db.homework.find({"class_name": s.get("class_name")}).sort("created_at", -1).to_list(100)
    elif user["role"] == "teacher":
        u = await db.users.find_one({"id": user["id"]})
        cls = u.get("class_name") if u else None
        q = {"class_name": cls} if cls else {}
        items = await db.homework.find(q).sort("created_at", -1).to_list(100)
    else:
        items = await db.homework.find().sort("created_at", -1).to_list(200)
    return [serialize_homework(h) for h in items]


@api.post("/homework")
async def create_homework(body: HomeworkIn, user: dict = Depends(require_roles("teacher", "admin", "md"))):
    doc = {
        "id": str(uuid.uuid4()),
        "uploaded_by": user["id"],
        "uploader_name": user["name"],
        "created_at": now_utc(),
        **body.dict(),
    }
    await db.homework.insert_one(doc)
    return serialize_homework(doc)


@api.delete("/homework/{hw_id}")
async def delete_homework(hw_id: str, user: dict = Depends(require_roles("teacher", "admin", "md"))):
    res = await db.homework.delete_one({"id": hw_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}


# -------------------- Announcements --------------------
class AnnouncementIn(BaseModel):
    title: str
    description: str
    photos_base64: List[str] = []
    class_name: Optional[str] = None


def serialize_announcement(a: dict) -> dict:
    return {
        "id": a.get("id"),
        "title": a.get("title"),
        "description": a.get("description"),
        "photos_base64": a.get("photos_base64", []),
        "class_name": a.get("class_name"),
        "uploader_name": a.get("uploader_name"),
        "created_at": a.get("created_at").isoformat() if a.get("created_at") else None,
    }


@api.get("/announcements")
async def list_announcements(user: dict = Depends(get_current_user)):
    items = await db.announcements.find().sort("created_at", -1).to_list(100)
    return [serialize_announcement(a) for a in items]


@api.post("/announcements")
async def create_announcement(body: AnnouncementIn, user: dict = Depends(require_roles("admin", "md"))):
    doc = {
        "id": str(uuid.uuid4()),
        "uploaded_by": user["id"],
        "uploader_name": user["name"],
        "created_at": now_utc(),
        **body.dict(),
    }
    await db.announcements.insert_one(doc)
    return serialize_announcement(doc)


@api.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, user: dict = Depends(require_roles("admin", "md"))):
    res = await db.announcements.delete_one({"id": ann_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}


# -------------------- Complaints --------------------
class ComplaintIn(BaseModel):
    student_id: str
    subject: str
    description: str


def serialize_complaint(c: dict) -> dict:
    return {
        "id": c.get("id"),
        "parent_id": c.get("parent_id"),
        "parent_name": c.get("parent_name"),
        "student_id": c.get("student_id"),
        "student_name": c.get("student_name"),
        "subject": c.get("subject"),
        "description": c.get("description"),
        "status": c.get("status"),
        "resolution_note": c.get("resolution_note"),
        "created_at": c.get("created_at").isoformat() if c.get("created_at") else None,
        "resolved_at": c.get("resolved_at").isoformat() if c.get("resolved_at") else None,
    }


@api.post("/complaints")
async def create_complaint(body: ComplaintIn, user: dict = Depends(require_roles("parent"))):
    s = await db.students.find_one({"id": body.student_id})
    if not s or s.get("parent_phone") != user.get("phone"):
        raise HTTPException(status_code=403, detail="Not your child")
    doc = {
        "id": str(uuid.uuid4()),
        "parent_id": user["id"],
        "parent_name": user["name"],
        "student_id": body.student_id,
        "student_name": s.get("name"),
        "subject": body.subject,
        "description": body.description,
        "status": "open",
        "resolution_note": None,
        "created_at": now_utc(),
        "resolved_at": None,
    }
    await db.complaints.insert_one(doc)
    return serialize_complaint(doc)


@api.get("/complaints")
async def list_complaints(user: dict = Depends(get_current_user)):
    if user["role"] == "parent":
        items = await db.complaints.find({"parent_id": user["id"]}).sort("created_at", -1).to_list(200)
    elif user["role"] in ("admin", "md"):
        items = await db.complaints.find().sort("created_at", -1).to_list(500)
    else:
        raise HTTPException(status_code=403, detail="Forbidden")
    return [serialize_complaint(c) for c in items]


@api.post("/complaints/{cid}/resolve")
async def resolve_complaint(cid: str, note: str = "", user: dict = Depends(require_roles("admin", "md"))):
    res = await db.complaints.update_one(
        {"id": cid},
        {"$set": {"status": "resolved", "resolved_at": now_utc(), "resolved_by": user["id"], "resolution_note": note}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    c = await db.complaints.find_one({"id": cid})
    return serialize_complaint(c)


# -------------------- Staff Attendance --------------------
class StaffAttendanceIn(BaseModel):
    user_id: str
    date: str
    status: Literal["present", "absent"]


def serialize_staff_att(a: dict) -> dict:
    return {
        "id": a.get("id"),
        "user_id": a.get("user_id"),
        "date": a.get("date"),
        "status": a.get("status"),
        "marked_by": a.get("marked_by"),
    }


@api.post("/staff-attendance")
async def mark_staff_attendance(body: StaffAttendanceIn, user: dict = Depends(require_roles("admin", "md"))):
    existing = await db.staff_attendance.find_one({"user_id": body.user_id, "date": body.date})
    if existing:
        await db.staff_attendance.update_one({"id": existing["id"]}, {"$set": {"status": body.status, "marked_by": user["id"]}})
        r = await db.staff_attendance.find_one({"id": existing["id"]})
        return serialize_staff_att(r)
    doc = {"id": str(uuid.uuid4()), "user_id": body.user_id, "date": body.date, "status": body.status, "marked_by": user["id"], "created_at": now_utc()}
    await db.staff_attendance.insert_one(doc)
    return serialize_staff_att(doc)


@api.get("/staff-attendance/today")
async def staff_attendance_today(user: dict = Depends(require_roles("admin", "md"))):
    today = now_utc().strftime("%Y-%m-%d")
    staff = await db.users.find({"role": {"$in": ["teacher", "admin"]}}, {"_id": 0, "password_hash": 0}).to_list(500)
    marks = {a["user_id"]: a["status"] for a in await db.staff_attendance.find({"date": today}).to_list(500)}
    out = [{
        **serialize_user(s),
        "class_name": s.get("class_name"),
        "status": marks.get(s["id"]),
    } for s in staff]
    present = sum(1 for x in out if x["status"] == "present")
    absent = sum(1 for x in out if x["status"] == "absent")
    return {"date": today, "present": present, "absent": absent, "unmarked": len(out) - present - absent, "total": len(out), "staff": out}


# -------------------- Class occupancy --------------------
@api.get("/stats/class-occupancy")
async def class_occupancy(user: dict = Depends(require_roles("md", "admin"))):
    students = await db.students.find().to_list(2000)
    by_class: dict = {}
    for s in students:
        cls = s.get("class_name") or "Unassigned"
        by_class[cls] = by_class.get(cls, 0) + 1
    return [{"class_name": k, "count": v} for k, v in sorted(by_class.items())]


# -------------------- MD fee views --------------------
@api.get("/reports/fees-by-class")
async def fees_by_class(user: dict = Depends(require_roles("md"))):
    students = await db.students.find().to_list(2000)
    stud_map = {s["id"]: s for s in students}
    pays = await db.payments.find().to_list(5000)
    by_class: dict = {}
    for p in pays:
        s = stud_map.get(p["student_id"])
        cls = (s or {}).get("class_name") or "Unassigned"
        b = by_class.setdefault(cls, {"paid": 0.0, "pending": 0.0, "paid_count": 0, "pending_count": 0})
        if p["status"] == "paid":
            b["paid"] += p["amount"]
            b["paid_count"] += 1
        else:
            b["pending"] += p["amount"]
            b["pending_count"] += 1
    return [{"class_name": k, **v} for k, v in sorted(by_class.items())]


@api.get("/students/{student_id}/fees-summary")
async def student_fees_summary(student_id: str, user: dict = Depends(require_roles("md"))):
    s = await db.students.find_one({"id": student_id})
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    pays = await db.payments.find({"student_id": student_id}).sort("created_at", -1).to_list(200)
    paid = sum(p["amount"] for p in pays if p["status"] == "paid")
    pending = sum(p["amount"] for p in pays if p["status"] == "pending")
    return {
        "student": serialize_student(s),
        "total_paid": paid,
        "total_pending": pending,
        "payments": [serialize_payment(p) for p in pays],
    }


# -------------------- Razorpay (mocked) --------------------
class RazorpayInitIn(BaseModel):
    student_id: str
    amount: float
    description: Optional[str] = "Monthly Fee"


class RazorpayVerifyIn(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


@api.post("/payments/razorpay/initiate")
async def razorpay_initiate(body: RazorpayInitIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "student_id": body.student_id,
        "amount": body.amount,
        "status": "pending",
        "transaction_id": None,
        "description": body.description or "Monthly Fee",
        "gateway": "razorpay",
        "created_at": now_utc(),
        "paid_at": None,
    }
    await db.payments.insert_one(doc)
    return {
        "payment": serialize_payment(doc),
        "razorpay_order_id": f"order_MOCK_{uuid.uuid4().hex[:12]}",
        "razorpay_key_id": "rzp_test_MOCKED",
        "amount_paise": int(body.amount * 100),
        "currency": "INR",
    }


@api.post("/payments/razorpay/verify")
async def razorpay_verify(body: RazorpayVerifyIn, user: dict = Depends(get_current_user)):
    p = await db.payments.find_one({"id": body.payment_id})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    txn = body.razorpay_payment_id or f"pay_MOCK_{uuid.uuid4().hex[:12]}"
    await db.payments.update_one(
        {"id": body.payment_id},
        {"$set": {"status": "paid", "transaction_id": txn, "razorpay_order_id": body.razorpay_order_id, "paid_at": now_utc()}},
    )
    p = await db.payments.find_one({"id": body.payment_id})
    return serialize_payment(p)


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


async def seed_schedules():
    """Seed a weekly schedule for the Sunshine class (Mon-Fri) — idempotent."""
    existing = await db.schedules.count_documents({"class_name": "Sunshine"})
    if existing > 0:
        return
    base = [
        {"start_time": "09:00", "end_time": "09:30", "activity": "Morning Circle & Songs", "icon": "sunny"},
        {"start_time": "09:30", "end_time": "10:15", "activity": "Phonics & Storytime", "icon": "book"},
        {"start_time": "10:15", "end_time": "10:45", "activity": "Healthy Snack", "icon": "nutrition"},
        {"start_time": "10:45", "end_time": "11:30", "activity": "Arts & Crafts", "icon": "color-palette"},
        {"start_time": "11:30", "end_time": "12:15", "activity": "Outdoor Play", "icon": "leaf"},
        {"start_time": "12:15", "end_time": "13:00", "activity": "Lunch & Rest", "icon": "restaurant"},
        {"start_time": "13:00", "end_time": "13:45", "activity": "Numbers & Puzzles", "icon": "calculator"},
        {"start_time": "13:45", "end_time": "14:30", "activity": "Music & Movement", "icon": "musical-notes"},
    ]
    docs = []
    for dow in range(0, 5):  # Mon-Fri
        for b in base:
            docs.append({
                "id": str(uuid.uuid4()),
                "class_name": "Sunshine",
                "day_of_week": dow,
                **b,
            })
    # Weekend light schedule
    for dow in (5, 6):
        docs.append({
            "id": str(uuid.uuid4()),
            "class_name": "Sunshine",
            "day_of_week": dow,
            "start_time": "10:00",
            "end_time": "11:00",
            "activity": "Weekend Fun Club (Optional)",
            "icon": "happy",
        })
    await db.schedules.insert_many(docs)


async def seed_extras():
    """Seed fee structure, academic years, salaries, sample events/announcements/homework."""
    # Fee structure
    if await db.fee_structure.count_documents({}) == 0:
        for cls, amt in [("Playgroup", 6500), ("Nursery", 7500), ("LKG", 8500), ("UKG", 9500), ("Sunshine", 8500)]:
            await db.fee_structure.insert_one({"class_name": cls, "monthly_amount": amt, "updated_at": now_utc()})

    # Academic years (per-class group)
    if await db.academic_years.count_documents({}) == 0:
        for cls in ["Playgroup", "Nursery", "LKG", "UKG", "Sunshine"]:
            await db.academic_years.insert_one({
                "class_name": cls,
                "year_label": "2026-27",
                "start_date": "2026-06-15",
                "end_date": "2027-04-15",
                "notes": f"Academic session for {cls}",
                "updated_at": now_utc(),
            })

    # Salaries (seed for existing staff if not set)
    staff_defaults = {"teacher": 35000, "admin": 45000}
    staff = await db.users.find({"role": {"$in": ["teacher", "admin"]}}).to_list(500)
    for s in staff:
        if not await db.salaries.find_one({"user_id": s["id"]}):
            await db.salaries.insert_one({
                "user_id": s["id"],
                "monthly_amount": staff_defaults.get(s["role"], 30000),
                "currency": "INR",
                "notes": None,
                "updated_at": now_utc(),
            })

    # Events this week
    if await db.events.count_documents({}) == 0:
        base = now_utc().date()
        events = [
            {"title": "Sports Day Practice", "description": "All students to wear house colors", "date": (base + timedelta(days=1)).strftime("%Y-%m-%d")},
            {"title": "Story Reading Circle", "description": "Special guest storyteller visit", "date": (base + timedelta(days=3)).strftime("%Y-%m-%d")},
            {"title": "Parent-Teacher Meeting", "description": "Term 1 progress discussion", "date": (base + timedelta(days=5)).strftime("%Y-%m-%d")},
        ]
        for e in events:
            await db.events.insert_one({"id": str(uuid.uuid4()), "created_by": "seed", "created_at": now_utc(), "class_name": None, **e})

    # Announcements
    if await db.announcements.count_documents({}) == 0:
        await db.announcements.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Welcome back to a new week!",
            "description": "This week we celebrate creativity — art and craft themes daily. Please send an old t-shirt for painting Wednesday.",
            "photos_base64": [],
            "class_name": None,
            "uploaded_by": "seed",
            "uploader_name": "Dr. Meera Iyer",
            "created_at": now_utc() - timedelta(hours=6),
        })

    # Homework
    if await db.homework.count_documents({}) == 0:
        await db.homework.insert_one({
            "id": str(uuid.uuid4()),
            "class_name": "Sunshine",
            "title": "Color the Rainbow",
            "description": "Color the rainbow worksheet using the primary colors we learned today. Bring it back tomorrow!",
            "due_date": (now_utc().date() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "attachment_base64": None,
            "uploaded_by": "seed",
            "uploader_name": "Ms. Priya Sharma",
            "created_at": now_utc() - timedelta(hours=3),
        })


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
    await seed_schedules()
    await seed_extras()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
