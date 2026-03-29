from datetime import datetime
from bson.objectid import ObjectId


def _requests(db):
    return db["requests"]


def create_request(db, payload: dict, user_id: str, community_id: str | None = None):
    doc = {
        "title": payload["title"].strip(),
        "description": payload["description"].strip(),
        "category": payload["category"].strip(),
        "status": "Open",
        "user_id": user_id,
        "community_id": community_id,
        "accepted_by": None,
        "location": {
            "text": payload.get("location_text", "").strip(),
            "lat": payload.get("lat"),
            "lng": payload.get("lng"),
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    return _requests(db).insert_one(doc)


def list_user_requests(db, user_id: str):
    return list(_requests(db).find({"user_id": user_id}).sort("created_at", -1))


def list_open_requests_for_volunteer(db, user_id: str):
    return list(
        _requests(db)
        .find({"status": {"$in": ["Open", "In Progress"]}, "user_id": {"$ne": user_id}})
        .sort("created_at", -1)
    )


def list_open_requests_for_volunteer_in_communities(db, user_id: str, community_ids: list):
    """Get open requests from communities the user is a member of."""
    if not community_ids:
        return []
    
    return list(
        _requests(db)
        .find({
            "community_id": {"$in": community_ids},
            "status": {"$in": ["Open", "In Progress"]},
            "user_id": {"$ne": user_id}
        })
        .sort("created_at", -1)
    )


def list_all_requests(db):
    return list(_requests(db).find({}).sort("created_at", -1))


def update_request(db, request_id: str, user_id: str, payload: dict):
    return _requests(db).update_one(
        {"_id": ObjectId(request_id), "user_id": user_id},
        {
            "$set": {
                "title": payload["title"].strip(),
                "description": payload["description"].strip(),
                "category": payload["category"].strip(),
                "updated_at": datetime.utcnow(),
            }
        },
    )


def update_request_status(db, request_id: str, user_id: str, status: str):
    return _requests(db).update_one(
        {"_id": ObjectId(request_id), "user_id": user_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}},
    )


def delete_request(db, request_id: str, user_id: str):
    return _requests(db).delete_one({"_id": ObjectId(request_id), "user_id": user_id})


def delete_request_admin(db, request_id: str):
    return _requests(db).delete_one({"_id": ObjectId(request_id)})


def accept_request(db, request_id: str, volunteer_id: str):
    request_doc = _requests(db).find_one({"_id": ObjectId(request_id)})
    if not request_doc:
        return {"ok": False, "reason": "Request not found."}
    if request_doc.get("user_id") == volunteer_id:
        return {"ok": False, "reason": "You cannot accept your own request."}
    if request_doc.get("status") != "Open":
        return {"ok": False, "reason": "Request is no longer open."}

    updated = _requests(db).update_one(
        {"_id": ObjectId(request_id), "status": "Open"},
        {
            "$set": {
                "status": "In Progress",
                "accepted_by": volunteer_id,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return {"ok": updated.modified_count == 1, "reason": "Unable to accept request."}


def complete_request(db, request_id: str, volunteer_id: str):
    return _requests(db).update_one(
        {"_id": ObjectId(request_id), "accepted_by": volunteer_id, "status": "In Progress"},
        {"$set": {"status": "Completed", "updated_at": datetime.utcnow()}},
    )


def request_counts(db):
    total = _requests(db).count_documents({})
    completed = _requests(db).count_documents({"status": "Completed"})
    in_progress = _requests(db).count_documents({"status": "In Progress"})
    open_count = _requests(db).count_documents({"status": "Open"})
    return {
        "total": total,
        "completed": completed,
        "in_progress": in_progress,
        "open": open_count,
    }
