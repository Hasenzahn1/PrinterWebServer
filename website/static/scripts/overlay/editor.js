/**
 * editor.js — overlay editor (text/images, serialize/import, shortcuts)
 */
(() => {
    "use strict";

    const $ = (s, r = document) => r.querySelector(s);
    const stage = $("#overlay-stage");
    const layer = $("#overlay-layer");

    const inputText = $("#text-content");
    const fontFamily = $("#font-family");
    const fontSize = $("#font-size");
    const color = $("#text-color");
    const bg = $("#bg-color");
    const textAlpha = $("#text-alpha");
    const bgAlpha = $("#bg-alpha");
    const align = $("#text-align");
    const rotation = $("#rotation");
    const opacity = $("#opacity");

    const boldBtn = $("#toggle-bold");
    const italicBtn = $("#toggle-italic");
    const underlineBtn = $("#toggle-underline");

    const forwardBtn = $("#bring-forward");
    const backwardBtn = $("#send-backward");
    const deleteBtn = $("#delete-text");

    let selected = null;
    let drag = null;
    let zCounter = 10;
    let resizingNode = null;

    const clamp = (v, min, max) => Math.min(Math.max(+v || 0, min), max);
    const getFontPx = (node) => parseFloat(getComputedStyle(node).fontSize) || 24;
    const setFontPx = (node, px) => { node.style.fontSize = clamp(px, 8, 300) + "px"; if (selected === node && fontSize) fontSize.value = Math.round(clamp(px, 8, 300)); };
    const setRotation = (node, deg) => { const v = String(deg).includes("deg") ? String(deg) : deg + "deg"; node.style.rotate = v; node.style.transform = `rotate(${v.replace("deg","")}deg)`; };

    const hexToRgb = (hex6) => {
        let h = (hex6 || "#000000").replace("#", "");
        if (h.length === 3) h = h.split("").map((c) => c + c).join("");
        return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
    };
    const applyCssColor = (node, prop, hex6, alpha = 1) => {
        const a = clamp(parseFloat(alpha), 0, 1);
        const { r, g, b } = hexToRgb(hex6 || "#000000");
        node.style[prop] = `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    // Selection
    const select = (node) => {
        if (selected === node) return;
        selected?.classList.remove("selected");
        selected = node || null;
        if (!selected) return;
        selected.classList.add("selected");

        const cs = getComputedStyle(selected);
        if (selected.dataset.type === "text") {
            inputText && (inputText.value = selected.innerText);
            fontFamily && (fontFamily.value = selected.style.fontFamily || "Inter, system-ui, sans-serif");
            fontSize && (fontSize.value = parseInt(selected.style.fontSize || 24, 10));
            if (color) { const m = cs.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); if (m) { const [ , r,g,b,a ] = m; color.value = "#" + [r,g,b].map(n => (+n).toString(16).padStart(2,"0")).join(""); textAlpha && (textAlpha.value = (a ?? 1)); } }
            if (bg) { const m = cs.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); if (m) { const [ , r,g,b,a ] = m; bg.value = "#" + [r,g,b].map(n => (+n).toString(16).padStart(2,"0")).join(""); bgAlpha && (bgAlpha.value = (a ?? 1)); } else { bg.value = "#000000"; bgAlpha && (bgAlpha.value = "0"); } }
            align && (align.value = selected.style.textAlign || "left");
            updateToggleState();
        } else {
            inputText && (inputText.value = "");
            fontFamily && (fontFamily.value = "");
            fontSize && (fontSize.value = "");
            color && (color.value = "#ffffff"); textAlpha && (textAlpha.value = "1");
            bg && (bg.value = "#000000"); bgAlpha && (bgAlpha.value = "0");
            align && (align.value = "");
            boldBtn && (boldBtn.ariaPressed = "false");
            italicBtn && (italicBtn.ariaPressed = "false");
            underlineBtn && (underlineBtn.ariaPressed = "false");
        }
        rotation && (rotation.value = parseInt((selected.style.rotate || "0").replace("deg",""), 10) || 0);
        opacity && (opacity.value = selected.style.opacity || 1);
    };

    // Resize Observer to scale text with width
    const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const node = entry.target;
            if (node.dataset.resizing !== "1" || node.dataset.type !== "text") continue;
            const baseW = parseFloat(node.dataset.baseWidth) || 0;
            const baseFont = parseFloat(node.dataset.baseFont) || getFontPx(node);
            if (!baseW) continue;
            setFontPx(node, baseFont * (node.offsetWidth / baseW));
        }
    });

    // Node creation
    const createTextNode = (text = "Double-click to edit") => {
        const node = document.createElement("div");
        node.className = "text-node";
        node.dataset.type = "text";
        node.textContent = text;
        Object.assign(node.style, { position: "absolute", left: "10%", top: "10%", zIndex: String(++zCounter), fontFamily: "Inter, system-ui, sans-serif", fontSize: "24px" });
        layer.appendChild(node);
        attachNodeEvents(node);
        ro.observe(node);
        select(node);
        return node;
    };

    const createImageNode = (src) => {
        const node = document.createElement("div");
        node.className = "image-node";
        node.dataset.type = "image";
        Object.assign(node.style, { position: "absolute", left: "10%", top: "10%", zIndex: String(++zCounter), width: "200px", height: "200px", resize: "both", overflow: "hidden", cursor: "move" });
        const img = document.createElement("img");
        Object.assign(img, { src, alt: "" });
        Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" });
        node.appendChild(img);
        layer.appendChild(node);
        attachNodeEvents(node);
        select(node);
        return node;
    };

    // Events
    const startDragOrResize = (node, e) => {
        const rect = node.getBoundingClientRect();
        const nearEdge = (x, edge) => Math.abs(x - edge) <= 14;
        if (nearEdge(e.clientX, rect.right) || nearEdge(e.clientY, rect.bottom)) {
            node.dataset.resizing = "1";
            if (node.dataset.type === "text") {
                node.dataset.baseWidth = String(node.offsetWidth);
                node.dataset.baseFont = String(getFontPx(node));
            }
            resizingNode = node;
            return;
        }
        drag = { startX: e.clientX, startY: e.clientY, left: node.offsetLeft, top: node.offsetTop };
    };

    const onPointerMove = (e, node) => {
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const maxLeft = stage.clientWidth - node.offsetWidth;
        const maxTop = stage.clientHeight - node.offsetHeight;
        node.style.left = clamp(drag.left + dx, 0, Math.max(0, maxLeft)) + "px";
        node.style.top = clamp(drag.top + dy, 0, Math.max(0, maxTop)) + "px";
    };

    const attachNodeEvents = (node) => {
        node.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            select(node);
            startDragOrResize(node, e);
            try { node.setPointerCapture(e.pointerId); } catch {}
            e.preventDefault();
        });
        node.addEventListener("pointermove", (e) => onPointerMove(e, node));
        node.addEventListener("pointerup", () => { drag = null; });
        node.addEventListener("lostpointercapture", () => { drag = null; });
        node.addEventListener("click", (e) => { select(node); e.stopPropagation(); });

        if (node.dataset.type === "text") {
            node.addEventListener("dblclick", () => { node.contentEditable = "true"; node.focus(); document.getSelection?.().collapseToEnd(); });
            node.addEventListener("blur", () => { node.contentEditable = "false"; if (inputText) inputText.value = node.innerText; });
            ro.observe(node);
        }
    };

    window.addEventListener("pointerup", () => {
        if (resizingNode) {
            resizingNode.dataset.resizing = "0";
            delete resizingNode.dataset.baseWidth;
            delete resizingNode.dataset.baseFont;
            resizingNode = null;
        }
    });
    layer && layer.addEventListener("click", () => select(null));

    // Toolbar Buttons
    $(".add-text")?.addEventListener("click", () => { createTextNode(); inputText?.focus(); inputText?.select(); });
    $(".add-image")?.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/*";
        input.addEventListener("change", async () => { const f = input.files?.[0]; if (!f) return; createImageNode(URL.createObjectURL(f)); });
        input.click();
    });

    // Inputs
    inputText?.addEventListener("input", () => { if (selected?.dataset.type === "text") selected.textContent = inputText.value; });
    fontFamily?.addEventListener("change", () => { if (selected?.dataset.type === "text") selected.style.fontFamily = fontFamily.value; });
    fontSize?.addEventListener("input", () => { if (selected?.dataset.type === "text") setFontPx(selected, parseFloat(fontSize.value || 24)); });
    const updateTextColor = () => { if (selected?.dataset.type === "text") applyCssColor(selected, "color", color.value, textAlpha?.value ?? 1); };
    const updateBgColor = () => { if (selected?.dataset.type === "text") applyCssColor(selected, "backgroundColor", bg.value, bgAlpha?.value ?? 0); };
    color?.addEventListener("input", updateTextColor);
    textAlpha?.addEventListener("input", updateTextColor);
    bg?.addEventListener("input", updateBgColor);
    bgAlpha?.addEventListener("input", updateBgColor);
    rotation?.addEventListener("input", () => { if (selected) setRotation(selected, rotation.value); });
    opacity?.addEventListener("input", () => { if (selected) selected.style.opacity = opacity.value; });

    const updateToggleState = () => {
        if (!(selected && selected.dataset.type === "text")) {
            boldBtn && (boldBtn.ariaPressed = "false");
            italicBtn && (italicBtn.ariaPressed = "false");
            underlineBtn && (underlineBtn.ariaPressed = "false");
            return;
        }
        boldBtn && (boldBtn.ariaPressed = String(/^(bold|700)$/i.test(selected.style.fontWeight)));
        italicBtn && (italicBtn.ariaPressed = String(selected.style.fontStyle === "italic"));
        underlineBtn && (underlineBtn.ariaPressed = String((selected.style.textDecoration || "").includes("underline")));
    };

    boldBtn?.addEventListener("click", () => { if (selected?.dataset.type === "text") { selected.style.fontWeight = /^(bold|700)$/i.test(selected.style.fontWeight) ? "400" : "700"; updateToggleState(); } });
    italicBtn?.addEventListener("click", () => { if (selected?.dataset.type === "text") { selected.style.fontStyle = selected.style.fontStyle === "italic" ? "normal" : "italic"; updateToggleState(); } });
    underlineBtn?.addEventListener("click", () => { if (selected?.dataset.type === "text") { const has = (selected.style.textDecoration || "").includes("underline"); selected.style.textDecoration = has ? "none" : "underline"; updateToggleState(); } });

    forwardBtn?.addEventListener("click", () => { if (selected) selected.style.zIndex = String(++zCounter); });
    backwardBtn?.addEventListener("click", () => { if (selected) selected.style.zIndex = String(Math.max(1, (+selected.style.zIndex || 1) - 1)); });
    deleteBtn?.addEventListener("click", () => { if (!selected) return; const rm = selected; select(null); if (rm.dataset.type === "text") ro.unobserve(rm); rm.remove(); });

    // Serialization
    const toDataURL = async (src) => {
        if (!src || src.startsWith("data:")) return src || null;
        try {
            const resp = await fetch(src); const blob = await resp.blob();
            return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        } catch { return src; }
    };

    const serializeNodeAsync = async (node) => {
        const common = {
            type: node.dataset.type || "text",
            left: Math.round(node.offsetLeft),
            top: Math.round(node.offsetTop),
            width: node.offsetWidth,
            height: node.offsetHeight,
            zIndex: +node.style.zIndex || 1,
            rotate: node.style.rotate || node.style.transform || "",
            opacity: node.style.opacity ?? 1
        };
        if (node.dataset.type === "image") {
            const img = node.querySelector("img");
            return { ...common, src: await toDataURL(img?.src || ""), objectFit: img?.style.objectFit || "contain" };
        }
        return {
            ...common,
            text: node.innerText,
            fontFamily: node.style.fontFamily || "",
            fontSize: node.style.fontSize || "",
            color: node.style.color || "",
            backgroundColor: node.style.backgroundColor || "",
            textAlign: node.style.textAlign || "",
            fontWeight: node.style.fontWeight || "",
            fontStyle: node.style.fontStyle || "",
            textDecoration: node.style.textDecoration || ""
        };
    };

    const serializeOverlay = async () => {
        if (!layer) return { exportedAt: new Date().toISOString(), nodes: [] };
        const imgEl = $("#overlay-image");
        const nodes = Array.from(layer.querySelectorAll(".text-node, .image-node"));
        const arr = [];
        for (const n of nodes) arr.push(await serializeNodeAsync(n));
        return { exportedAt: new Date().toISOString(), image: imgEl ? imgEl.src : null, nodes: arr };
    };

    // Import
    const clearNodes = () => {
        if (!layer) return;
        for (const n of Array.from(layer.querySelectorAll(".text-node, .image-node"))) { if (n.dataset.type === "text") ro.unobserve(n); n.remove(); }
        selected = null; drag = null;
    };

    const createNodeFromData = (d) => {
        if (!layer || !d) return null;
        if (d.type === "image") {
            const node = document.createElement("div");
            node.className = "image-node"; node.dataset.type = "image";
            Object.assign(node.style, { position: "absolute", left: (typeof d.left === "number" ? d.left + "px" : d.left || "10%"), top: (typeof d.top === "number" ? d.top + "px" : d.top || "10%"), resize: "both", overflow: "hidden", cursor: "move" });
            if (d.width) node.style.width = d.width + "px";
            if (d.height) node.style.height = d.height + "px";
            if (d.zIndex) node.style.zIndex = String(d.zIndex);
            if (d.rotate != null) setRotation(node, d.rotate);
            if (d.opacity != null) node.style.opacity = String(d.opacity);
            const img = document.createElement("img");
            Object.assign(img, { src: d.src || "", alt: "" });
            Object.assign(img.style, { width: "100%", height: "100%", objectFit: d.objectFit || "contain", pointerEvents: "none" });
            node.appendChild(img);
            layer.appendChild(node); attachNodeEvents(node);
            return node;
        }
        const node = document.createElement("div");
        node.className = "text-node"; node.dataset.type = "text";
        node.textContent = d.text || "";
        Object.assign(node.style, { position: "absolute", left: (typeof d.left === "number" ? d.left + "px" : d.left || "10%"), top: (typeof d.top === "number" ? d.top + "px" : d.top || "10%") });
        if (d.width) node.style.width = d.width + "px";
        if (d.height) node.style.height = d.height + "px";
        if (d.zIndex) node.style.zIndex = String(d.zIndex);
        if (d.fontFamily) node.style.fontFamily = d.fontFamily;
        if (d.fontSize) node.style.fontSize = d.fontSize;
        if (d.color) node.style.color = d.color;
        if (d.backgroundColor) node.style.backgroundColor = d.backgroundColor;
        if (d.textAlign) node.style.textAlign = d.textAlign;
        if (d.rotate != null) setRotation(node, d.rotate);
        if (d.opacity != null) node.style.opacity = String(d.opacity);
        if (d.fontWeight) node.style.fontWeight = d.fontWeight;
        if (d.fontStyle) node.style.fontStyle = d.fontStyle;
        if (d.textDecoration) node.style.textDecoration = d.textDecoration;
        layer.appendChild(node); attachNodeEvents(node); ro.observe(node);
        return node;
    };

    const importOverlayFromObject = async (obj) => {
        if (!obj || !layer) return;
        if (Array.isArray(obj.nodes)) { clearNodes(); for (const n of obj.nodes) createNodeFromData(n); }
    };

    // Export UI — file download
    const attachExportHandler = () => {
        const btn = document.querySelector(".export-confirm-btn");
        const filenameEl = $("#export-filename");
        if (!btn || !filenameEl) return;

        btn.addEventListener("click", async () => {
            let filename = (filenameEl.value?.trim()) || "overlay.json";
            if (!filename.toLowerCase().endsWith(".json")) filename += ".json";
            try {
                const payload = await serializeOverlay();
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const form = new FormData();
                form.append("template", blob, filename);

                const resp = await fetch("/api/template/upload", {
                    method: "POST",
                    body: form,
                    credentials: "same-origin"
                });

                if (resp.status === 201) {
                    alert("Template uploaded: " + filename);
                } else {
                    const body = await resp.text().catch(() => resp.statusText || String(resp.status));
                    alert("Failed to upload template: " + (body || resp.status));
                }
            } catch (err) {
                console.warn("Upload error", err);
                alert("Error uploading template");
            }
        });
    };

    // Global import (image or JSON)
    const attachToGlobalFileInput = () => {
        const fileInput = document.querySelector('input[type="file"][accept="image/*,application/json"]');
        if (!fileInput) return;
        fileInput.addEventListener("change", async () => {
            const f = fileInput.files?.[0]; if (!f) return;
            if (f.type === "application/json" || f.name.toLowerCase().endsWith(".json")) {
                try { await importOverlayFromObject(JSON.parse(await f.text())); } catch { console.warn("Invalid overlay JSON"); }
            } else if (f.type.startsWith("image/")) {
                const fr = new FileReader(); fr.onload = () => { const imgEl = $("#overlay-image"); imgEl ? (imgEl.src = fr.result) : createImageNode(fr.result); }; fr.readAsDataURL(f);
            }
        });
    };

    // Keyboard Shortcuts
    const attachKeyboardShortcuts = () => {
        document.addEventListener("keydown", async (e) => {
            const active = document.activeElement;
            const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
            const mod = e.ctrlKey || e.metaKey;

            const nudge = (dx, dy) => {
                if (!selected) return;
                const maxLeft = stage.clientWidth - selected.offsetWidth;
                const maxTop = stage.clientHeight - selected.offsetHeight;
                selected.style.left = clamp((parseFloat(selected.style.left) || selected.offsetLeft) + dx, 0, Math.max(0, maxLeft)) + "px";
                selected.style.top = clamp((parseFloat(selected.style.top) || selected.offsetTop) + dy, 0, Math.max(0, maxTop)) + "px";
                e.preventDefault();
            };

            if (e.key === "Escape") { select(null); e.preventDefault(); return; }
            if ((e.key === "Delete" || e.key === "Backspace") && !typing) {
                if (selected) { const rm = selected; select(null); if (rm.dataset.type === "text") ro.unobserve(rm); rm.remove(); e.preventDefault(); }
                return;
            }

            switch (e.key) {
                case "ArrowLeft": if (selected) { nudge(-(e.shiftKey ? 10 : 1), 0); return; } break;
                case "ArrowRight": if (selected) { nudge((e.shiftKey ? 10 : 1), 0); return; } break;
                case "ArrowUp":
                    if (mod && selected) { selected.style.zIndex = String(++zCounter); e.preventDefault(); return; }
                    if (selected) { nudge(0, -(e.shiftKey ? 10 : 1)); return; }
                    break;
                case "ArrowDown":
                    if (mod && selected) { selected.style.zIndex = String(Math.max(1, (+selected.style.zIndex || 1) - 1)); e.preventDefault(); return; }
                    if (selected) { nudge(0, (e.shiftKey ? 10 : 1)); return; }
                    break;
            }

            if (!e.altKey) return;
            const k = e.key.toLowerCase();

            if (k === "s") { // Alt+S save/export
                e.preventDefault();
                const filenameEl = $("#export-filename");
                let filename = (filenameEl?.value?.trim()) || "overlay.json";
                if (!filename.toLowerCase().endsWith(".json")) filename += ".json";
                try {
                    const payload = await serializeOverlay();
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                } catch {}
                return;
            }
            if (k === "t") { e.preventDefault(); const n = createTextNode(); if (n) select(n); return; }            // Alt+T add text
            if (k === "d") {                                                                                         // Alt+D duplicate
                if (!selected) return;
                e.preventDefault();
                const data = await serializeNodeAsync(selected);
                if (typeof data.left === "number") data.left += 10;
                if (typeof data.top === "number") data.top += 10;
                data.zIndex = ++zCounter;
                const nn = createNodeFromData(data); if (nn) select(nn);
                return;
            }
            if (k === "b") { if (selected?.dataset.type === "text") { e.preventDefault(); selected.style.fontWeight = /^(bold|700)$/i.test(selected.style.fontWeight) ? "400" : "700"; updateToggleState(); } return; } // Alt+B
            if (k === "i" && e.shiftKey) { if (selected?.dataset.type === "text") { e.preventDefault(); selected.style.fontStyle = selected.style.fontStyle === "italic" ? "normal" : "italic"; updateToggleState(); } return; } // Alt+Shift+I
            if (k === "u") { if (selected?.dataset.type === "text") { e.preventDefault(); const has = (selected.style.textDecoration || "").includes("underline"); selected.style.textDecoration = has ? "none" : "underline"; updateToggleState(); } return; } // Alt+U
            if (k === "i" && !e.shiftKey) { e.preventDefault(); document.querySelector(".add-image")?.click(); return; } // Alt+I add image
        });
    };

    // Resizing support
    (() => {
        if (!stage || !layer) return;

        const MIN_W = 20;
        const MIN_H = 20;

        const updateHoverCursor = (e) => {
            if (drag || resizingNode) return;
            const n = e.target && e.target.closest && e.target.closest(".text-node, .image-node");
            if (!n) { layer.style.cursor = "default"; return; }
            const r = n.getBoundingClientRect();
            const near = (v, edge) => Math.abs(v - edge) <= 14;
            const overResize = near(e.clientX, r.right) || near(e.clientY, r.bottom);
            layer.style.cursor = overResize ? "nwse-resize" : "move";
        };

        layer.addEventListener("pointermove", updateHoverCursor);
        layer.addEventListener("mouseleave", () => { if (!resizingNode && !drag) layer.style.cursor = "default"; });

        window.addEventListener("pointermove", (e) => {
            if (!resizingNode) return;
            const rect = stage.getBoundingClientRect();
            const x = clamp(e.clientX - rect.left, 0, stage.clientWidth);
            const y = clamp(e.clientY - rect.top, 0, stage.clientHeight);

            const left = resizingNode.offsetLeft;
            const top = resizingNode.offsetTop;

            let newW = clamp(x - left, MIN_W, Math.max(MIN_W, stage.clientWidth - left));
            let newH = clamp(y - top, MIN_H, Math.max(MIN_H, stage.clientHeight - top));

            if (e.shiftKey && resizingNode.dataset.type === "image") {
                const currW = Math.max(1, resizingNode.offsetWidth || newW);
                const currH = Math.max(1, resizingNode.offsetHeight || newH);
                const ratio = currH / currW;
                if (newW * ratio > newH) newW = newH / ratio; else newH = newW * ratio;
            }

            resizingNode.style.width = Math.round(newW) + "px";
            resizingNode.style.height = Math.round(newH) + "px";
            e.preventDefault();
        });
    })();

    // Init
    document.addEventListener("DOMContentLoaded", () => {
        attachToGlobalFileInput();
        attachExportHandler();
        layer && layer.addEventListener("click", () => select(null));
        attachKeyboardShortcuts();
    });

    // Public API
    window.overlayEditor = Object.assign(window.overlayEditor || {}, {
        serialize: serializeOverlay,
        importObject: importOverlayFromObject,
        clearNodes,
        createNodeFromData
    });
})();
