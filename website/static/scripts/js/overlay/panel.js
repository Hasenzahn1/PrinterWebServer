/**
 * panel.js — overlay templates & assets side panel
 */
(() => {
    "use strict";
    const { qs, qsa, safeStorage } = window.App;
    const panel = qs("#overlay-search-panel") || qs(".overlay-search");
    const toggle = panel ? qs(".collapse-toggle", panel) : null;

    const applyState = (el, collapsed, tgl) => {
        el.classList.toggle("collapsed", collapsed);
        tgl?.setAttribute("aria-expanded", String(!collapsed));
        if (tgl) tgl.title = collapsed ? "Expand panel" : "Collapse panel";
    };

    if (panel && toggle) {
        panel.classList.add("open");
        const KEY = "overlayTemplatesCollapsed";
        applyState(panel, safeStorage.get(KEY) === "1", toggle);
        toggle.addEventListener("click", () => {
            const next = !panel.classList.contains("collapsed");
            applyState(panel, next, toggle);
            safeStorage.set(KEY, next ? "1" : "0");
        });
    }

    const assetsPanel = qs("#assets-panel") || qs(".assets-panel");
    const assetsToggle = assetsPanel ? qs(".assets-collapse-toggle", assetsPanel) : null;
    if (assetsPanel && assetsToggle) {
        assetsPanel.classList.add("open");
        const KEY = "assetsPanelCollapsed";
        applyState(assetsPanel, safeStorage.get(KEY) === "1", assetsToggle);
        assetsToggle.addEventListener("click", () => {
            const next = !assetsPanel.classList.contains("collapsed");
            applyState(assetsPanel, next, assetsToggle);
            safeStorage.set(KEY, next ? "1" : "0");
        });
    }

    // Template previews
    const list = panel ? qs(".overlay-templates-list", panel) : null;
    if (list) {
        const createNode = (d) => {
            const n = document.createElement("div");
            n.className = "text-node";
            n.textContent = d.text || "";
            n.style.position = "absolute";
            if (d.left != null) n.style.left = typeof d.left === "number" ? d.left + "px" : d.left;
            if (d.top != null) n.style.top = typeof d.top === "number" ? d.top + "px" : d.top;
            if (d.width) n.style.width = typeof d.width === "number" ? d.width + "px" : d.width;
            if (d.height) n.style.height = typeof d.height === "number" ? d.height + "px" : d.height;
            if (d.zIndex) n.style.zIndex = String(d.zIndex);
            if (d.fontFamily) n.style.fontFamily = d.fontFamily;
            if (d.fontSize) n.style.fontSize = typeof d.fontSize === "number" ? d.fontSize + "px" : d.fontSize;
            if (d.color) n.style.color = d.color;
            if (d.backgroundColor) n.style.backgroundColor = d.backgroundColor;
            if (d.textAlign) n.style.textAlign = d.textAlign;
            if (d.rotate != null) {
                const r = String(d.rotate).includes("deg") ? d.rotate : d.rotate + "deg";
                n.style.rotate = r;
                n.style.transform = `rotate(${r.replace("deg", "")}deg)`;
            }
            if (d.opacity != null) n.style.opacity = String(d.opacity);
            if (d.fontWeight) n.style.fontWeight = d.fontWeight;
            if (d.fontStyle) n.style.fontStyle = d.fontStyle;
            if (d.textDecoration) n.style.textDecoration = d.textDecoration;
            n.style.pointerEvents = "none";
            return n;
        };

        qsa(".template-item").forEach((li) => {
            const jsonUrl = li.dataset.json;
            if (!jsonUrl) return;
            const layer = qs(".overlay-layer", li);
            fetch(jsonUrl, { cache: "no-store" })
                .then((r) => r.ok ? r.json() : null)
                .then((obj) => obj?.nodes?.forEach((n) => layer.appendChild(createNode(n))))
                .catch(() => {});
        });

        list.addEventListener("click", async (ev) => {
            const btn = ev.target.closest("button");
            if (!btn) return;
            const li = ev.target.closest(".template-item");
            if (!li) return;
            const file = btn.dataset.file;
            const jsonUrl = li.dataset.json;

            if (btn.classList.contains("import-template")) {
                try {
                    const res = await fetch(jsonUrl, { cache: "no-store" });
                    if (!res.ok) return alert("Failed to load template.");
                    const obj = await res.json();
                    window.overlayEditor?.importObject ? window.overlayEditor.importObject(obj) : alert("Overlay editor not ready.");
                } catch { alert("Failed to import template."); }
                return;
            }

            if (btn.classList.contains("delete-template")) {
                if (!file || !confirm(`Delete template "${file}"? This cannot be undone.`)) return;
                btn.disabled = true; const prev = btn.textContent; btn.textContent = "Deleting...";
                try {
                    const res = await fetch("/api/template/delete/" + encodeURIComponent(file), { method: "DELETE" });
                    if (res.status === 204) li.remove();
                    else if (res.status === 404) { alert("Template not found: " + file); Object.assign(btn, { disabled: false, textContent: prev }); }
                    else { alert("Failed to delete template."); Object.assign(btn, { disabled: false, textContent: prev }); }
                } catch { alert("Error deleting template."); Object.assign(btn, { disabled: false, textContent: prev }); }
            }
        });
    }

    // Assets
    const assetsList = qs(".overlay-assets-list");
    if (!assetsList) return;

    const dataUrlFromBlob = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });

    const getEditorCanvasSize = (ed) => {
        try {
            if (!ed) return null;
            if (typeof ed.getCanvasSize === "function") return ed.getCanvasSize();
            if (ed.canvas) return { width: ed.canvas.width || ed.canvas.clientWidth, height: ed.canvas.height || ed.canvas.clientHeight };
        } catch {}
        return null;
    };

    assetsList.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("button");
        if (!btn) return;
        const li = ev.target.closest(".asset-item");
        if (!li) return;
        const file = btn.dataset.file;
        const img = qs("img.asset-image", li);
        const url = img?.src || (file ? (location.origin + "/static/overlay-assets/" + encodeURIComponent(file)) : null);

        const importSingle = async (item) => {
            const i = qs("img.asset-image", item);
            const f = qs("button.import-asset", item)?.dataset.file;
            const u = i?.src || (f ? (location.origin + "/static/overlay-assets/" + encodeURIComponent(f)) : null);
            if (!u) return;
            try {
                const editor = window.overlayEditor;
                const target = getEditorCanvasSize(editor) || { width: 300, height: 300 };
                const res = await fetch(u, { cache: "no-store" });
                if (!res.ok) return alert("Failed to load asset: " + (f || u));
                const dataUrl = await dataUrlFromBlob(await res.blob());

                if (editor?.importImageFromUrl) return void editor.importImageFromUrl(u, { filename: f, width: target.width, height: target.height }).catch(()=>{});
                if (editor?.importImage) return void editor.addNode(dataUrl, { filename: f, width: target.width, height: target.height }).catch(()=>{});
                if (editor?.importObject) return void editor.importObject({ nodes: [{ type: "image", src: dataUrl, filename: f, width: target.width, height: target.height, left: 0, top: 0 }] });
                alert("Overlay editor does not support importing assets programmatically.");
            } catch { alert("Failed to import asset: " + (f || "")); }
        };

        if (btn.classList.contains("import-asset")) {
            if (!url) return alert("Asset URL not found.");
            if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
                btn.disabled = true; const t = btn.textContent; btn.textContent = "Importing...";
                for (const item of assetsList.querySelectorAll(".asset-item")) await importSingle(item);
                btn.textContent = t; btn.disabled = false;
            } else {
                await importSingle(li);
            }
            return;
        }

        if (btn.classList.contains("delete-asset")) {
            if (!file || !confirm(`Delete asset "${file}"? This cannot be undone.`)) return;
            btn.disabled = true; const prev = btn.textContent; btn.textContent = "Deleting...";
            try {
                const res = await fetch("/api/asset/delete/" + encodeURIComponent(file), { method: "DELETE" });
                if (res.status === 204) li.remove();
                else if (res.status === 404) { alert("Asset not found: " + file); Object.assign(btn, { disabled: false, textContent: prev }); }
                else { alert("Failed to delete asset."); Object.assign(btn, { disabled: false, textContent: prev }); }
            } catch { alert("Error deleting asset."); Object.assign(btn, { disabled: false, textContent: prev }); }
        }
    });
})();
