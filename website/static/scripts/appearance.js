// appearance.js
(function(){
  const { qs, qsa, root, safeStorage } = window.App;

  const ddBtn = qs('#appearance-dropdown-btn');
  const menu  = qs('#appearance-dropdown');
  const themeSwitch = qs('#theme-switch');
  const THEME_KEY = 'site-theme';
  const GLASS_KEY = 'site-glass';
  const GLASS_LINK_ID = 'glass-stylesheet';

  function open(){ menu.classList.remove('hidden'); ddBtn.setAttribute('aria-expanded','true'); }
  function close(){ menu.classList.add('hidden'); ddBtn.setAttribute('aria-expanded','false'); }

  ddBtn?.addEventListener('click', e => { e.stopPropagation(); menu.classList.contains('hidden') ? open() : close(); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && !ddBtn.contains(e.target)) close(); });

  function applySliderVisual(input){
    const slider = input?.nextElementSibling; if (!slider) return;
    const knob = slider.firstElementChild;
    const on = !!input.checked;
    slider.style.background = on ? 'var(--accent,#0a84ff)' : '#444';
    if (knob) knob.style.transform = on ? 'translateX(18px)' : 'translateX(0)';
  }

  function setTheme(theme){
    root.setAttribute('data-theme', theme);
    safeStorage.set(THEME_KEY, theme);
    if (themeBtn){
      const isDark = theme === 'dark';
      themeBtn.setAttribute('aria-pressed', String(isDark));
      themeBtn.title = isDark ? 'Switch to Lyntr theme' : 'Switch to Dark theme';
      themeBtn.textContent = isDark ? 'Dark' : 'Lyntr';
    }
  }

  function enableGlass(){
    if (!document.getElementById(GLASS_LINK_ID)){
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GLASS_HREF;
      link.id = GLASS_LINK_ID;
      document.head.appendChild(link);
    }
    safeStorage.set(GLASS_KEY, '1');
    if (glassBtn) glassBtn.setAttribute('aria-pressed','true');
  }
  function disableGlass(){
    document.getElementById(GLASS_LINK_ID)?.remove();
    safeStorage.set(GLASS_KEY, '0');
    if (glassBtn) glassBtn.setAttribute('aria-pressed','false');
  }

  function sync(){
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (themeSwitch){ themeSwitch.checked = isDark; applySliderVisual(themeSwitch); }
    if (glassItem){ glassItem.style.display=''; glassItem.setAttribute('aria-hidden','false'); }
    if (glassSwitch){ glassSwitch.checked = !!document.getElementById(GLASS_LINK_ID); applySliderVisual(glassSwitch); }
  }

  // Switch listeners
  themeSwitch?.addEventListener('change', () => {
    setTheme(themeSwitch.checked ? 'dark' : 'lyntr');
    applySliderVisual(themeSwitch);
    if (!themeSwitch.checked && glassSwitch?.checked) disableGlass();
    setTimeout(sync, 50);
  });

  // Initialize
  const initialTheme = safeStorage.get(THEME_KEY) || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'lyntr');
  setTheme(initialTheme);
  const wantGlass = safeStorage.get(GLASS_KEY) === '1';
  if (wantGlass) enableGlass();

  const obs = new MutationObserver(sync);
  obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  obs.observe(document.head, { childList: true, subtree: true });
  sync();
})();
