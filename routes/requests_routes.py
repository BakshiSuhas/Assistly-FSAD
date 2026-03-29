from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from models.request_model import (
    accept_request,
    complete_request,
    create_request,
    delete_request,
    delete_request_admin,
    list_user_requests,
    update_request,
    update_request_status,
)
from models.community_model import get_user_communities


requests_bp = Blueprint("requests", __name__, url_prefix="/requests")

ALLOWED_CATEGORIES = ["Medical", "Groceries", "Transportation", "Emergency", "Elderly Support"]
ALLOWED_STATUSES = {"Open", "In Progress", "Completed"}


@requests_bp.route("/create", methods=["GET"])
@login_required
def create_request_page():
    """Display the create request form with user's joined communities."""
    user_communities = get_user_communities(current_app.db, current_user.id)
    
    if not user_communities:
        flash("You must join a community before creating a request.", "warning")
        return redirect(url_for("communities.communities_page"))
    
    emergency = request.args.get("emergency", "0") == "1"
    return render_template(
        "create_request.html",
        communities=user_communities,
        emergency=emergency,
        categories=ALLOWED_CATEGORIES,
    )


def _validate_payload(form_or_json: dict):
    title = str(form_or_json.get("title", "")).strip()
    description = str(form_or_json.get("description", "")).strip()
    category = str(form_or_json.get("category", "")).strip()

    if not title or not description or not category:
        return None, "title, description, and category are required"
    if category not in ALLOWED_CATEGORIES:
        return None, "Invalid category"

    try:
        lat = float(form_or_json.get("lat")) if form_or_json.get("lat") not in (None, "") else None
        lng = float(form_or_json.get("lng")) if form_or_json.get("lng") not in (None, "") else None
    except ValueError:
        return None, "Invalid coordinates"

    return {
        "title": title,
        "description": description,
        "category": category,
        "location_text": str(form_or_json.get("location_text", "")).strip(),
        "lat": lat,
        "lng": lng,
    }, None


@requests_bp.route("/create", methods=["POST"])
@login_required
def create_request_route():
    community_id = request.form.get("community_id", "").strip()
    
    # Validate community_id
    if not community_id:
        flash("Please select a community.", "danger")
        return redirect(url_for("requests.create_request_page"))
    
    # Verify user is member of this community
    user_communities = get_user_communities(current_app.db, current_user.id)
    community_ids = [str(c["_id"]) for c in user_communities]
    
    if community_id not in community_ids:
        flash("You are not a member of this community.", "danger")
        return redirect(url_for("requests.create_request_page"))
    
    payload, error = _validate_payload(request.form)
    if error:
        flash(error, "danger")
        return redirect(url_for("requests.create_request_page"))

    create_request(current_app.db, payload, current_user.id, community_id)
    flash("Request created.", "success")
    return redirect(url_for("dashboard.user_dashboard"))


@requests_bp.route("/<request_id>/update", methods=["POST"])
@login_required
def update_request_route(request_id):
    payload, error = _validate_payload(request.form)
    if error:
        flash(error, "danger")
        return redirect(url_for("dashboard.user_dashboard"))

    result = update_request(current_app.db, request_id, current_user.id, payload)
    if result.matched_count == 0:
        flash("Request not found.", "warning")
    else:
        flash("Request updated.", "success")
    return redirect(url_for("dashboard.user_dashboard"))


@requests_bp.route("/<request_id>/status", methods=["POST"])
@login_required
def update_status_route(request_id):
    status = request.form.get("status", "Open")
    if status not in ALLOWED_STATUSES:
        flash("Invalid status.", "danger")
        return redirect(url_for("dashboard.user_dashboard"))

    result = update_request_status(current_app.db, request_id, current_user.id, status)
    if result.matched_count == 0:
        flash("Request not found.", "warning")
    else:
        flash("Status updated.", "success")
    return redirect(url_for("dashboard.user_dashboard"))


@requests_bp.route("/<request_id>/delete", methods=["POST"])
@login_required
def delete_request_route(request_id):
    if current_user.role == "admin":
        deleted = delete_request_admin(current_app.db, request_id)
    else:
        deleted = delete_request(current_app.db, request_id, current_user.id)

    if deleted.deleted_count == 0:
        flash("Request could not be deleted.", "warning")
    else:
        flash("Request deleted.", "info")
    return redirect(url_for("dashboard.dashboard"))


@requests_bp.route("/<request_id>/accept", methods=["POST"])
@login_required
def accept_request_route(request_id):
    outcome = accept_request(current_app.db, request_id, current_user.id)
    if not outcome["ok"]:
        flash(outcome["reason"], "warning")
    else:
        flash("Request accepted.", "success")
    return redirect(url_for("dashboard.user_dashboard"))


@requests_bp.route("/<request_id>/complete", methods=["POST"])
@login_required
def complete_request_route(request_id):
    result = complete_request(current_app.db, request_id, current_user.id)
    if result.modified_count == 0:
        flash("Only accepted requests can be completed by assigned volunteer.", "warning")
    else:
        flash("Request marked as completed.", "success")
    return redirect(url_for("dashboard.user_dashboard"))


# Bonus: AJAX endpoints for request operations.
@requests_bp.route("/api/mine")
@login_required
def my_requests_api():
    docs = list_user_requests(current_app.db, current_user.id)
    normalized = [
        {
            "id": str(doc["_id"]),
            "title": doc["title"],
            "status": doc["status"],
            "category": doc["category"],
        }
        for doc in docs
    ]
    return jsonify({"requests": normalized})
