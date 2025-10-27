from typing import TYPE_CHECKING
from flask import Blueprint, current_app, request, jsonify

if TYPE_CHECKING:
    from src.PrintManager import PrintManager

bp = Blueprint("controls", __name__, url_prefix="/api/controls")

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/state", methods=["GET"])
def get_state():
    pm = get_pm()
    if pm is None:
        return jsonify({"ok": False, "error": "PrintManager missing"}), 500

    paused = pm.paused
    return jsonify({
        "ok": True,
        "auto_print_on_receive": pm.print_on_receive,
        "paused": paused,
    })

@bp.route("/print_on_receive", methods=["POST"])
def set_auto_print():
    pm = get_pm()
    if pm is None:
        return jsonify({"ok": False, "error": "PrintManager missing"}), 500

    data = request.get_json(silent=True) or {}
    enabled = bool(data.get("enabled"))

    pm.set_print_on_receive(enabled)
    return jsonify({"ok": True, "enabled": enabled})

@bp.route("/pause", methods=["POST"])
def pause():
    pm = get_pm()
    if pm is None:
        return jsonify({"ok": False, "error": "Printer thread missing"}), 500

    pm.paused = True

    return jsonify({"ok": True, "paused": True})

@bp.route("/resume", methods=["POST"])
def resume():
    pm = get_pm()
    if pm is None:
        return jsonify({"ok": False, "error": "Printer thread missing"}), 500

    pm.paused = False

    return jsonify({"ok": True, "paused": False})
