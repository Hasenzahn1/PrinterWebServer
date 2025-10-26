CUPS_ENABLED = False

import threading
import time
from typing import TYPE_CHECKING

if CUPS_ENABLED: import cups

import tempfile
import os
from PIL import Image

from src.PrintJob import PrintJob

if TYPE_CHECKING:
    from src.PrintManager import PrintManager



class PrinterThread(threading.Thread):

    PRINT_COUNTDOWN = 5

    def __init__(self, pm: "PrintManager"):
        super().__init__(name="PrinterThread")
        self.pm = pm
        self.config = pm.config
        self.stopped = False
        self.currently_printing = False
        self.counter = 0

        if CUPS_ENABLED: self.conn = cups.Connection()

    def run(self):
        while not self.stopped:
            # During printing update website, monitor for errors and check for finished print
            if self.pm.current_print_job is not None:
                self.on_print()
            else: # Start new printing job if available
                if self.pm.paused:
                    time.sleep(1)
                    continue

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

        if CUPS_ENABLED: self.read_status(self.conn)

        # Printer is still printing: Update Website progressbar? Maybe gather information if possible?
        time.sleep(1)


    def read_status(self, conn):
        STATE = {3: "IDLE", 4: "PROCESSING", 5: "STOPPED"}
        # Kurzübersicht aller Drucker
        printers = conn.getPrinters()  # {name: attrs}
        if not printers:
            print("Keine Drucker gefunden.")
            return
        for name, attrs in sorted(printers.items()):
            state = STATE.get(attrs.get("printer-state", 0), str(attrs.get("printer-state", "?")))
            msg = attrs.get("printer-state-message", "")
            reasons = attrs.get("printer-state-reasons", [])
            if isinstance(reasons, str):
                reasons = [reasons] if reasons else []
            qlen = attrs.get("queued-job-count", 0)
            model = attrs.get("printer-make-and-model", "")
            info = attrs.get("printer-info", "")

            print(f"=== {name} ===")
            if info:  print(f"Info:   {info}")
            if model: print(f"Model:  {model}")
            print(f"State:  {state}")
            if msg:   print(f"Meld.:  {msg}")
            if reasons:
                print(f"Gründe: {', '.join(reasons)}")
            print(f"Warteschlange: {qlen} Jobs\n")


    def on_finish_print_image(self, element: PrintJob):
        self.pm.current_print_job = None
        self.pm.log("Finished printing image")

        element.delete()

    def start_print_job(self, element: PrintJob):
        self.pm.current_print_job = element
        self.pm.log("Start Print Job")

        self.print_pil_image(element)
        self.counter = self.PRINT_COUNTDOWN


    def pick_printer(self, conn):
        print("Default" + str(conn.getDefault()))
        print("Other" + str(conn.getPrinters()))
        return conn.getDefault() or sorted(conn.getPrinters().keys())[0]

    def print_pil_image(self, print_job: PrintJob):
        options = {
            "fit-to-page": "True",
            "media": "A4",
        }

        img = print_job.open_and_preprocess_image()
        # img.show()

        if not CUPS_ENABLED: return
        printer = self.pick_printer(self.conn)

        # als temporäre Datei speichern (PNG oder JPEG)
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp_path = tmp.name
        try:
            img.save(tmp, format="PNG")
            tmp.close()  # wichtig: schließen, damit CUPS die Datei lesen kann

            job_id = self.conn.printFile(printer, tmp_path, print_job.uuid, options)
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
