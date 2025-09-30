import sys

import win32con
import win32gui
import win32print
from PIL import Image

def print_image(image: Image.Image, printer_name: str, print_title: str):
    image = _ensure_rgb(image)

    if(sys.platform.startswith('win')):
        _print_windows(image, printer_name, print_title)
    else:
        _print_linux(image, printer_name, print_title)

def _orient(img: Image.Image, landscape: bool) -> Image.Image:
    if landscape and img.width < img.height:
        return img.rotate(90, expand=True)   # make it landscape
    if not landscape and img.width > img.height:
        return img.rotate(90, expand=True)   # make it portrait
    return img

def set_dc_orientation(hdc, printer_name: str, landscape: bool) -> None:
    # Open printer and fetch (or build) a DEVMODE
    hPrinter = win32print.OpenPrinter(printer_name)
    try:
        info = win32print.GetPrinter(hPrinter, 2)  # PRINTER_INFO_2
        devmode = info.get("pDevMode")
        if devmode is None:
            # Get a default DEVMODE from the driver
            devmode = win32print.DocumentProperties(
                None, hPrinter, printer_name, None, None, 0
            )
            devmode = win32print.DocumentProperties(
                None, hPrinter, printer_name, devmode, devmode,
                win32con.DM_OUT_BUFFER | win32con.DM_IN_BUFFER
            )

        # Set orientation flag
        devmode.Fields |= win32con.DM_ORIENTATION
        devmode.Orientation = (
            win32con.DMORIENT_LANDSCAPE if landscape else win32con.DMORIENT_PORTRAIT
        )

        # Apply DEVMODE to the DC (this is the correct call)
        win32gui.ResetDC(hdc.GetSafeHdc(), devmode)

    finally:
        win32print.ClosePrinter(hPrinter)

def _print_windows(image: Image.Image, printer_name: str, print_title: str):
    import win32print  # type: ignore
    import win32ui  # type: ignore
    import win32con  # type: ignore
    from PIL import ImageWin

    if printer_name is None:
        printer_name = win32print.GetDefaultPrinter()

    if not printer_name:
        raise RuntimeError("Kein Windows-Standarddrucker gefunden. Bitte 'printer_name' angeben.")

    # Create a device context for the printer
    hdc = win32ui.CreateDC()
    hdc.CreatePrinterDC(printer_name)

    set_dc_orientation(hdc, printer_name, True)

    # Get printable area
    HORZRES = win32con.HORZRES
    VERTRES = win32con.VERTRES
    printable_w = hdc.GetDeviceCaps(HORZRES)
    printable_h = hdc.GetDeviceCaps(VERTRES)

    # Prepare image
    iw, ih = image.size

    if True:
        # scale to fit within printable area while preserving aspect ratio
        scale = min(printable_w / iw, printable_h / ih)
        tw, th = int(iw * scale), int(ih * scale)

    # Centered position
    x = (printable_w - tw) // 2
    y = (printable_h - th) // 2

    # Resize with high-quality
    img_resized = image.resize((tw, th), Image.LANCZOS)
    #img_resized = _orient(img_resized, landscape=False)
    dib = ImageWin.Dib(img_resized)
    # img_resized.show()


    # Start print job
    hdc.StartDoc(print_title)
    hdc.StartPage()
    try:
        dib.draw(hdc.GetHandleOutput(), (x, y, x + tw, y + th))
    finally:
        hdc.EndPage()
        hdc.EndDoc()
        hdc.DeleteDC()

def _print_linux(image: Image.Image, printer_name: str, print_title: str):
    pass

def _ensure_rgb(img: Image.Image) -> Image.Image:
    if img.mode not in ("RGB", "RGBA", "L"):
        return img.convert("RGB")
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        return bg
    if img.mode == "L":
        return img.convert("RGB")
    return img

if __name__ == '__main__':
    img = Image.open("../images/Testpage.png")
    print_image(img, "Canon SELPHY CP1500", "Test Print")