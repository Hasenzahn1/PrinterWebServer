from src.image.Overlay import Overlay


class PrintJob:
    def __init__(self, image_file: str, metadata: dict):
        self.image_file = image_file
        self.metadata = metadata

        self.selected_overlay: Overlay|None = None
        self.pc_name: str = metadata.get("pc_name", "-")
        self.plot: str = metadata.get("plot", "-")

    def apply_default_overlay_if_not_present(self, overlay: Overlay):
        if self.selected_overlay is None:
            self.selected_overlay = overlay
        print("Applying default overlay")

    def apply_overlay(self):
        print("Applying overlay")
        pass

    def __str__(self):
        return f"PrintJob(image_file='{self.image_file}', metadata={self.metadata}, selected_overlay={self.selected_overlay})"

