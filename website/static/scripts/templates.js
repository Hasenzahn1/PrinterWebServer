// templates.js — overlay templates & assets side panel (uses window.App)
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

  // Assets panel toggle
  const ASSETS_KEY = 'assetsPanelCollapsed';
  const assetsPanel = qs('#assets-panel') || qs('.assets-panel');
  const assetsToggle = assetsPanel ? qs('.assets-collapse-toggle', assetsPanel) : null;

  function applyAssetsState(collapsed){
    assetsPanel.classList.toggle('collapsed', collapsed);
    if (assetsToggle){
      assetsToggle.setAttribute('aria-expanded', String(!collapsed));
      assetsToggle.title = collapsed ? 'Expand assets panel' : 'Collapse assets panel';
    }
  }

  if (assetsPanel && assetsToggle){
    assetsPanel.classList.add('open');
    const collapsed = safeStorage.get(ASSETS_KEY) === '1';
    applyAssetsState(collapsed);
    assetsToggle.addEventListener('click', () => {
      const next = !assetsPanel.classList.contains('collapsed');
      applyAssetsState(next); safeStorage.set(ASSETS_KEY, next ? '1' : '0');
    });
  }

  const list = panel ? qs('.overlay-templates-list', panel) : null;
  if (list){
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
  }

  const assetsList = qs('.overlay-assets-list');
  if (!assetsList) return;

  const IMPORT_MAX_DIM = 300;

  async function fetchBlobAsDataUrl(blob){
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error('Failed to read blob as data URL'));
      fr.readAsDataURL(blob);
    });
  }

  function getEditorCanvasSize(ed){
    try {
      if (!ed) return null;
      if (typeof ed.getCanvasSize === 'function') return ed.getCanvasSize();
      if (typeof ed.getSize === 'function') return ed.getSize();
      if (typeof ed.getViewportSize === 'function') return ed.getViewportSize();
      if (ed.canvas) {
        const c = ed.canvas;
        if (c.width && c.height) return { width: c.width, height: c.height };
        if (c.clientWidth && c.clientHeight) return { width: c.clientWidth, height: c.clientHeight };
      }
      if (ed.width && ed.height) return { width: ed.width, height: ed.height };
      if (ed.viewportWidth && ed.viewportHeight) return { width: ed.viewportWidth, height: ed.viewportHeight };
    } catch (e) {}
    return null;
  }

  assetsList.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button'); if (!btn) return;
  const li = ev.target.closest('.asset-item'); if (!li) return;
  const file = btn.dataset.file;
  const img = qs('img.asset-image', li);
  const url = img?.src || (file ? (location.origin + '/static/overlay-assets/' + encodeURIComponent(file)) : null);

  async function importSingleAsset(item){
    const imgEl = qs('img.asset-image', item);
    const f = qs('button.import-asset', item)?.dataset.file;
    const u = imgEl?.src || (f ? (location.origin + '/static/overlay-assets/' + encodeURIComponent(f)) : null);
    if (!u) { console.warn('No URL for asset', f); return; }
    try {
      const editor = window.overlayEditor;
      let target = getEditorCanvasSize(editor);
      if (!target) target = { width: IMPORT_MAX_DIM, height: IMPORT_MAX_DIM };

      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) { alert('Failed to load asset: ' + (f||u)); return; }
      const blob = await res.blob();
      const dataUrl = await fetchBlobAsDataUrl(blob);

      if (editor?.importImageFromUrl) {
        try {
          await editor.importImageFromUrl(u, { filename: f, width: target.width, height: target.height });
          return;
        } catch (_) {}
      }
      if (editor?.importImage) {
        try {
          await editor.addNode(dataUrl, { filename: f, width: target.width, height: target.height });
          return;
        } catch (_) {}
      }
      if (editor?.importObject) {
        const node = { type: 'image', src: dataUrl, filename: f, width: target.width, height: target.height, left: 0, top: 0 };
          await editor.importObject({ nodes: [node] });
          return;
      }
      alert('Overlay editor does not support importing assets programmatically.');
    } catch (err) {
      console.error(err);
      alert('Failed to import asset: ' + (f||''));
    }
  }

  if (btn.classList.contains('import-asset')){
    const multi = ev.ctrlKey || ev.metaKey || ev.shiftKey;
    if (!url) return alert('Asset URL not found.');
    if (!multi){
      await importSingleAsset(li);
    } else {
      const items = [...assetsList.querySelectorAll('.asset-item')];
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'Importing...';
      for (const item of items){
        await importSingleAsset(item);
      }
      btn.textContent = original;
      btn.disabled = false;
    }
    return;
  }

  if (btn.classList.contains('delete-asset')){
    if (!file) return;
    if (!confirm(`Delete asset "${file}"? This cannot be undone.`)) return;
    btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Deleting...';
    try {
      const res = await fetch('/api/asset/delete/' + encodeURIComponent(file), { method:'DELETE' });
      if (res.status === 204) li.remove();
      else if (res.status === 404) { alert('Asset not found: ' + file); btn.disabled=false; btn.textContent = prev; }
      else { const msg = await res.text().catch(()=>res.statusText||'Error'); alert('Failed to delete asset: ' + (msg||res.status)); btn.disabled=false; btn.textContent=prev; }
    } catch { alert('Error deleting asset.'); btn.disabled=false; btn.textContent=prev; }
  }
  });
})();
