/**
 * shortcuts.js — keyboard shortcuts dialog
 */
(() => {
    "use strict";
    const openBtn = document.getElementById("open-shortcuts");
    const dialog = document.getElementById("shortcuts-dialog");
    const xBtn = document.getElementById("shortcuts-x");
    if (!openBtn || !dialog) return;

    const open = () => {
        dialog.classList.remove("hidden");
        openBtn.setAttribute("aria-expanded", "true");
        (dialog.querySelector("button,[href],summary") || dialog).focus({ preventScroll: true });
    };
    const close = () => {
        dialog.classList.add("hidden");
        openBtn.setAttribute("aria-expanded", "false");
        openBtn.focus({ preventScroll: true });
    };

    openBtn.addEventListener("click", open);
    (xBtn || dialog).addEventListener("click", close);
    dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dialog.classList.contains("hidden")) close(); });
})();
