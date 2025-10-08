from flask import Flask

from .routes import template_routes, index_routes, current_job_routes, images_routes, queue_routes, settings


def create_app():
    app = Flask(__name__,
                static_url_path="",
                static_folder="../website/static",
                template_folder="../website/templates")

    app.extensions = getattr(app, "extensions", {})
    app.register_blueprint(template_routes.bp)
    app.register_blueprint(index_routes.bp)
    app.register_blueprint(current_job_routes.bp)
    app.register_blueprint(images_routes.bp)
    app.register_blueprint(queue_routes.bp)
    app.register_blueprint(settings.bp)

    return app