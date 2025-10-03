import time
from flask import Blueprint, current_app, Response
import json
from typing import TYPE_CHECKING

if TYPE_CHECKING: from src.PrintManager import PrintManager

bp = Blueprint("current_job", __name__, url_prefix="/api/current_job")

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/stream")
def current_job():
    pm = get_pm()
    def event_stream():
        currently_has_job = True
        while True:
            if pm.current_print_job is None and currently_has_job:
                yield f"data: {json.dumps({'active': 'false'})}\n\n"
                currently_has_job = False
                continue

            if pm.current_print_job is not None and not currently_has_job:
                yield f"data: {pm.current_print_job.to_json()}\n\n"
                currently_has_job = True
                continue

            time.sleep(1)


    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    }

    return Response(event_stream(), headers=headers)

