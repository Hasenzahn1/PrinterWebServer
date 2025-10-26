import os

from flask import Blueprint, current_app, render_template

bp = Blueprint("editor", __name__, url_prefix="")

@bp.route('/editor')
def editor():
    templates_dir = os.path.join(current_app.static_folder, 'overlay-templates')
    assets_dir = os.path.join(current_app.static_folder, 'overlay-assets')

    def list_files(dir_path):
        try:
            return sorted(f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f)))
        except FileNotFoundError:
            return []

    files = list_files(templates_dir)
    assets = list_files(assets_dir)

    current_app.logger.debug('overlay templates: %s', files)
    current_app.logger.debug('overlay assets: %s', assets)
    return render_template('editor.html', overlay_templates=files, overlay_assets=assets)