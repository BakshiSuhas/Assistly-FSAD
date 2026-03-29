from functools import wraps
from bson.objectid import ObjectId

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from models.admin_request_model import (
    get_admin_access_request,
    list_pending_admin_access_requests,
    set_admin_access_request_status,
)
from analytics.analytics import generate_admin_charts
from models.community_model import ensure_default_communities, list_communities, get_user_communities, get_community
from models.request_model import list_all_requests, list_open_requests_for_volunteer, list_open_requests_for_volunteer_in_communities, list_user_requests, request_counts
from models.user_model import count_total_users, list_users


dashboard_bp = Blueprint("dashboard", __name__)
MAINTAINER_EMAIL = "2410030063@gmail.com"


def is_maintainer() -> bool:
    return str(getattr(current_user, "email", "") or "").strip().lower() == MAINTAINER_EMAIL


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated or (current_user.role != "admin" and not is_maintainer()):
            flash("Admin access required.", "danger")
            return redirect(url_for("dashboard.user_dashboard"))
        return fn(*args, **kwargs)

    return wrapper


@dashboard_bp.route("/")
def index():
    return render_template("index.html")


@dashboard_bp.route("/dashboard")
@login_required
def dashboard():
    if current_user.role == "admin" or is_maintainer():
        return redirect(url_for("dashboard.admin_dashboard"))
    return redirect(url_for("dashboard.user_dashboard"))


@dashboard_bp.route("/dashboard/user")
@login_required
def user_dashboard():
    if current_user.role == "admin" or is_maintainer():
        return redirect(url_for("dashboard.admin_dashboard"))

    db = current_app.db
    ensure_default_communities(db)

    mode = current_user.doc.get("mode", "resident")
    my_requests = list_user_requests(db, current_user.id)
    
    # Get user's joined communities
    user_communities = get_user_communities(db, current_user.id)
    community_ids = [str(c["_id"]) for c in user_communities]
    
    # Only show volunteer requests from communities the user is a member of
    volunteer_pool = list_open_requests_for_volunteer_in_communities(db, current_user.id, community_ids)
    communities = list_communities(db)

    return render_template(
        "dashboard.html",
        mode=mode,
        my_requests=my_requests,
        volunteer_requests=volunteer_pool,
        communities=communities,
        user_communities=user_communities,
    )


@dashboard_bp.route("/dashboard/admin")
@login_required
@admin_required
def admin_dashboard():
    db = current_app.db
    ensure_default_communities(db)

    stats = request_counts(db)
    stats["total_users"] = count_total_users(db)
    communities = list_communities(db)

    request_counts_by_community: dict[str, int] = {}
    for row in db["requests"].aggregate([
        {"$match": {"community_id": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$community_id", "count": {"$sum": 1}}},
    ]):
        request_counts_by_community[str(row.get("_id"))] = int(row.get("count", 0))

    admin_user_ids: set[str] = set()
    for community in communities:
        admin_id = community.get("admin_id")
        if admin_id:
            admin_user_ids.add(admin_id)

    admin_name_map: dict[str, str] = {}
    admin_object_ids = []
    for user_id in admin_user_ids:
        try:
            admin_object_ids.append(ObjectId(user_id))
        except Exception:
            continue
    if admin_object_ids:
        admin_docs = db["users"].find({"_id": {"$in": admin_object_ids}}, {"name": 1})
        admin_name_map = {str(doc["_id"]): doc.get("name", "Unknown") for doc in admin_docs}

    pending_user_ids: set[str] = set()
    for community in communities:
        pending = community.get("pending_requests", [])
        community["pending_count"] = len(pending)
        community["request_count"] = request_counts_by_community.get(str(community["_id"]), 0)
        community["admin_name"] = admin_name_map.get(community.get("admin_id"), "Unassigned")
        for user_id in pending:
            pending_user_ids.add(user_id)

    user_name_map: dict[str, str] = {}
    pending_object_ids = []
    for user_id in pending_user_ids:
        try:
            pending_object_ids.append(ObjectId(user_id))
        except Exception:
            continue

    if pending_object_ids:
        user_docs = db["users"].find({"_id": {"$in": pending_object_ids}}, {"name": 1})
        user_name_map = {str(doc["_id"]): doc.get("name", "Unknown User") for doc in user_docs}

    for community in communities:
        community["pending_users"] = [
            {
                "id": user_id,
                "name": user_name_map.get(user_id, "Unknown User"),
            }
            for user_id in community.get("pending_requests", [])
        ]

    admin_access_requests = []
    can_manage_admin_requests = is_maintainer()
    if can_manage_admin_requests:
        admin_access_requests = list_pending_admin_access_requests(db)
        for req in admin_access_requests:
            requester = None
            community = None
            try:
                requester = db["users"].find_one({"_id": ObjectId(req["user_id"])}, {"name": 1, "email": 1})
            except Exception:
                requester = None
            try:
                community = db["communities"].find_one({"_id": ObjectId(req["community_id"])}, {"name": 1, "admin_id": 1})
            except Exception:
                community = None
            req["requester_name"] = requester.get("name", "Unknown") if requester else "Unknown"
            req["requester_email"] = requester.get("email", "Unknown") if requester else "Unknown"
            req["community_name"] = community.get("name", "Unknown") if community else "Unknown"
            req["community_has_admin"] = bool(community and community.get("admin_id"))

    charts = generate_admin_charts(db, "static/generated")

    return render_template(
        "admin_dashboard.html",
        stats=stats,
        users=list_users(db),
        requests=list_all_requests(db),
        communities=communities,
        admin_access_requests=admin_access_requests,
        can_manage_admin_requests=can_manage_admin_requests,
        charts=charts,
    )


@dashboard_bp.route("/dashboard/admin/community/<community_id>")
@login_required
@admin_required
def community_detail(community_id):
    if not is_maintainer():
        flash("Only the maintainer can access full community oversight.", "danger")
        return redirect(url_for("dashboard.admin_dashboard"))

    db = current_app.db
    community = get_community(db, community_id)
    if not community:
        flash("Community not found.", "danger")
        return redirect(url_for("dashboard.admin_dashboard"))

    admin_name = "Unassigned"
    admin_email = "N/A"
    admin_id = community.get("admin_id")
    if admin_id:
        try:
            admin_doc = db["users"].find_one({"_id": ObjectId(admin_id)}, {"name": 1, "email": 1})
            if admin_doc:
                admin_name = admin_doc.get("name", "Unknown")
                admin_email = admin_doc.get("email", "N/A")
        except Exception:
            pass

    member_name_map: dict[str, str] = {}
    member_ids = community.get("members", [])
    member_object_ids = []
    for user_id in member_ids:
        try:
            member_object_ids.append(ObjectId(user_id))
        except Exception:
            continue
    if member_object_ids:
        member_docs = db["users"].find({"_id": {"$in": member_object_ids}}, {"name": 1})
        member_name_map = {str(doc["_id"]): doc.get("name", "Unknown User") for doc in member_docs}

    members = [
        {
            "id": user_id,
            "name": member_name_map.get(user_id, "Unknown User"),
        }
        for user_id in member_ids
    ]

    requests = list(
        db["requests"].find({"community_id": str(community["_id"])}).sort("created_at", -1).limit(50)
    )

    admin_requests = list(
        db["admin_access_requests"].find({"community_id": str(community["_id"])}).sort("created_at", -1).limit(50)
    )
    admin_request_user_ids: set[str] = {str(item.get("user_id")) for item in admin_requests if item.get("user_id")}
    admin_req_name_map: dict[str, str] = {}
    admin_req_object_ids = []
    for user_id in admin_request_user_ids:
        try:
            admin_req_object_ids.append(ObjectId(user_id))
        except Exception:
            continue
    if admin_req_object_ids:
        req_users = db["users"].find({"_id": {"$in": admin_req_object_ids}}, {"name": 1})
        admin_req_name_map = {str(doc["_id"]): doc.get("name", "Unknown User") for doc in req_users}
    for item in admin_requests:
        item["requester_name"] = admin_req_name_map.get(str(item.get("user_id")), "Unknown User")

    return render_template(
        "community_detail.html",
        community=community,
        members=members,
        admin_name=admin_name,
        admin_email=admin_email,
        community_requests=requests,
        admin_requests=admin_requests,
    )


@dashboard_bp.route("/dashboard/admin/access/<request_id>/approve", methods=["POST"])
@login_required
@admin_required
def approve_admin_access(request_id):
    if not is_maintainer():
        flash("Only the code maintainer can approve community admin requests.", "danger")
        return redirect(url_for("dashboard.admin_dashboard"))

    db = current_app.db
    req = get_admin_access_request(db, request_id)
    if not req or req.get("status") != "pending":
        flash("Admin access request not found or already handled.", "warning")
        return redirect(url_for("dashboard.admin_dashboard"))

    user_id = req.get("user_id")
    community_id = req.get("community_id")

    try:
        community_oid = ObjectId(community_id)
    except Exception:
        flash("Invalid community on request.", "danger")
        return redirect(url_for("dashboard.admin_dashboard"))

    community = db["communities"].find_one({"_id": community_oid})
    if not community:
        flash("Community not found for this request.", "danger")
        return redirect(url_for("dashboard.admin_dashboard"))

    if db["communities"].count_documents({"admin_id": user_id}) > 0:
        flash("Requester is already assigned as admin for another community.", "warning")
        set_admin_access_request_status(db, request_id, "rejected", current_user.id)
        return redirect(url_for("dashboard.admin_dashboard"))

    if community.get("admin_id") and community.get("admin_id") != user_id:
        flash("This community already has an admin. Remove/replace it first.", "warning")
        return redirect(url_for("dashboard.admin_dashboard"))

    db["communities"].update_one(
        {"_id": community_oid},
        {"$set": {"admin_id": user_id}, "$addToSet": {"members": user_id}},
    )
    set_admin_access_request_status(db, request_id, "approved", current_user.id)
    flash("Admin access approved and assigned to community.", "success")
    return redirect(url_for("dashboard.admin_dashboard"))


@dashboard_bp.route("/dashboard/admin/access/<request_id>/reject", methods=["POST"])
@login_required
@admin_required
def reject_admin_access(request_id):
    if not is_maintainer():
        flash("Only the code maintainer can reject community admin requests.", "danger")
        return redirect(url_for("dashboard.admin_dashboard"))

    updated = set_admin_access_request_status(current_app.db, request_id, "rejected", current_user.id)
    if not updated or updated.modified_count == 0:
        flash("Admin access request not found or already handled.", "warning")
    else:
        flash("Admin access request rejected.", "info")
    return redirect(url_for("dashboard.admin_dashboard"))


@dashboard_bp.route("/dashboard/mode", methods=["POST"])
@login_required
def switch_mode():
    if current_user.role == "admin":
        return jsonify({"success": False, "message": "Admin mode cannot be switched."}), 400

    mode = str(request.json.get("mode", "resident")).lower() if request.is_json else request.form.get("mode", "resident")
    if mode not in {"resident", "volunteer"}:
        return jsonify({"success": False, "message": "Invalid mode."}), 400

    current_app.db["users"].update_one({"_id": current_user.doc["_id"]}, {"$set": {"mode": mode}})
    return jsonify({"success": True, "mode": mode})


@dashboard_bp.route("/dashboard/location", methods=["POST"])
@login_required
def save_location():
    payload = request.get_json(silent=True) or {}
    lat = payload.get("lat")
    lng = payload.get("lng")

    current_app.db["users"].update_one(
        {"_id": current_user.doc["_id"]},
        {"$set": {"location": {"lat": lat, "lng": lng}}},
    )
    return jsonify({"success": True, "message": "Location saved."})


@dashboard_bp.route("/notifications")
@login_required
def notifications_poll():
    db = current_app.db
    # Simple polling endpoint for bonus live updates without page refresh.
    accepted = db["requests"].count_documents({"user_id": current_user.id, "status": "In Progress"})
    completed = db["requests"].count_documents({"user_id": current_user.id, "status": "Completed"})
    return jsonify({
        "accepted_count": accepted,
        "completed_count": completed,
    })
