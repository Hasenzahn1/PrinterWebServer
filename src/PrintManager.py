import os
from flask import Flask

from src.Config import Config
from src.PrintJob import PrintJob
from src.image.Overlay import Overlay
from src.threads.NextcloudFetcherThread import NextcloudFetcherThread
from src.threads.PrinterThread import PrinterThread


class PrintManager:
    def __init__(self, config_file: str, app: Flask):
        self.status: str                 = ""
        self.print_on_receive: bool      = True
        self.config: Config              = Config(config_file)
        self.unlisted: list              = []
        self.queue: list                 = []
        self.default_overlay: Overlay    = Overlay()
        self.app: Flask                  = app

        self.current_print_job: PrintJob = None

        self.nextcloud_fetcher = NextcloudFetcherThread(self)
        self.printer_thread = PrinterThread(self)

        os.makedirs("/downloads/images", exist_ok=True)
        os.makedirs("/downloads/metadata", exist_ok=True)
        os.makedirs("/downloads/temp", exist_ok=True)

    def add_new_job(self, job):
        if self.print_on_receive and len(self.queue) == 0:
            self.queue.append(job)
        else:
            self.unlisted.append(job)

    def fetch_new_print_job(self) -> PrintJob | None:
        if len(self.queue) == 0: return None
        self.current_print_job = self.queue.pop(0)

        # Enqueue next job
        if self.print_on_receive and len(self.queue) == 0 and len(self.unlisted) > 0:
            self.queue.append(self.unlisted.pop(0))

        return self.current_print_job

    def set_print_on_receive(self, print_on_receive: bool):
        self.print_on_receive = print_on_receive

    def start(self):
        self.nextcloud_fetcher.start()
        self.printer_thread.start()
        pass

    def stop(self):
        self.nextcloud_fetcher.stop()
        self.printer_thread.stop()

    def log(self, message: str):
        self.app.logger.info(message)
