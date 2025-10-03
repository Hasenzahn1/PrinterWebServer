import threading
import time
from typing import TYPE_CHECKING

from src.PrintJob import PrintJob

if TYPE_CHECKING:
    from src.PrintManager import PrintManager


class PrinterThread(threading.Thread):
    def __init__(self, state: "PrintManager"):
        super().__init__(name="PrinterThread")
        self.state = state
        self.config = state.config
        self.stopped = False
        self.currently_printing = False

    def run(self):
        while not self.stopped:
            # During printing update website, monitor for errors and check for finished print
            if self.state.current_print_job is not None:
                self.on_print()
            else: # Start new printing job if available
                self.attempt_start_new_print_job()


    def attempt_start_new_print_job(self):
        element = self.state.get_element()
        if element is None:
            time.sleep(1)
            return

        self.start_print_job(element)


    def on_print(self):
        self.state.log("Currently printing Image: " + str(self.state.current_print_job))
        # Check if printer has finished printing
        printing_finished = True

        # Printer finished printing: Delete Image and restart with next job
        if printing_finished:
            self.on_finish_print_image(self.state.current_print_job)
            return

        # Printer is still printing: Update Website progressbar? Maybe gather information if possible?
        time.sleep(1)


    def on_finish_print_image(self, element: PrintJob):
        self.state.current_print_job = None
        self.state.log("Finished printing image")
        # TODO: Delete Image if successfully printed
        pass


    def start_print_job(self, element: PrintJob):
        self.state.current_print_job = element

        element.apply_default_overlay_if_not_present(self.state.default_overlay)
        element.apply_overlay()

        self.state.log("Start Print Job")

        # TODO: Print
        time.sleep(50)



    def stop(self):
        self.stopped = True
