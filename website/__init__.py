from flask import Flask

from .routes import template_routes, index


def create_app():
    app = Flask(__name__,
                static_url_path="",
                static_folder="../website/static",
                template_folder="../website/templates")

    app.extensions = getattr(app, "extensions", {})
    app.register_blueprint(template_routes.bp)
    app.register_blueprint(index.bp)

    return app