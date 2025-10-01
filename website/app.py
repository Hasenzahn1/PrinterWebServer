import os
from flask import Flask, render_template

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

if __name__ == "__main__":
    app.run(debug=True)