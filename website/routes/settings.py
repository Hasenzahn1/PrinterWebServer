from typing import TYPE_CHECKING

from flask import Blueprint, current_app, request, jsonify

if TYPE_CHECKING: from src.PrintManager import PrintManager

bp = Blueprint("settings", __name__, url_prefix="/api/settings")

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/printOnReceive", methods=["POST"])
def print_on_receive():
    data = request.get_json()
    value = data.get("value", None)

    if isinstance(value, bool):
        get_pm().set_print_on_receive(value)

    return jsonify({"ok": True, "received": value}), 200