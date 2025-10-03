from pathlib import Path
from typing import TYPE_CHECKING

from flask import Blueprint, current_app, send_from_directory, abort

if TYPE_CHECKING: from src.PrintManager import PrintManager

bp = Blueprint("images", __name__, url_prefix="/api/images-ext")

EXTERNAL_IMAGE_DIR = Path("./").resolve()
print(EXTERNAL_IMAGE_DIR)

def get_pm() -> "PrintManager":
    return getattr(current_app, "extensions", {}).get("printer_manager")

@bp.route("/<path:filename>")
def images_ext(filename):
    try:
        return send_from_directory(
            directory=str(EXTERNAL_IMAGE_DIR),
            path=filename,  # Flask >=3.0: Param heißt 'path'
        )
    except FileNotFoundError:
        abort(404)