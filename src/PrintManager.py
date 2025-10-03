import queue

from flask import Flask

from src.Config import Config
from src.PrintJob import PrintJob
from src.image.Overlay import Overlay
from src.threads.NextcloudFetcherThread import NextcloudFetcherThread
from src.threads.PrinterThread import PrinterThread


class PrintManager:
    def __init__(self, config_file: str, app: Flask):
        self.status: str                 = ""
        self.print_on_receive: bool      = False
        self.config: Config              = Config(config_file)
        self.queue: queue                = queue.Queue()
        self.default_overlay: Overlay    = Overlay()
        self.app: Flask                  = app

        self.current_print_job: PrintJob = None

        self.nextcloud_fetcher = NextcloudFetcherThread(self)
        self.printer_thread = PrinterThread(self)

    def add_job(self, job):
        self.queue.put(job)
        self.log("Added Job: " + str(job))

    def get_element(self) -> PrintJob|None:
        if self.queue.empty(): return None
        self.current_print_job = self.queue.get()
        return self.current_print_job

    def start(self):
        self.nextcloud_fetcher.start()
        self.printer_thread.start()
        pass

    def stop(self):
        self.nextcloud_fetcher.stop()
        self.printer_thread.stop()

    def log(self, message: str):
        self.app.logger.info(message)
