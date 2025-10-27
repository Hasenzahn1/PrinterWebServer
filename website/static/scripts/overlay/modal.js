/**
 * modal.js — overlay editor modal & import/export filename
 */
document.addEventListener("DOMContentLoaded", () => {
    "use strict";
    const $ = (s, r = document) => r.querySelector(s);

    const importBtn = $(".import-btn");
    const exportBtn = $(".export-btn");
    const exportWrapper = $(".export-wrapper");
    const exportFilename = $("#export-filename");
    const overlayImage = $("#overlay-image");

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,application/json";
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    importBtn?.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        try {
            if (f.type.startsWith("image/")) {
                const url = URL.createObjectURL(f);
                if (overlayImage) overlayImage.src = url;
                if (exportFilename) exportFilename.value = (f.name.replace(/\.[^/.]+$/, "") || "overlay") + ".json";
            } else {
                const data = JSON.parse(await f.text());
                if (typeof data.image === "string" && data.image.startsWith("data:") && overlayImage) overlayImage.src = data.image;
                if (exportFilename) exportFilename.value = f.name || "overlay.json";
            }
        } catch {
            alert("Unable to read file. Use an image or a valid overlay JSON.");
        }
        fileInput.value = "";
    });

    exportBtn?.addEventListener("click", () => exportWrapper?.classList.toggle("hidden"));
});
