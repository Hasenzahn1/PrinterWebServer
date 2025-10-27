import time
from flask import Blueprint, current_app, Response
import json
from typing import TYPE_CHECKING

from src.threads.PrinterThread import PrinterThread

if TYPE_CHECKING: from src.PrintManager import PrintManager

bp = Blueprint("current_job", __name__, url_prefix="/api/current_job")

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/stream")
def current_job():
    pm = get_pm()

    def event_stream():
        last_sent = None  # sorgt dafür, dass beim Verbindungsaufbau sofort gesendet wird
        while True:
            # serialize aktuellen Zustand
            if pm.current_print_job is None:
                payload = json.dumps({"active": False})
            else:
                # pm.current_print_job.to_json() gibt bereits einen JSON-String zurück
                payload = pm.current_print_job.to_json()

            # nur senden, wenn sich etwas geändert hat ODER beim ersten Durchlauf
            if payload != last_sent:
                yield f"data: {payload}\n\n"
                last_sent = payload

            time.sleep(1)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        # Optional (falls Nginx/Proxy): "X-Accel-Buffering": "no"
    }
    return Response(event_stream(), headers=headers)

@bp.route("/progress")
def progress_stream():
    pm = get_pm()

    def event_stream():
        last_sent = None  # sorgt dafür, dass beim Verbindungsaufbau sofort gesendet wird
        while True:
            # serialize aktuellen Zustand
            if pm.current_print_job is None:
                payload = json.dumps({"active": False})
            else:
                # pm.current_print_job.to_json() gibt bereits einen JSON-String zurück
                payload = json.dumps({"value": 1-(pm.printer_thread.counter / PrinterThread.PRINT_COUNTDOWN), "eta": str(pm.printer_thread.counter) + "s"})

            # nur senden, wenn sich etwas geändert hat ODER beim ersten Durchlauf
            if payload != last_sent:
                yield f"data: {payload}\n\n"
                last_sent = payload

            time.sleep(0.5)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        # Optional (falls Nginx/Proxy): "X-Accel-Buffering": "no"
    }
    return Response(event_stream(), headers=headers)


@bp.route("/status")
def status_stream():
    pm = get_pm()

    def event_stream():
        last_sent = None  # sorgt dafür, dass beim Verbindungsaufbau sofort gesendet wird
        while True:
            # serialize aktuellen Zustand
            if pm.current_print_job is not None:
                payload = json.dumps({"status": "printing"})
            elif pm.paused:
                payload = json.dumps({"status": "paused"})
            else:
                payload = json.dumps({"status": "pending"})

            # nur senden, wenn sich etwas geändert hat ODER beim ersten Durchlauf
            if payload != last_sent:
                yield f"data: {payload}\n\n"
                last_sent = payload

            time.sleep(1)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        # Optional (falls Nginx/Proxy): "X-Accel-Buffering": "no"
    }
    return Response(event_stream(), headers=headers)
