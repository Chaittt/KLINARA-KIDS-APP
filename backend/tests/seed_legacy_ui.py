# Seeds a TEST_ legacy parent (no login) + student without fee plan for MD UI regression (Set fee plan / Set login)
import os, uuid
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
pid, sid = str(uuid.uuid4()), str(uuid.uuid4())
phone = "76" + str(uuid.uuid4().int % 100000000).zfill(8)
db.users.insert_one({"id": pid, "name": "TEST Legacy Parent", "phone": phone, "role": "parent",
                     "created_at": datetime.now(timezone.utc)})
db.students.insert_one({"id": sid, "name": "TEST_Legacy Kid", "class_name": "Nursery", "parent_phone": phone,
                        "parent_id": pid, "age": 3, "total_fees": None, "plan_type": None,
                        "created_at": datetime.now(timezone.utc)})
print(sid, pid, phone)
