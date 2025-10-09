import threading
import time
from typing import TYPE_CHECKING

import cups
import tempfile
import os
from PIL import Image

from src.PrintJob import PrintJob

if TYPE_CHECKING:
    from src.PrintManager import PrintManager


class PrinterThread(threading.Thread):
    def __init__(self, pm: "PrintManager"):
        super().__init__(name="PrinterThread")
        self.pm = pm
        self.config = pm.config
        self.stopped = False
        self.currently_printing = False
        self.counter = 0

    def run(self):
        while not self.stopped:
            # During printing update website, monitor for errors and check for finished print
            if self.pm.current_print_job is not None:
                self.on_print()
            else: # Start new printing job if available
                self.attempt_start_new_print_job()


    def attempt_start_new_print_job(self):
        element = self.pm.fetch_new_print_job()
        if element is None:
            time.sleep(1)
            return

        self.start_print_job(element)


    def on_print(self):
        self.counter -= 1
        self.pm.log("Currently printing Image: " + str(self.pm.current_print_job))
        # Check if printer has finished printing
        printing_finished = self.counter <= 0

        # Printer finished printing: Delete Image and restart with next job
        if printing_finished:
            self.on_finish_print_image(self.pm.current_print_job)
            return

        # Printer is still printing: Update Website progressbar? Maybe gather information if possible?
        time.sleep(1)


    def on_finish_print_image(self, element: PrintJob):
        self.pm.current_print_job = None
        self.pm.log("Finished printing image")

        element.delete()

    def start_print_job(self, element: PrintJob):
        self.pm.current_print_job = element
        self.pm.log("Start Print Job")

        self.print_pil_image(element)
        self.counter = 50

    def pick_printer(self, conn):
        print("Default" + conn.getDefault())
        print("Other" + conn.getPrinters())
        return conn.getDefault() or sorted(conn.getPrinters().keys())[0]

    def print_pil_image(self, print_job: PrintJob):
        options = {
            "fit-to-page": "True",
            "media": "A4",
        }

        img = print_job.open_and_preprocess_image()

        conn = cups.Connection()
        printer = self.pick_printer(conn)

        # als temporäre Datei speichern (PNG oder JPEG)
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp_path = tmp.name
        try:
            img.save(tmp, format="PNG")
            tmp.close()  # wichtig: schließen, damit CUPS die Datei lesen kann

            job_id = conn.printFile(printer, tmp_path, print_job.uuid, options)
            self.pm.log(f"Job {job_id} an '{printer}' gesendet.")
        except Exception as e:
            print(e)
        finally:
            # Temp-Datei aufräumen
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


    def stop(self):
        self.stopped = True
