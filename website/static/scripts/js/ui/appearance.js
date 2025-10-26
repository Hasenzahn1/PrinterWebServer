/**
 * appearance.js — theme & glass controls
 */
(() => {
    "use strict";

    const { qs, root, safeStorage } = window.App;
    const ddBtn = qs("#appearance-dropdown-btn");
    const menu = qs("#appearance-dropdown");
    const themeSwitch = qs("#theme-switch");
    const glassSwitch = qs("#glass-switch");
    const glassItem = qs("#glass-item");
    const themeBtn = qs("#theme-toggle"); // legacy
    const glassBtn = qs("#glass-btn");    // legacy

    const THEME_KEY = "site-theme";
    const GLASS_KEY = "site-glass";
    const GLASS_LINK_ID = "glass-stylesheet";
    const GLASS_HREF = "/styles/glas.css";

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
        input.nextElementSibling.style.background = on ? "var(--accent,#0a84ff)" : "#444";
        knob.style.transform = on ? "translateX(18px)" : "translateX(0)";
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

    // Glass
    const glassLink = () => document.getElementById(GLASS_LINK_ID);
    const enableGlass = () => {
        if (!glassLink()) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = GLASS_HREF;
            link.id = GLASS_LINK_ID;
            document.head.appendChild(link);
        }
        safeStorage.set(GLASS_KEY, "1");
        glassBtn?.setAttribute("aria-pressed", "true");
    };
    const disableGlass = () => {
        glassLink()?.remove();
        safeStorage.set(GLASS_KEY, "0");
        glassBtn?.setAttribute("aria-pressed", "false");
    };

    // Sync UI
    const sync = () => {
        const isDark = root.getAttribute("data-theme") === "dark";
        if (themeSwitch) { themeSwitch.checked = isDark; paintSlider(themeSwitch); }
        if (glassItem) { glassItem.style.display = ""; glassItem.setAttribute("aria-hidden", "false"); }
        if (glassSwitch) { glassSwitch.checked = !!glassLink(); paintSlider(glassSwitch); }
    };

    // Listeners
    themeSwitch?.addEventListener("change", () => {
        setTheme(themeSwitch.checked ? "dark" : "lyntr");
        paintSlider(themeSwitch);
        if (!themeSwitch.checked && glassSwitch?.checked) disableGlass();
        sync();
    });

    glassSwitch?.addEventListener("change", () => {
        paintSlider(glassSwitch);
        const on = glassSwitch.checked;
        if (on && root.getAttribute("data-theme") !== "dark") setTheme("dark");
        on ? enableGlass() : disableGlass();
        sync();
    });

    // Legacy buttons
    glassBtn?.addEventListener("click", () => { (glassLink() ? disableGlass : enableGlass)(); sync(); });
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
