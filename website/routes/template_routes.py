import os

from flask import Blueprint, current_app
from requests import request

bp = Blueprint("template", __name__, url_prefix="/api/template")

@bp.route('/delete/<template_name>', methods=['DELETE'])
def delete_template(template_name):
    dir_path = os.path.join(current_app.static_folder, 'overlay-templates')
    file_path = os.path.join(dir_path, template_name)
    try:
        os.remove(file_path)
        current_app.logger.info('Deleted overlay template: %s', template_name)
        return '', 204
    except FileNotFoundError:
        current_app.logger.warning('Overlay template not found: %s', template_name)
        return '', 404
    except Exception as e:
        current_app.logger.error('Error deleting overlay template: %s', e)
        return '', 500

@bp.route('/upload', methods=['POST'])
def upload_template():
    dir_path = os.path.join(current_app.static_folder, 'overlay-templates')
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)
    file = request.files.get('template')
    if not file:
        return {'error': 'No file uploaded'}, 400
    file_path = os.path.join(dir_path, file.filename)
    file.save(file_path)
    current_app.logger.info('Uploaded overlay template: %s', file.filename)
    return {'message': 'Template uploaded successfully'}, 201
