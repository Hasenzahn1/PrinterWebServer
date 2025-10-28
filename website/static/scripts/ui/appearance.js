/**
 * appearance.js — theme & glass controls
 */
(() => {
    "use strict";

    const { qs, root, safeStorage } = window.App;
    const ddBtn = qs("#appearance-dropdown-btn");
    const menu = qs("#appearance-dropdown");
    const themeSwitch = qs("#theme-switch");

    const THEME_KEY = "site-theme";

    // Dropdown
    const setMenu = (open) => {
        if (!menu || !ddBtn) return;
        menu.classList.toggle("hidden", !open);
        ddBtn.setAttribute("aria-expanded", String(!!open));
    };
    ddBtn?.addEventListener("click", (e) => { e.stopPropagation(); setMenu(menu?.classList.contains("hidden")); });
    document.addEventListener("click", (e) => {
        if (!menu || !ddBtn) return;
        if (!menu.contains(e.target) && !ddBtn.contains(e.target)) setMenu(false);
    });

    // Slider UI
    const paintSlider = (input) => {
        const knob = input?.nextElementSibling?.firstElementChild;
        if (!input || !knob) return;
        const on = input.checked;
    };

    // Theme
    const setTheme = (theme) => {
        root.setAttribute("data-theme", theme);
        safeStorage.set(THEME_KEY, theme);
        if (!themeBtn) return;
        const isDark = theme === "dark";
        themeBtn.setAttribute("aria-pressed", String(isDark));
        themeBtn.title = isDark ? "Switch to Lyntr theme" : "Switch to Dark theme";
        themeBtn.textContent = isDark ? "Dark" : "Lyntr";
    };

    // Sync UI
    const sync = () => {
        const isDark = root.getAttribute("data-theme") === "dark";
        if (themeSwitch) { themeSwitch.checked = isDark; paintSlider(themeSwitch); }
    };

    // Listeners
    themeSwitch?.addEventListener("change", () => {
        setTheme(themeSwitch.checked ? "dark" : "lyntr");
        paintSlider(themeSwitch);
        sync();
    });

    // Legacy buttons
    themeBtn?.addEventListener("click", () => { setTheme(root.getAttribute("data-theme") === "dark" ? "lyntr" : "dark"); sync(); });

    // Init
    const initialTheme = safeStorage.get(THEME_KEY) || (matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "lyntr");
    setTheme(initialTheme);
    if (safeStorage.get(GLASS_KEY) === "1") enableGlass();

    // Observe external changes
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    obs.observe(document.head, { childList: true, subtree: true });
    sync();
})();
