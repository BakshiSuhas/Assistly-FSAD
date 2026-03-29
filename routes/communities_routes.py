from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from bson.objectid import ObjectId
from flask_socketio import emit, join_room

from models.community_model import (
    approve_join_request,
    create_join_request_by_name,
    can_manage_community,
    create_community,
    delete_community,
    ensure_default_communities,
    get_community,
    get_shared_communities,
    list_communities,
    invite_user_to_community,
    list_communities_scoped,
    list_community_direct_messages,
    list_members_for_chat,
    list_pending_invites_for_community,
    list_pending_invites_for_user,
    mark_direct_messages_read,
    reject_join_request,
    respond_to_invitation,
    request_to_join_community,
    send_community_direct_message,
)
from models.user_model import find_user_by_email


communities_bp = Blueprint("communities", __name__, url_prefix="/communities")
MAINTAINER_EMAIL = "2410030063@gmail.com"
SOCKET_ROOM_MEMBERS: dict[str, dict[str, set[str]]] = {}
SOCKET_SID_ROOMS: dict[str, set[str]] = {}


def is_maintainer() -> bool:
    return str(getattr(current_user, "email", "") or "").strip().lower() == MAINTAINER_EMAIL


def _resolve_chat_scope(db, community_id: str, other_user_id: str):
    community = get_community(db, community_id)
    if not community:
        return None, "not_found"

    members = community.get("members", [])
    if current_user.id not in members or other_user_id not in members:
        return None, "forbidden"

    return community, None


def _serialize_chat_messages(messages):
    rows = []
    for msg in messages:
        created_at = msg.get("created_at")
        rows.append(
            {
                "id": str(msg.get("_id")),
                "sender_id": str(msg.get("sender_id") or ""),
                "receiver_id": str(msg.get("receiver_id") or ""),
                "body": str(msg.get("body") or ""),
                "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
                "read_by": list(msg.get("read_by") or []),
                "read_at": msg.get("read_at").isoformat() if hasattr(msg.get("read_at"), "isoformat") else None,
            }
        )
    return rows


def _chat_room_name(community_id: str, user_a: str, user_b: str):
    parts = sorted([str(user_a), str(user_b)])
    return f"community-chat:{community_id}:{parts[0]}:{parts[1]}"


def register_chat_socket_handlers(socketio):
    def _track_socket_in_room(room: str, user_id: str, sid: str):
        room_state = SOCKET_ROOM_MEMBERS.setdefault(room, {})
        user_sids = room_state.setdefault(user_id, set())
        user_sids.add(sid)
        SOCKET_SID_ROOMS.setdefault(sid, set()).add(room)

    def _untrack_socket(sid: str):
        rooms = SOCKET_SID_ROOMS.pop(sid, set())
        for room in rooms:
            room_state = SOCKET_ROOM_MEMBERS.get(room)
            if not room_state:
                continue
            remove_users = []
            for user_id, sid_set in room_state.items():
                sid_set.discard(sid)
                if not sid_set:
                    remove_users.append(user_id)
            for user_id in remove_users:
                room_state.pop(user_id, None)
            if not room_state:
                SOCKET_ROOM_MEMBERS.pop(room, None)

    def _is_user_online_in_room(room: str, user_id: str):
        return bool(SOCKET_ROOM_MEMBERS.get(room, {}).get(user_id))

    @socketio.on("disconnect")
    def handle_disconnect():
        if not current_user.is_authenticated:
            return
        sid = str(request.sid)
        disconnected_user = current_user.id
        rooms = list(SOCKET_SID_ROOMS.get(sid, set()))
        _untrack_socket(sid)
        for room in rooms:
            emit(
                "chat_presence",
                {
                    "user_id": disconnected_user,
                    "is_online": _is_user_online_in_room(room, disconnected_user),
                },
                to=room,
            )

    @socketio.on("join_chat")
    def handle_join_chat(payload):
        if not current_user.is_authenticated:
            emit("chat_error", {"message": "Authentication required."})
            return

        db = current_app.db
        data = payload or {}
        target_user_id = str(data.get("target_user_id", "")).strip()
        community_id = str(data.get("community_id", "")).strip()
        if not target_user_id or not community_id:
            emit("chat_error", {"message": "Invalid chat scope."})
            return

        _, error = _resolve_chat_scope(db, community_id, target_user_id)
        if error:
            emit("chat_error", {"message": "Forbidden."})
            return

        room = _chat_room_name(community_id, current_user.id, target_user_id)
        join_room(room)
        _track_socket_in_room(room, current_user.id, str(request.sid))

        mark_direct_messages_read(db, community_id, current_user.id, target_user_id)

        messages = list_community_direct_messages(db, community_id, current_user.id, target_user_id)
        emit(
            "chat_snapshot",
            {
                "community_id": community_id,
                "target_user_id": target_user_id,
                "messages": _serialize_chat_messages(messages),
            },
            to=room,
        )

        emit(
            "chat_presence",
            {
                "user_id": current_user.id,
                "is_online": True,
            },
            to=room,
        )

        emit(
            "chat_presence",
            {
                "user_id": target_user_id,
                "is_online": _is_user_online_in_room(room, target_user_id),
            },
        )

    @socketio.on("send_chat_message")
    def handle_send_chat_message(payload):
        if not current_user.is_authenticated:
            emit("chat_error", {"message": "Authentication required."})
            return

        db = current_app.db
        data = payload or {}
        target_user_id = str(data.get("target_user_id", "")).strip()
        community_id = str(data.get("community_id", "")).strip()
        message = str(data.get("message", "")).strip()
        if not target_user_id or not community_id:
            emit("chat_error", {"message": "Invalid chat scope."})
            return

        _, error = _resolve_chat_scope(db, community_id, target_user_id)
        if error:
            emit("chat_error", {"message": "Forbidden."})
            return

        status = send_community_direct_message(db, community_id, current_user.id, target_user_id, message)
        if status != "sent":
            emit("chat_error", {"message": "Message was not sent."})
            return

        room = _chat_room_name(community_id, current_user.id, target_user_id)
        messages = list_community_direct_messages(db, community_id, current_user.id, target_user_id)
        emit(
            "chat_snapshot",
            {
                "community_id": community_id,
                "target_user_id": target_user_id,
                "messages": _serialize_chat_messages(messages),
            },
            to=room,
        )

    @socketio.on("typing")
    def handle_typing(payload):
        if not current_user.is_authenticated:
            return

        db = current_app.db
        data = payload or {}
        target_user_id = str(data.get("target_user_id", "")).strip()
        community_id = str(data.get("community_id", "")).strip()
        is_typing = bool(data.get("is_typing", False))
        if not target_user_id or not community_id:
            return

        _, error = _resolve_chat_scope(db, community_id, target_user_id)
        if error:
            return

        room = _chat_room_name(community_id, current_user.id, target_user_id)
        emit(
            "chat_typing",
            {
                "user_id": current_user.id,
                "is_typing": is_typing,
                "community_id": community_id,
                "target_user_id": target_user_id,
            },
            to=room,
        )

    @socketio.on("mark_read")
    def handle_mark_read(payload):
        if not current_user.is_authenticated:
            return

        db = current_app.db
        data = payload or {}
        target_user_id = str(data.get("target_user_id", "")).strip()
        community_id = str(data.get("community_id", "")).strip()
        if not target_user_id or not community_id:
            return

        _, error = _resolve_chat_scope(db, community_id, target_user_id)
        if error:
            return

        mark_direct_messages_read(db, community_id, current_user.id, target_user_id)
        room = _chat_room_name(community_id, current_user.id, target_user_id)
        messages = list_community_direct_messages(db, community_id, current_user.id, target_user_id)
        emit(
            "chat_snapshot",
            {
                "community_id": community_id,
                "target_user_id": target_user_id,
                "messages": _serialize_chat_messages(messages),
            },
            to=room,
        )


@communities_bp.route("/")
@login_required
def communities_page():
    db = current_app.db
    ensure_default_communities(db)
    search = request.args.get("q", "").strip()
    communities = list_communities_scoped(db, current_user.id, include_all=is_maintainer(), search=search or None)
    all_community_names = [str(c.get("name", "")).strip() for c in list_communities(db)]

    manageable_communities = []
    pending_user_ids: set[str] = set()
    admin_ids: set[str] = set()

    for community in communities:
        members = community.get("members", [])
        pending = community.get("pending_requests", [])

        community["is_member"] = current_user.id in members
        community["is_pending"] = current_user.id in pending
        community["can_manage"] = is_maintainer() or can_manage_community(community, current_user.id, current_user.role)
        community["member_count"] = len(members)

        if community.get("admin_id"):
            admin_ids.add(str(community.get("admin_id")))

        if community["can_manage"]:
            manageable_communities.append(community)
            for user_id in pending:
                pending_user_ids.add(user_id)

    user_name_map: dict[str, str] = {}
    pending_object_ids = []
    for user_id in pending_user_ids:
        try:
            pending_object_ids.append(ObjectId(user_id))
        except Exception:
            continue

    admin_object_ids = []
    for user_id in admin_ids:
        try:
            admin_object_ids.append(ObjectId(user_id))
        except Exception:
            continue

    lookup_ids = pending_object_ids + admin_object_ids
    if lookup_ids:
        user_docs = db["users"].find({"_id": {"$in": lookup_ids}}, {"name": 1, "email": 1})
        user_name_map = {
            str(doc["_id"]): doc.get("name") or doc.get("email") or "Unknown User"
            for doc in user_docs
        }

    for community in manageable_communities:
        community["pending_users"] = [
            {
                "id": user_id,
                "name": user_name_map.get(user_id, "Unknown User"),
            }
            for user_id in community.get("pending_requests", [])
        ]
        admin_id = str(community.get("admin_id") or "")
        community["admin_name"] = user_name_map.get(admin_id, "Unassigned") if admin_id else "Unassigned"

        invite_docs = list_pending_invites_for_community(db, community.get("_id"))
        community["pending_invites"] = [
            {
                "id": str(doc.get("_id")),
                "target_user_id": str(doc.get("target_user_id") or ""),
                "target_name": user_name_map.get(str(doc.get("target_user_id") or ""), "User"),
            }
            for doc in invite_docs
        ]

    my_invites = []
    for invite in list_pending_invites_for_user(db, current_user.id):
        admin_id = str(invite.get("admin_user_id") or "")
        my_invites.append(
            {
                "id": str(invite.get("_id")),
                "community_name": invite.get("community_name", "Community"),
                "admin_name": user_name_map.get(admin_id, "Community Admin"),
            }
        )

    return render_template(
        "communities.html",
        communities=communities,
        all_community_names=all_community_names,
        query=search,
        is_maintainer=is_maintainer(),
        my_invites=my_invites,
    )


@communities_bp.route("/<community_id>/join", methods=["POST"])
@login_required
def join(community_id):
    status = request_to_join_community(current_app.db, community_id, current_user.id)
    if status == "not_found":
        flash("Community not found.", "danger")
    elif status == "already_member":
        flash("You are already a member of this community.", "info")
    elif status == "already_requested":
        flash("Your join request is already pending approval.", "warning")
    else:
        flash("Join request sent. Waiting for community admin approval.", "success")

    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/join-by-name", methods=["POST"])
@login_required
def join_by_name():
    name = request.form.get("community_name", "")
    status = create_join_request_by_name(current_app.db, current_user.id, name)
    if status == "invalid":
        flash("Community name is required.", "warning")
    elif status == "not_found":
        flash("Community not found.", "danger")
    elif status == "no_admin":
        flash("This community does not have an assigned admin yet.", "warning")
    elif status == "already_member":
        flash("You are already a member of this community.", "info")
    elif status == "already_requested":
        flash("Your join request is already pending approval.", "warning")
    else:
        flash("Join request sent to community admin.", "success")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/<community_id>/approve/<user_id>", methods=["POST"])
@login_required
def approve_request(community_id, user_id):
    community = get_community(current_app.db, community_id)
    if not community:
        flash("Community not found.", "danger")
        return redirect(url_for("communities.communities_page"))

    if not (is_maintainer() or can_manage_community(community, current_user.id, current_user.role)):
        flash("Only this community's admin can approve requests.", "danger")
        return redirect(url_for("communities.communities_page"))

    approve_join_request(current_app.db, community_id, user_id)
    flash("Join request approved.", "success")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/<community_id>/reject/<user_id>", methods=["POST"])
@login_required
def reject_request(community_id, user_id):
    community = get_community(current_app.db, community_id)
    if not community:
        flash("Community not found.", "danger")
        return redirect(url_for("communities.communities_page"))

    if not (is_maintainer() or can_manage_community(community, current_user.id, current_user.role)):
        flash("Only this community's admin can reject requests.", "danger")
        return redirect(url_for("communities.communities_page"))

    reject_join_request(current_app.db, community_id, user_id)
    flash("Join request rejected.", "info")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/create", methods=["POST"])
@login_required
def create():
    if not is_maintainer():
        flash("Only maintainer can create communities.", "danger")
        return redirect(url_for("communities.communities_page"))

    name = request.form.get("name", "").strip()
    location = request.form.get("location", "").strip()
    if not name or not location:
        flash("Name and location are required.", "warning")
        return redirect(url_for("communities.communities_page"))

    admin_email = request.form.get("admin_email", "").strip().lower()
    admin_user = find_user_by_email(current_app.db, admin_email)
    if not admin_user or admin_user.get("role") != "admin":
        flash("A valid admin email is required for community assignment.", "warning")
        return redirect(url_for("communities.communities_page"))

    create_community(current_app.db, name, location, str(admin_user.get("_id")))
    flash("Community created.", "success")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/<community_id>/delete", methods=["POST"])
@login_required
def delete(community_id):
    if not is_maintainer():
        flash("Only maintainer can delete communities.", "danger")
        return redirect(url_for("communities.communities_page"))

    delete_community(current_app.db, community_id)
    flash("Community deleted.", "info")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/<community_id>/invite", methods=["POST"])
@login_required
def invite_user(community_id):
    community = get_community(current_app.db, community_id)
    if not community:
        flash("Community not found.", "danger")
        return redirect(url_for("communities.communities_page"))

    if not (is_maintainer() or can_manage_community(community, current_user.id, current_user.role)):
        flash("Only this community admin can send invites.", "danger")
        return redirect(url_for("communities.communities_page"))

    target_email = request.form.get("email", "").strip().lower()
    target_user = find_user_by_email(current_app.db, target_email)
    if not target_user:
        flash("User email not found.", "warning")
        return redirect(url_for("communities.communities_page"))

    result = invite_user_to_community(
        current_app.db,
        community_id,
        str(community.get("admin_id") or current_user.id),
        str(target_user.get("_id")),
    )

    if result == "not_found":
        flash("Community not found.", "danger")
    elif result == "forbidden":
        flash("Only assigned community admin can invite users.", "danger")
    elif result == "already_member":
        flash("User is already a member of this community.", "info")
    elif result == "already_invited":
        flash("Invite is already pending for this user.", "warning")
    elif result == "invalid":
        flash("Invalid invite request.", "warning")
    else:
        flash("Invitation sent.", "success")

    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/invites/<invite_id>/accept", methods=["POST"])
@login_required
def accept_invite(invite_id):
    result = respond_to_invitation(current_app.db, invite_id, current_user.id, accept=True)
    if result == "accepted":
        flash("Community invitation accepted.", "success")
    else:
        flash("Invitation not found.", "warning")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/invites/<invite_id>/reject", methods=["POST"])
@login_required
def reject_invite(invite_id):
    result = respond_to_invitation(current_app.db, invite_id, current_user.id, accept=False)
    if result == "rejected":
        flash("Community invitation rejected.", "info")
    else:
        flash("Invitation not found.", "warning")
    return redirect(url_for("communities.communities_page"))


@communities_bp.route("/chat", methods=["GET", "POST"])
@login_required
def personal_chat():
    db = current_app.db
    communities, member_ids = list_members_for_chat(db, current_user.id)

    if request.method == "POST":
        target_user_id = str(request.form.get("target_user_id", "")).strip()
        community_id = str(request.form.get("community_id", "")).strip()
        message = str(request.form.get("message", "")).strip()
        status = send_community_direct_message(db, community_id, current_user.id, target_user_id, message)
        if status == "sent":
            flash("Message sent.", "success")
        elif status == "forbidden":
            flash("You can chat only with users in the same community.", "danger")
        elif status == "not_found":
            flash("Community not found.", "danger")
        else:
            flash("Message cannot be empty.", "warning")

        return redirect(
            url_for(
                "communities.personal_chat",
                user_id=target_user_id,
                community_id=community_id,
            )
        )

    selected_user_id = str(request.args.get("user_id", "")).strip()
    selected_community_id = str(request.args.get("community_id", "")).strip()

    members = []
    name_map = {}
    object_ids = []
    for uid in member_ids:
        try:
            object_ids.append(ObjectId(uid))
        except Exception:
            continue
    if object_ids:
        for user_doc in db["users"].find({"_id": {"$in": object_ids}}, {"name": 1, "email": 1}):
            uid = str(user_doc.get("_id"))
            name_map[uid] = user_doc.get("name") or user_doc.get("email") or "User"

    for uid in member_ids:
        shared = get_shared_communities(db, current_user.id, uid)
        members.append(
            {
                "id": uid,
                "name": name_map.get(uid, "User"),
                "shared_communities": [
                    {
                        "id": str(c.get("_id")),
                        "name": c.get("name", "Community"),
                    }
                    for c in shared
                ],
            }
        )

    messages = []
    active_community = None
    if selected_user_id and selected_community_id:
        active_community = get_community(db, selected_community_id)
        if active_community:
            messages = list_community_direct_messages(db, selected_community_id, current_user.id, selected_user_id)

    return render_template(
        "community_chat.html",
        members=members,
        selected_user_id=selected_user_id,
        selected_community_id=selected_community_id,
        active_community=active_community,
        messages=messages,
        name_map=name_map,
    )


@communities_bp.route("/chat/messages")
@login_required
def chat_messages_api():
    db = current_app.db
    target_user_id = str(request.args.get("user_id", "")).strip()
    community_id = str(request.args.get("community_id", "")).strip()
    if not target_user_id or not community_id:
        return jsonify({"success": False, "message": "user_id and community_id are required."}), 400

    community, error = _resolve_chat_scope(db, community_id, target_user_id)
    if error == "not_found":
        return jsonify({"success": False, "message": "Community not found."}), 404
    if error == "forbidden":
        return jsonify({"success": False, "message": "Forbidden."}), 403

    mark_direct_messages_read(db, community_id, current_user.id, target_user_id)
    messages = list_community_direct_messages(db, community_id, current_user.id, target_user_id)
    return jsonify(
        {
            "success": True,
            "community": {
                "id": str(community.get("_id")),
                "name": community.get("name", "Community"),
            },
            "messages": _serialize_chat_messages(messages),
        }
    )


@communities_bp.route("/chat/send", methods=["POST"])
@login_required
def chat_send_api():
    db = current_app.db
    payload = request.get_json(silent=True) if request.is_json else request.form
    target_user_id = str(payload.get("target_user_id", "")).strip()
    community_id = str(payload.get("community_id", "")).strip()
    message = str(payload.get("message", "")).strip()

    if not target_user_id or not community_id:
        return jsonify({"success": False, "message": "target_user_id and community_id are required."}), 400

    _, error = _resolve_chat_scope(db, community_id, target_user_id)
    if error == "not_found":
        return jsonify({"success": False, "message": "Community not found."}), 404
    if error == "forbidden":
        return jsonify({"success": False, "message": "Forbidden."}), 403

    status = send_community_direct_message(db, community_id, current_user.id, target_user_id, message)
    if status == "invalid":
        return jsonify({"success": False, "message": "Message cannot be empty."}), 400
    if status == "not_found":
        return jsonify({"success": False, "message": "Community not found."}), 404
    if status == "forbidden":
        return jsonify({"success": False, "message": "Forbidden."}), 403

    mark_direct_messages_read(db, community_id, current_user.id, target_user_id)
    messages = list_community_direct_messages(db, community_id, current_user.id, target_user_id)
    return jsonify({"success": True, "messages": _serialize_chat_messages(messages)})
