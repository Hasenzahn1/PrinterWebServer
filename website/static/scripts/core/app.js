/**
 * app.js — tiny global helpers
 * Exposes a single `window.App` object.
 */
(() => {
    "use strict";

    const root = document.documentElement;

    const App = {
        qs: (s, r = document) => r.querySelector(s),
        qsa: (s, r = document) => Array.from(r.querySelectorAll(s)),
        root,
        safeStorage: {
            get(k) { try { return localStorage.getItem(k); } catch { return null; } },
            set(k, v) { try { localStorage.setItem(k, v); } catch {} }
        },
        clamp(n, min, max) { return Math.min(Math.max(+n || 0, min), max); }
    };

    window.App = App;
})();
