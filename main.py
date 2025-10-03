from src.PrintManager import PrintManager
from website import create_app


# ========= Website Setup ========= #
def get_pm() -> PrintManager:
    return getattr(app, "extensions", {}).get("printer_manager")

# ========= Stop Threads ========= #
def cleanup(reason: str):
    pm = get_pm()
    if pm:
        try:
            app.logger.info("Shutting down PrintManager (%s)...", reason)
            pm.stop()
        except Exception:
            app.logger.exception("Error while stopping PrintManager")

# ========= Main Program start ========= #
if __name__ == "__main__":
    try:
        app = create_app()

        state = PrintManager("config.yml", app)
        state.start()

        app.extensions["printer_manager"] = state
        app.run(debug=True, use_reloader=False)
    except Exception as e:
        print(e)
    finally:
        # falls PyCharm hart stoppt und kein Signal/atexit kam
        cleanup("finally")

