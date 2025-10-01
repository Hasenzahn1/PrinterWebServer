import os
from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/')
def index():
    dir_path = os.path.join(app.static_folder, 'overlay-templates')
    try:
        files = sorted(f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f)))
    except FileNotFoundError:
        files = []
    app.logger.debug('overlay templates: %s', files)
    return render_template('index.html', overlay_templates=files)

@app.route('/api/delete-template/<template_name>', methods=['DELETE'])
def delete_template(template_name):
    dir_path = os.path.join(app.static_folder, 'overlay-templates')
    file_path = os.path.join(dir_path, template_name)
    try:
        os.remove(file_path)
        app.logger.info('Deleted overlay template: %s', template_name)
        return '', 204
    except FileNotFoundError:
        app.logger.warning('Overlay template not found: %s', template_name)
        return '', 404
    except Exception as e:
        app.logger.error('Error deleting overlay template: %s', e)
        return '', 500

@app.route('/api/upload-template', methods=['POST'])
def upload_template():
    dir_path = os.path.join(app.static_folder, 'overlay-templates')
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)
    file = request.files.get('template')
    if not file:
        return {'error': 'No file uploaded'}, 400
    file_path = os.path.join(dir_path, file.filename)
    file.save(file_path)
    app.logger.info('Uploaded overlay template: %s', file.filename)
    return {'message': 'Template uploaded successfully'}, 201

if __name__ == "__main__":
    app.run(debug=True)