// templates.js — overlay templates side panel (uses window.App)
(function(){
  const { qs, qsa, safeStorage } = window.App;

  const KEY = 'overlayTemplatesCollapsed';
  const panel  = qs('#overlay-search-panel') || qs('.overlay-search');
  const toggle = panel ? qs('.collapse-toggle', panel) : null;

  function applyState(collapsed){
    panel.classList.toggle('collapsed', collapsed);
    if (toggle){
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.title = collapsed ? 'Expand templates panel' : 'Collapse templates panel';
    }
  }

  if (panel && toggle){
    panel.classList.add('open');
    const collapsed = safeStorage.get(KEY) === '1';
    applyState(collapsed);
    toggle.addEventListener('click', () => {
      const next = !panel.classList.contains('collapsed');
      applyState(next); safeStorage.set(KEY, next ? '1' : '0');
    });
  }

  const list = panel ? qs('.overlay-templates-list', panel) : null;
  if (!list) return;

  function createNode(d){
    const node = document.createElement('div');
    node.className = 'text-node';
    node.textContent = d.text || '';
    node.style.position = 'absolute';
    if (typeof d.left === 'number') node.style.left = d.left + 'px'; else if (d.left) node.style.left = d.left;
    if (typeof d.top  === 'number') node.style.top  = d.top  + 'px'; else if (d.top)  node.style.top  = d.top;
    if (d.width)  node.style.width  = (typeof d.width  === 'number' ? d.width  + 'px' : d.width);
    if (d.height) node.style.height = (typeof d.height === 'number' ? d.height + 'px' : d.height);
    if (d.zIndex) node.style.zIndex = String(d.zIndex);
    if (d.fontFamily) node.style.fontFamily = d.fontFamily;
    if (d.fontSize)   node.style.fontSize   = (typeof d.fontSize === 'number' ? d.fontSize + 'px' : d.fontSize);
    if (d.color)      node.style.color      = d.color;
    if (d.backgroundColor) node.style.backgroundColor = d.backgroundColor;
    if (d.textAlign)  node.style.textAlign  = d.textAlign;
    if (d.rotate != null){
      const r = (typeof d.rotate === 'string' && d.rotate.includes('deg')) ? d.rotate : d.rotate + 'deg';
      node.style.rotate = r; node.style.transform = 'rotate(' + String(r).replace('deg','') + 'deg)';
    }
    if (d.opacity != null) node.style.opacity = String(d.opacity);
    if (d.fontWeight) node.style.fontWeight = d.fontWeight;
    if (d.fontStyle)  node.style.fontStyle  = d.fontStyle;
    if (d.textDecoration) node.style.textDecoration = d.textDecoration;
    node.style.pointerEvents = 'none';
    return node;
  }

  qsa('.template-item').forEach((li) => {
    const jsonUrl = li.dataset.json; if (!jsonUrl) return;
    const layer = qs('.overlay-layer', li);
    fetch(jsonUrl, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(obj => { if (obj?.nodes) obj.nodes.forEach(n => layer.appendChild(createNode(n))); })
      .catch(() => {});
  });

  list.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button'); if (!btn) return;
    const li = ev.target.closest('.template-item'); if (!li) return;
    const file = btn.dataset.file;
    const jsonUrl = li.dataset.json;

    if (btn.classList.contains('import-template')){
      try {
        const res = await fetch(jsonUrl, { cache: 'no-store' });
        if (!res.ok) return alert('Failed to load template.');
        const obj = await res.json();
        if (window.overlayEditor?.importObject) window.overlayEditor.importObject(obj);
        else alert('Overlay editor not ready.');
      } catch { alert('Failed to import template.'); }
      return;
    }

    if (btn.classList.contains('delete-template')){
      if (!file) return;
      if (!confirm(`Delete template "${file}"? This cannot be undone.`)) return;
      btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Deleting...';
      try {
        const res = await fetch('/api/template/delete/' + encodeURIComponent(file), { method:'DELETE' });
        if (res.status === 204) li.remove();
        else if (res.status === 404) { alert('Template not found: ' + file); btn.disabled=false; btn.textContent = prev; }
        else { const msg = await res.text().catch(()=>res.statusText||'Error'); alert('Failed to delete template: ' + (msg||res.status)); btn.disabled=false; btn.textContent=prev; }
      } catch { alert('Error deleting template.'); btn.disabled=false; btn.textContent=prev; }
    }
  });
})();
