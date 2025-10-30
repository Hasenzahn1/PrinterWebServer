import json
import os

from PIL import Image, ImageColor

from src.image.Overlay import Overlay


class PrintJob:
    def __init__(self, uuid: str, image_file: str, metadata: dict):
        self.uuid = uuid
        self.image_file = image_file
        self.metadata = metadata

        self.selected_overlay: Overlay|None = None
        self.pc_name: str = metadata.get("pcName", "-")
        self.plot: str = metadata.get("plotId", "-")

    def apply_default_overlay_if_not_present(self, overlay: Overlay):
        if self.selected_overlay is None:
            self.selected_overlay = Overlay("website/static/overlay-templates/new_overlay.json")

        print("Applying default overlay")

    def open_and_preprocess_image(self):
        image = Image.open(self.image_file)
        if self.selected_overlay is None: return image

        image = self.selected_overlay.apply(image, self)
        return self.pad_xy(image, 10, 30)

    def pad_xy(self, img: Image.Image, xPad: int, yPad: int, bg=None) -> Image.Image:
        if xPad < 0 or yPad < 0:
            raise ValueError("xAbstand und yAbstand müssen >= 0 sein")

        w, h = img.size
        mode = img.mode

        # Standard-Hintergrund bestimmen
        if bg is None:
            if "A" in mode:  # z.B. RGBA, LA
                bg = (0, 0, 0, 0)
            elif mode == "L":  # Graustufe
                bg = 255
            else:
                bg = (255, 255, 255)

        neu = Image.new(mode, (w + 2 * xPad, h + 2 * yPad), bg)
        neu.paste(img, (xPad, yPad))
        return neu

    def delete(self):
        os.remove(self.image_file)

    def to_json(self):
        return json.dumps({
            "image_url": "/api/images-ext/" + str(self.image_file),
            "uuid": self.uuid,
            "pc_name": self.pc_name,
            "plot": self.plot,
            "metadata": self.metadata,
            "overlay": "" if self.selected_overlay is None else self.selected_overlay.overlay_path
        })

    def __str__(self):
        return f"PrintJob(image_file='{self.image_file}', metadata={self.metadata}, selected_overlay={self.selected_overlay})"

