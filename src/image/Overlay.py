import json
import base64
import io
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps


class Overlay:
    def __init__(
        self,
        overlay_path: str,
        target_size=(1772, 1181),
        resize_mode="fill",            # "fill" (Crop) oder "pad" (Letterbox)
        font_scale_strategy="avg",     # "avg","x","y","min","max","none"
        min_font_px=10
    ):
        """
        overlay_path  : Pfad zur exportierten overlay.json
        target_size   : (W, H) in Pixel für das Endbild
        resize_mode   : "fill" (zentraler Crop) | "pad" (einpassen + Rand)
        font_scale_strategy :
            - "avg":    skaliert fontSize mit (sx+sy)/2   (Voreinstellung)
            - "x":      skaliert nur mit sx
            - "y":      skaliert nur mit sy
            - "min":    skaliert mit min(sx,sy)
            - "max":    skaliert mit max(sx,sy)
            - "none":   fontSize nicht skalieren
        min_font_px   : minimale Fontgröße nach Skalierung
        """
        self.target_size = (int(target_size[0]), int(target_size[1]))
        self.resize_mode = resize_mode
        self.font_scale_strategy = font_scale_strategy
        self.min_font_px = int(min_font_px)
        self.overlay_path = overlay_path

        with open(overlay_path, "r", encoding="utf-8") as f:
            self.data = json.load(f)

        # z-Reihenfolge
        self.nodes = sorted(self.data.get("nodes", []), key=lambda n: int(n.get("zIndex", 1)))

        # optionales Editor-Hintergrundbild
        self.bg_image = self._load_image_from_src(self.data.get("image")) if self.data.get("image") else None

        # Stage aus dem JSON (zur Skalierung)
        stg = self.data.get("stage") or {}
        self.src_stage_w = int(stg.get("width")) if stg.get("width") else None
        self.src_stage_h = int(stg.get("height")) if stg.get("height") else None
        self.src_dpr     = float(stg.get("devicePixelRatio") or 1.0)

    # =========================== Public API ===========================

    def apply(self, image, printjob):
        """
        1) Basismotiv auf Zielgröße skalieren.
        2) Nodes (inkl. fontSize) von Editor-Stage → Zielgröße skalieren.
        3) Overlay rendern (Platzhalter %plotid%, %pcname% werden ersetzt).
        4) Fertiges PIL.Image.Image (RGBA) zurückgeben.
        """
        if not isinstance(image, Image.Image):
            raise TypeError("apply erwartet ein PIL.Image.Image als erstes Argument")

        # 1) Base skalieren
        base = image.convert("RGBA")
        base = self._resize_base(base, self.target_size, self.resize_mode)

        # 2) Skalierungsfaktoren unter Berücksichtigung der DPR
        tw, th = self.target_size
        if self.src_stage_w and self.src_stage_h:
            eff_w = self.src_stage_w * max(1.0, self.src_dpr)
            eff_h = self.src_stage_h * max(1.0, self.src_dpr)
            sx = tw / float(eff_w) if eff_w else 1.0
            sy = th / float(eff_h) if eff_h else 1.0
        else:
            sx = sy = 1.0

        # Editor-Background überlagern (falls vorhanden)
        if self.bg_image:
            bg_layer = self._fit_image(self.bg_image, self.target_size, object_fit="contain")
            base = Image.alpha_composite(base, bg_layer)

        # 3) Nodes rendern (mit Skalierung)
        for node in self.nodes:
            node_scaled = self._scale_node(node, sx, sy)

            ntype = (node_scaled.get("type") or "text").lower()
            opacity = self._parse_opacity(node_scaled.get("opacity", 1))
            rotate_deg = self._parse_rotate(node_scaled.get("rotate"))
            left = int(round(node_scaled.get("left", 0)))
            top = int(round(node_scaled.get("top", 0)))
            width = int(round(node_scaled.get("width", 0) or 0))
            height = int(round(node_scaled.get("height", 0) or 0))
            if width <= 0 or height <= 0:
                continue

            if ntype == "image":
                layer = self._render_image_node(node_scaled, (width, height))
            else:
                layer = self._render_text_node(node_scaled, (width, height), printjob)
            if layer is None:
                continue

            if rotate_deg:
                layer = layer.rotate(rotate_deg, resample=Image.BICUBIC, expand=True)
            if opacity < 1.0:
                layer = self._apply_opacity(layer, opacity)

            base = self._paste_rgba(base, layer, (left, top))

        return base

    # =========================== Stage/Scaling ===========================

    def _resize_base(self, img_rgba, target_size, mode):
        if mode == "fill":
            return ImageOps.fit(img_rgba, target_size, method=Image.LANCZOS, centering=(0.5, 0.5))
        canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
        tmp = img_rgba.copy()
        tmp.thumbnail(target_size, Image.LANCZOS)
        ox = (target_size[0] - tmp.width) // 2
        oy = (target_size[1] - tmp.height) // 2
        canvas.paste(tmp, (ox, oy), tmp)
        return canvas

    def _scale_node(self, n, sx, sy):
        n = dict(n)
        if isinstance(n.get("left"), (int, float)):
            n["left"] = int(round(n["left"] * sx))
        if isinstance(n.get("top"), (int, float)):
            n["top"] = int(round(n["top"] * sy))
        if isinstance(n.get("width"), (int, float)):
            n["width"] = max(1, int(round(n["width"] * sx)))
        if isinstance(n.get("height"), (int, float)):
            n["height"] = max(1, int(round(n["height"] * sy)))

        # fontSize skalieren (je nach Strategie)
        fs = n.get("fontSize")
        if isinstance(fs, str):
            m = re.search(r"([\d.]+)", fs)
            if m:
                base = float(m.group(1))
                if   self.font_scale_strategy == "x":   factor = sx
                elif self.font_scale_strategy == "y":   factor = sy
                elif self.font_scale_strategy == "min": factor = min(sx, sy)
                elif self.font_scale_strategy == "max": factor = max(sx, sy)
                elif self.font_scale_strategy == "none":factor = 1.0
                else:                                   factor = (sx + sy) / 2.0
                scaled = max(self.min_font_px, int(round(base * factor)))
                n["fontSize"] = f"{scaled}px"
                print("FontSize Scaled to", scaled)
        return n

    # =========================== Rendering ===========================

    def _render_image_node(self, node, size_wh):
        src = node.get("src")
        obj_fit = node.get("objectFit", "contain")
        img = self._load_image_from_src(src)
        if img is None:
            return None
        return self._fit_image(img, size_wh, object_fit=obj_fit)

    def _render_text_node(self, node, size_wh, printjob):
        # Platzhalter
        text = str(node.get("text", ""))
        text = text.replace("%plotid%", str(getattr(printjob, "plot", "")))
        text = text.replace("%pcname%", str(getattr(printjob, "pcname", "")))

        font_px = self._parse_font_size(node.get("fontSize", "24px"))
        font_family = node.get("fontFamily", "")

        # CSS-Flags
        fw = str(node.get("fontWeight", "")).lower()
        fs = str(node.get("fontStyle", "")).lower()
        want_bold   = fw in ("bold", "700", "800", "900")
        want_italic = fs in ("italic", "oblique")

        # Font-Datei auswählen (Italic nur wenn gewünscht)
        font_path, exact_variant = self._pick_font_path(font_family, want_bold, want_italic)
        try:
            font = ImageFont.truetype(font_path, font_px) if font_path else ImageFont.load_default(font_px)
        except Exception:
            font = ImageFont.load_default(font_px)
            exact_variant = False

        color = self._parse_rgba(node.get("color", "rgba(0,0,0,1)"), default=(0, 0, 0, 255))
        bg = self._parse_rgba(node.get("backgroundColor", "rgba(0,0,0,0)"), default=(0, 0, 0, 0))
        align = (node.get("textAlign") or "left").lower()
        text_decoration = str(node.get("textDecoration", "")).lower()
        underline = "underline" in text_decoration

        w, h = size_wh
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)

        if bg[3] > 0:
            draw.rectangle([(0, 0), (w, h)], fill=bg)

        # Zeilenumbruch
        lines = self._wrap_text(text, font, max_width=w)

        # Metriken
        try:
            ascent, descent = font.getmetrics()
        except Exception:
            ascent, descent = font.size, int(font.size * 0.25)
        line_spacing = int(font.size * 0.2)

        # Unterstreichungs-Parameter (wie CSS ungef.)
        ul_offset = max(1, round(font.size * 0.08))
        ul_thick  = max(1, round(font.size * 0.07))

        # Fallbacks bei fehlenden Varianten
        use_faux_bold = want_bold and not exact_variant
        use_faux_italic = want_italic and not exact_variant

        # Für Faux-Italic separat zeichnen, dann scheren
        target_img = layer
        target_draw = draw
        if use_faux_italic:
            target_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            target_draw = ImageDraw.Draw(target_img)

        y = 0
        for line in lines:
            try:
                line_w = int(round(target_draw.textlength(line, font=font)))
            except Exception:
                bbox = target_draw.textbbox((0, 0), line, font=font)
                line_w = bbox[2] - bbox[0]
            line_h = ascent + descent

            if align == "center":
                x = (w - line_w) // 2
            elif align == "right":
                x = max(0, w - line_w)
            else:
                x = 0

            # Zeichnen (Faux-Bold via stroke)
            if use_faux_bold:
                target_draw.text(
                    (x, y), line, font=font, fill=color,
                    stroke_width=max(1, round(font.size * 0.06)),
                    stroke_fill=color
                )
            else:
                target_draw.text((x, y), line, font=font, fill=color)

            # Unterstrich an Baseline
            if underline:
                baseline_y = y + ascent
                ul_y = min(h - 1, baseline_y + ul_offset)
                x2 = min(w, x + line_w)
                target_draw.line([(x, ul_y), (x2, ul_y)], fill=color, width=ul_thick)

            y += line_h + line_spacing
            if y > h:
                break

        if use_faux_italic:
            shear = 0.21  # ~12°
            new_w = int(w + shear * h)
            sheared = target_img.transform(
                (new_w, h),
                Image.AFFINE,
                (1, shear, 0, 0, 1, 0),
                resample=Image.BICUBIC
            )
            if new_w > w:
                left_crop = (new_w - w) // 2
                sheared = sheared.crop((left_crop, 0, left_crop + w, h))
            layer = Image.alpha_composite(layer, sheared)

        return layer

    # =========================== Helpers ===========================

    def _parse_font_size(self, s, default=24):
        try:
            m = re.search(r"([\d.]+)", str(s))
            return max(1, int(float(m.group(1)))) if m else default
        except Exception:
            return default

    def _parse_opacity(self, v):
        try:
            f = float(v)
            return max(0.0, min(1.0, f))
        except Exception:
            return 1.0

    def _parse_rotate(self, s):
        if not s:
            return 0
        if isinstance(s, (int, float)):
            return int(s)
        m = re.search(r"(-?\d+(?:\.\d+)?)", str(s))
        return int(round(float(m.group(1)))) if m else 0

    def _parse_rgba(self, s, default=(255, 255, 255, 255)):
        if not s:
            return default
        s = s.strip()
        m = re.match(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)", s, re.I)
        if m:
            r = int(float(m.group(1)))
            g = int(float(m.group(2)))
            b = int(float(m.group(3)))
            a = float(m.group(4)) if m.group(4) is not None else 1.0
            return (self._c255(r), self._c255(g), self._c255(b), self._ca(a))
        m = re.match(r"#([0-9a-f]{6})$", s, re.I)
        if m:
            hexv = m.group(1)
            r = int(hexv[0:2], 16)
            g = int(hexv[2:4], 16)
            b = int(hexv[4:6], 16)
            return (r, g, b, 255)
        return default

    def _c255(self, v):  return max(0, min(255, int(v)))
    def _ca(self, a):    return max(0, min(255, int(round(float(a) * 255))))

    def _load_image_from_src(self, src):
        if not src:
            return None
        if isinstance(src, Image.Image):
            return src.convert("RGBA")
        s = str(src)
        try:
            if s.startswith("data:image/"):
                header, b64 = s.split(",", 1)
                raw = base64.b64decode(b64)
                return Image.open(io.BytesIO(raw)).convert("RGBA")
            else:
                # lokaler Pfad
                return Image.open(s).convert("RGBA")
        except Exception:
            return None

    def _fit_image(self, img, size_wh, object_fit="contain"):
        w, h = size_wh
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        if w <= 0 or h <= 0:
            return canvas

        if object_fit == "fill":
            scaled = img.resize((w, h), Image.LANCZOS)
            canvas.paste(scaled, (0, 0), scaled)
            return canvas

        iw, ih = img.size
        if iw == 0 or ih == 0:
            return canvas
        scale = min(w / iw, h / ih)
        nw = max(1, int(round(iw * scale)))
        nh = max(1, int(round(ih * scale)))
        scaled = img.resize((nw, nh), Image.LANCZOS)
        ox = (w - nw) // 2
        oy = (h - nh) // 2
        canvas.paste(scaled, (ox, oy), scaled)
        return canvas

    def _apply_opacity(self, rgba_img, opacity):
        if rgba_img.mode != "RGBA":
            rgba_img = rgba_img.convert("RGBA")
        r, g, b, a = rgba_img.split()
        a = a.point(lambda px: int(px * opacity))
        return Image.merge("RGBA", (r, g, b, a))

    def _paste_rgba(self, base, layer, xy):
        tmp = Image.new("RGBA", base.size, (0, 0, 0, 0))
        tmp.paste(layer, xy, layer)
        return Image.alpha_composite(base, tmp)

    def _wrap_text(self, text, font, max_width):
        hard_lines = text.replace("\r", "").split("\n")
        wrapped = []
        measurer = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        for hl in hard_lines:
            words = hl.split(" ")
            line = ""
            for w in words:
                test = w if not line else (line + " " + w)
                try:
                    ok_width = measurer.textlength(test, font=font)
                except Exception:
                    bbox = measurer.textbbox((0, 0), test, font=font)
                    ok_width = bbox[2] - bbox[0]
                if ok_width <= max_width or not line:
                    line = test
                else:
                    wrapped.append(line)
                    line = w
            wrapped.append(line)
        return wrapped

    def _pick_font_path(self, css_font_family: str, want_bold: bool = False, want_italic: bool = False):
        """
        Sucht passende TTF-Datei für (family, weight/style).
        Gibt (path, exact) zurück; italic-Dateien werden NUR genutzt, wenn want_italic=True.
        Ergänze die Pfade bei Bedarf für dein System.
        """
        raw = (css_font_family or "").split(",")[0].strip().strip("'").strip('"').lower()

        families = {
            "inter": [
                ("Inter-BoldItalic.ttf",  True,  True),
                ("Inter-Bold.ttf",        True,  False),
                ("Inter-Italic.ttf",      False, True),
                ("Inter-Regular.ttf",     False, False),
                ("Inter.ttf",             False, False),
            ],
            "roboto": [
                ("Roboto-BoldItalic.ttf", True,  True),
                ("Roboto-Bold.ttf",       True,  False),
                ("Roboto-Italic.ttf",     False, True),
                ("Roboto-Regular.ttf",    False, False),
                ("Roboto.ttf",            False, False),
            ],
            "arial": [
                ("arialbi.ttf",           True,  True),
                ("arialbd.ttf",           True,  False),
                ("ariali.ttf",            False, True),
                ("arial.ttf",             False, False),
                ("Arial.ttf",             False, False),
            ],
            "dejavu": [
                ("DejaVuSans-BoldOblique.ttf", True,  True),
                ("DejaVuSans-Bold.ttf",        True,  False),
                ("DejaVuSans-Oblique.ttf",     False, True),
                ("DejaVuSans.ttf",             False, False),
            ],
            "verdana": [
                ("verdanaz.ttf",          True,  True),
                ("verdanab.ttf",          True,  False),
                ("verdanai.ttf",          False, True),
                ("verdana.ttf",           False, False),
                ("Verdana.ttf",           False, False),
            ],
        }

        key = "dejavu"
        for fam in families:
            if fam in raw:
                key = fam
                break

        items = families[key]

        # Wenn Italic NICHT gewünscht, priorisieren wir strikt Nicht-Italic
        non_it = [t for t in items if not t[2]]
        it     = [t for t in items if t[2]]
        non_it.sort(key=lambda t: 0 if (t[1] == want_bold) else 1)
        it.sort(key=lambda t: 0 if (t[1] == want_bold) else 1)
        ordered = non_it + (it if want_italic else [])

        # Wenn Italic gewünscht: Italic vor Nicht-Italic
        if want_italic:
            ordered = sorted(items, key=lambda t: (t[2] != True) + (t[1] != want_bold))

        for path, is_bold, is_italic in ordered:
            if is_italic and not want_italic:
                continue
            try:
                ImageFont.truetype(path, 12)
                exact = (is_bold == want_bold and is_italic == want_italic)
                return path, exact
            except Exception:
                continue

        # Fallbacks: irgendein Nicht-Italic, dann Italic
        for path, is_bold, is_italic in items:
            if is_italic:
                continue
            try:
                ImageFont.truetype(path, 12)
                return path, False
            except Exception:
                continue
        for path, is_bold, is_italic in items:
            try:
                ImageFont.truetype(path, 12)
                return path, False
            except Exception:
                continue

        return None, False
