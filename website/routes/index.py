import os

from flask import Blueprint, current_app, render_template

bp = Blueprint("index", __name__, url_prefix="")

@bp.route('/')
def index():
    dir_path = os.path.join(current_app.static_folder, 'overlay-templates')
    try:
        files = sorted(f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f)))
    except FileNotFoundError:
        files = []
    current_app.logger.debug('overlay templates: %s', files)
    return render_template('index.html', overlay_templates=files)