import time
from copy import deepcopy
from typing import TYPE_CHECKING
from flask import Blueprint, current_app, Response, jsonify, request
from src.PrintJob import PrintJob

if TYPE_CHECKING: from src.PrintManager import PrintManager

bp = Blueprint("queue", __name__, url_prefix="/api/queues")

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/unlisted")
def unlisted():
    pm = get_pm()
    def event_stream():
        unlisted_copy = None
        while True:
            if list_to_checksum(pm.unlisted) != unlisted_copy:
                js = job_list_to_json(pm.unlisted)
                yield f"data: {js}\n\n"
                unlisted_copy = list_to_checksum(pm.unlisted)

            time.sleep(1)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }
    return Response(event_stream(), headers=headers)

@bp.route("/queue")
def queue():
    pm = get_pm()
    def event_stream():
        queue_copy = None
        while True:
            if list_to_checksum(pm.queue) != queue_copy:
                js = job_list_to_json(pm.queue)
                yield f"data: {js}\n\n"
                queue_copy = list_to_checksum(pm.queue)

            time.sleep(1)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }
    return Response(event_stream(), headers=headers)

@bp.route("/print", methods=["POST"])
def print_unlisted_job():
    pm = get_pm()
    if pm is None:
        return jsonify({"ok": False, "error": "PrintManager missing"}), 500

    data = request.get_json(silent=True) or {}
    uuid = data.get("uuid")
    if not uuid:
        return jsonify({"ok": False, "error": "Missing 'uuid'"}), 400

    # Unlisted nach UUID suchen
    idx = next((i for i, j in enumerate(pm.unlisted) if j.uuid == uuid), None)
    if idx is None:
        return jsonify({"ok": False, "error": "Job not found"}), 404

    job = pm.unlisted.pop(idx)
    pm.queue.append(job)

    return jsonify({"ok": True, "moved": True, "uuid": uuid})

def job_list_to_json(queue: list[PrintJob]) -> str:
    parsed_elements = []
    for element in queue:
        parsed_elements.append(element.to_json())
    return "[" + ", ".join(parsed_elements) + "]"

def list_to_checksum(queue: list[PrintJob]) -> str:
    result = ""
    for element in queue:
        result += element.uuid
    return result