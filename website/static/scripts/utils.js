// utils.js — shared helpers (no imports required)
(function(){
  const App = {
    qs  : (s, r=document) => r.querySelector(s),
    qsa : (s, r=document) => Array.from(r.querySelectorAll(s)),
    root: document.documentElement,
    safeStorage: {
      get(k){ try { return localStorage.getItem(k); } catch { return null; } },
      set(k,v){ try { localStorage.setItem(k,v); } catch {} },
    }
  };
  window.App = App;
})();
