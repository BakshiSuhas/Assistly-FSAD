from bson.objectid import ObjectId
from datetime import datetime
import re


def _communities(db):
    return db["communities"]


def _community_invites(db):
    return db["community_invites"]


def _community_messages(db):
    return db["community_messages"]


def _to_object_id(value: str):
    try:
        return ObjectId(value)
    except Exception:
        return None


def _normalize_community_name(value: str) -> str:
    """Normalize community names for tolerant equality checks."""
    return " ".join(str(value or "").strip().lower().split())


def _sanitize_community_shape(db, community: dict):
    """Normalize legacy community docs so list/set operations are always safe."""
    updates = {}

    members = community.get("members", [])
    if not isinstance(members, list):
        updates["members"] = []
        members = []

    pending = community.get("pending_requests", [])
    if not isinstance(pending, list):
        updates["pending_requests"] = []
        pending = []

    admin_id = community.get("admin_id")
    if admin_id is not None and not isinstance(admin_id, str):
        updates["admin_id"] = None

    if updates:
        _communities(db).update_one({"_id": community["_id"]}, {"$set": updates})
        community.update(updates)

    community["members"] = members
    community["pending_requests"] = pending
    return community


def ensure_default_communities(db):
    if _communities(db).count_documents({}) > 0:
        return

    _communities(db).insert_many(
        [
            {
                "name": "Green Meadows",
                "location": "North Zone",
                "members": [],
                "pending_requests": [],
                "admin_id": None,
            },
            {
                "name": "Lakeside Heights",
                "location": "East Zone",
                "members": [],
                "pending_requests": [],
                "admin_id": None,
            },
            {
                "name": "Central Harmony",
                "location": "City Center",
                "members": [],
                "pending_requests": [],
                "admin_id": None,
            },
            {
                "name": "Sunrise Colony",
                "location": "South Zone",
                "members": [],
                "pending_requests": [],
                "admin_id": None,
            },
        ]
    )


def list_communities(db, search: str | None = None):
    query = {}
    if search:
        query = {"name": {"$regex": search, "$options": "i"}}
    communities = list(_communities(db).find(query).sort("name", 1))
    return [_sanitize_community_shape(db, community) for community in communities]


def get_community(db, community_id: str):
    oid = _to_object_id(community_id)
    if not oid:
        return None

    community = _communities(db).find_one({"_id": oid})
    if not community:
        return None
    return _sanitize_community_shape(db, community)


def request_to_join_community(db, community_id: str, user_id: str):
    community = get_community(db, community_id)
    if not community:
        return "not_found"

    if user_id in community.get("members", []):
        return "already_member"

    if user_id in community.get("pending_requests", []):
        return "already_requested"

    _communities(db).update_one(
        {"_id": community["_id"]},
        {"$addToSet": {"pending_requests": user_id}},
    )
    return "requested"


def approve_join_request(db, community_id: str, user_id: str):
    community = get_community(db, community_id)
    if not community:
        return False

    _communities(db).update_one(
        {"_id": community["_id"]},
        {
            "$pull": {"pending_requests": user_id},
            "$addToSet": {"members": user_id},
        },
    )
    return True


def reject_join_request(db, community_id: str, user_id: str):
    community = get_community(db, community_id)
    if not community:
        return False

    _communities(db).update_one(
        {"_id": community["_id"]},
        {"$pull": {"pending_requests": user_id}},
    )
    return True


def can_manage_community(community: dict, user_id: str, role: str):
    # Only assigned community admin should manage community operations.
    return community.get("admin_id") == user_id


def create_community(db, name: str, location: str, admin_id: str | None = None):
    return _communities(db).insert_one(
        {
            "name": name.strip(),
            "location": location.strip(),
            "members": [],
            "pending_requests": [],
            "admin_id": admin_id,
        }
    )


def delete_community(db, community_id: str):
    oid = _to_object_id(community_id)
    if not oid:
        return None
    return _communities(db).delete_one({"_id": oid})


def get_user_communities(db, user_id: str):
    """Get all communities the user is a member of (approved requests only)."""
    communities = _communities(db).find({"members": user_id}).sort("name", 1)
    return [_sanitize_community_shape(db, c) for c in communities]


def list_communities_scoped(db, user_id: str, include_all: bool = False, search: str | None = None):
    base_query = {}
    if include_all:
        query = base_query
    else:
        query = {
            "$or": [
                {"members": user_id},
                {"pending_requests": user_id},
                {"admin_id": user_id},
            ]
        }

    if search:
        name_filter = {"name": {"$regex": search, "$options": "i"}}
        if "$or" in query:
            query = {"$and": [query, name_filter]}
        else:
            query.update(name_filter)

    communities = list(_communities(db).find(query).sort("name", 1))
    return [_sanitize_community_shape(db, community) for community in communities]


def create_join_request_by_name(db, user_id: str, community_name: str):
    name = str(community_name or "").strip()
    if not name:
        return "invalid"

    escaped_name = re.escape(name)
    community = _communities(db).find_one({"name": {"$regex": f"^{escaped_name}$", "$options": "i"}})

    # Fallback for partial name matches when user does not type exact punctuation/spacing.
    if not community:
        partial_matches = list(
            _communities(db)
            .find({"name": {"$regex": escaped_name, "$options": "i"}}, {"name": 1, "members": 1, "pending_requests": 1, "admin_id": 1})
            .limit(2)
        )
        if len(partial_matches) == 1:
            community = partial_matches[0]

    # Fallback for legacy data where names may include uneven internal spacing.
    if not community:
        normalized_target = _normalize_community_name(name)
        for candidate in _communities(db).find({}, {"name": 1, "members": 1, "pending_requests": 1, "admin_id": 1}):
            if _normalize_community_name(candidate.get("name", "")) == normalized_target:
                community = candidate
                break

    # Last fallback: token containment in normalized names (single best match only).
    if not community:
        normalized_target = _normalize_community_name(name)
        candidate_match = None
        for candidate in _communities(db).find({}, {"name": 1, "members": 1, "pending_requests": 1, "admin_id": 1}):
            normalized_candidate = _normalize_community_name(candidate.get("name", ""))
            if not normalized_candidate:
                continue
            if normalized_target in normalized_candidate or normalized_candidate in normalized_target:
                if candidate_match is not None:
                    candidate_match = None
                    break
                candidate_match = candidate
        community = candidate_match

    if not community:
        return "not_found"

    normalized = _sanitize_community_shape(db, community)
    if not normalized.get("admin_id"):
        return "no_admin"

    return request_to_join_community(db, str(normalized["_id"]), user_id)


def invite_user_to_community(db, community_id: str, admin_user_id: str, target_user_id: str):
    community = get_community(db, community_id)
    if not community:
        return "not_found"
    if community.get("admin_id") != admin_user_id:
        return "forbidden"
    if admin_user_id == target_user_id:
        return "invalid"
    if target_user_id in community.get("members", []):
        return "already_member"

    existing = _community_invites(db).find_one(
        {
            "community_id": str(community["_id"]),
            "target_user_id": target_user_id,
            "status": "pending",
        }
    )
    if existing:
        return "already_invited"

    _community_invites(db).insert_one(
        {
            "community_id": str(community["_id"]),
            "community_name": community.get("name", "Community"),
            "admin_user_id": admin_user_id,
            "target_user_id": target_user_id,
            "status": "pending",
        }
    )
    return "invited"


def list_pending_invites_for_user(db, user_id: str):
    return list(
        _community_invites(db)
        .find({"target_user_id": user_id, "status": "pending"})
        .sort("_id", -1)
    )


def list_pending_invites_for_community(db, community_id: str):
    return list(
        _community_invites(db)
        .find({"community_id": str(community_id), "status": "pending"})
        .sort("_id", -1)
    )


def respond_to_invitation(db, invite_id: str, user_id: str, accept: bool):
    oid = _to_object_id(invite_id)
    if not oid:
        return "not_found"

    invite = _community_invites(db).find_one({"_id": oid, "target_user_id": user_id, "status": "pending"})
    if not invite:
        return "not_found"

    status = "accepted" if accept else "rejected"
    _community_invites(db).update_one({"_id": oid}, {"$set": {"status": status}})
    if accept:
        approve_join_request(db, invite.get("community_id", ""), user_id)

    return status


def get_shared_communities(db, user_id: str, other_user_id: str):
    communities = list(
        _communities(db).find({"members": {"$all": [user_id, other_user_id]}}).sort("name", 1)
    )
    return [_sanitize_community_shape(db, c) for c in communities]


def list_members_for_chat(db, user_id: str):
    communities = get_user_communities(db, user_id)
    member_ids = set()
    for community in communities:
        for member_id in community.get("members", []):
            if member_id != user_id:
                member_ids.add(member_id)
    return communities, sorted(member_ids)


def _thread_participants(user_id: str, other_user_id: str):
    return sorted([str(user_id), str(other_user_id)])


def send_community_direct_message(db, community_id: str, sender_id: str, receiver_id: str, body: str):
    text = str(body or "").strip()
    if not text:
        return "invalid"

    community = get_community(db, community_id)
    if not community:
        return "not_found"

    members = community.get("members", [])
    if sender_id not in members or receiver_id not in members:
        return "forbidden"

    participants = _thread_participants(sender_id, receiver_id)
    _community_messages(db).insert_one(
        {
            "community_id": str(community["_id"]),
            "participants": participants,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "body": text,
            "created_at": datetime.utcnow(),
            "read_by": [sender_id],
            "read_at": None,
        }
    )
    return "sent"


def list_community_direct_messages(db, community_id: str, user_id: str, other_user_id: str, limit: int = 80):
    participants = _thread_participants(user_id, other_user_id)
    return list(
        _community_messages(db)
        .find(
            {
                "community_id": str(community_id),
                "participants": participants,
            }
        )
        .sort("_id", 1)
        .limit(max(1, min(limit, 200)))
    )


def mark_direct_messages_read(db, community_id: str, user_id: str, other_user_id: str):
    participants = _thread_participants(user_id, other_user_id)
    result = _community_messages(db).update_many(
        {
            "community_id": str(community_id),
            "participants": participants,
            "receiver_id": user_id,
        },
        {
            "$addToSet": {"read_by": user_id},
            "$set": {"read_at": datetime.utcnow()},
        },
    )
    return result.modified_count
