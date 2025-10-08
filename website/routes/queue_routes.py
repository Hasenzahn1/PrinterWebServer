import time
from copy import deepcopy
from typing import TYPE_CHECKING
from flask import Blueprint, current_app, Response
from src.PrintJob import PrintJob

if TYPE_CHECKING: from src.PrintManager import PrintManager

bp = Blueprint("queue", __name__, url_prefix="/api/queues")

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/unlisted")
def unlisted():
    pm = get_pm()
    def event_stream():
        unlisted_copy = ""
        while True:
            if list_to_checksum(pm.unlisted) != unlisted_copy:
                js = job_list_to_json(pm.unlisted)
                yield f"data: {js}\n\n"
                unlisted_copy = list_to_checksum(pm.unlisted)
                continue

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
        queue_copy = ""
        while True:
            if list_to_checksum(pm.queue) != queue_copy:
                js = job_list_to_json(pm.queue)
                print(js)
                yield f"data: {js}\n\n"
                queue_copy = list_to_checksum(pm.queue)
                continue

            time.sleep(1)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }
    return Response(event_stream(), headers=headers)


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