from datetime import datetime

from bson.objectid import ObjectId


def _admin_requests(db):
    return db["admin_access_requests"]


def _to_object_id(value: str):
    try:
        return ObjectId(value)
    except Exception:
        return None


def create_admin_access_request(db, user_id: str, community_id: str):
    existing_for_user = _admin_requests(db).find_one(
        {
            "user_id": user_id,
            "status": "pending",
        }
    )
    if existing_for_user:
        return {"ok": False, "reason": "already_pending_any"}

    existing = _admin_requests(db).find_one(
        {
            "user_id": user_id,
            "community_id": community_id,
            "status": "pending",
        }
    )
    if existing:
        return {"ok": False, "reason": "already_pending"}

    doc = {
        "user_id": user_id,
        "community_id": community_id,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "reviewed_by": None,
        "reviewed_at": None,
    }
    _admin_requests(db).insert_one(doc)
    return {"ok": True}


def list_pending_admin_access_requests(db):
    return list(_admin_requests(db).find({"status": "pending"}).sort("created_at", -1))


def get_latest_admin_access_request_for_user(db, user_id: str):
    return _admin_requests(db).find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)],
    )


def get_admin_access_request(db, request_id: str):
    oid = _to_object_id(request_id)
    if not oid:
        return None
    return _admin_requests(db).find_one({"_id": oid})


def set_admin_access_request_status(db, request_id: str, status: str, reviewer_id: str):
    oid = _to_object_id(request_id)
    if not oid:
        return None
    return _admin_requests(db).update_one(
        {"_id": oid, "status": "pending"},
        {
            "$set": {
                "status": status,
                "reviewed_by": reviewer_id,
                "reviewed_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )
