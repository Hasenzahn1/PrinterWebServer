(function () {
    const stage = document.getElementById('overlay-stage');
    const layer = document.getElementById('overlay-layer');

    const addTextBtn = document.querySelector('.add-text');
    const addImageBtn = document.querySelector('.add-image');
    const inputText = document.getElementById('text-content');
    const fontFamily = document.getElementById('font-family');
    const fontSize = document.getElementById('font-size');
    const color = document.getElementById('text-color');
    const bg = document.getElementById('bg-color');
    const textAlpha = document.getElementById('text-alpha');
    const bgAlpha = document.getElementById('bg-alpha');
    const align = document.getElementById('text-align');
    const rotation = document.getElementById('rotation');
    const opacity = document.getElementById('opacity');

    const boldBtn = document.getElementById('toggle-bold');
    const italicBtn = document.getElementById('toggle-italic');
    const underlineBtn = document.getElementById('toggle-underline');

    const forwardBtn = document.getElementById('bring-forward');
    const backwardBtn = document.getElementById('send-backward');
    const deleteBtn = document.getElementById('delete-text');

    let selected = null;
    let drag = null;
    let zCounter = 10;
    let resizingNode = null;

    function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
    function getFontPx(node) { return parseFloat(getComputedStyle(node).fontSize) || 24; }
    function setFontPx(node, px) {
        px = clamp(px, 8, 300);
        node.style.fontSize = px + 'px';
        if (selected === node && fontSize) fontSize.value = Math.round(px);
    }

    // --- Node Selection ---
    function select(node) {
        if (selected === node) return;
        if (selected) selected.classList.remove('selected');
        selected = node;
        if (!selected) return;

        selected.classList.add('selected');

        if (selected.dataset.type === 'text') {
            if (inputText) inputText.value = selected.innerText;
            if (fontFamily) fontFamily.value = selected.style.fontFamily || "Inter, system-ui, sans-serif";
            if (fontSize) fontSize.value = parseInt(selected.style.fontSize || 24, 10);
            const cs = getComputedStyle(selected);
            const colHex = toColor(cs.color) || '#ffffff';
            const bgHex = toColor(cs.backgroundColor) || '#00000000';
            const c = splitHexAlpha(colHex);
            const b = splitHexAlpha(bgHex);
            if (color) color.value = c.hex6;
            if (textAlpha) textAlpha.value = c.a.toFixed(2);
            if (bg) bg.value = b.hex6;
            if (bgAlpha) bgAlpha.value = b.a.toFixed(2);
            if (align) align.value = selected.style.textAlign || 'left';
            updateToggleState();
        } else if (selected.dataset.type === 'image') {
            if (inputText) inputText.value = '';
            if (fontFamily) fontFamily.value = '';
            if (fontSize) fontSize.value = '';
            if (color) color.value = '#ffffff';
            if (textAlpha) textAlpha.value = '1';
            if (bg) bg.value = '#000000';
            if (bgAlpha) bgAlpha.value = '0';
            if (align) align.value = '';
            if (boldBtn) boldBtn.ariaPressed = 'false';
            if (italicBtn) italicBtn.ariaPressed = 'false';
            if (underlineBtn) underlineBtn.ariaPressed = 'false';
        }

        if (rotation) rotation.value = parseInt((selected.style.rotate || '0').replace('deg', ''), 10) || 0;
        if (opacity) opacity.value = selected.style.opacity || 1;
    }

    function toColor(computed) {
        if (!computed) return null;
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = computed;
        const v = ctx.fillStyle;
        if (v.startsWith('rgba')) {
            const m = v.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
            if (!m) return null;
            const [ , r,g,b,a ] = m;
            const hex = (n) => Number(n).toString(16).padStart(2,'0');
            const ha = Math.round(parseFloat(a)*255);
            return '#' + hex(r) + hex(g) + hex(b) + hex(ha);
        }
        if (v.startsWith('rgb')) {
            const m = v.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (!m) return null;
            const [ , r,g,b ] = m;
            const hex = (n) => Number(n).toString(16).padStart(2,'0');
            return '#' + hex(r) + hex(g) + hex(b);
        }
        return v;
    }

    function splitHexAlpha(hex) {
        if (!hex) return { hex6: '#000000', a: 1 };
        const h = hex.toLowerCase();
        if (h.length === 9) {
            const aa = parseInt(h.slice(7, 9), 16);
            return { hex6: h.slice(0, 7), a: clamp(aa / 255, 0, 1) };
        }
        if (h.length === 7) return { hex6: h, a: 1 };
        return { hex6: '#000000', a: 1 };
    }

    function hexToRgb(hex6) {
        let h = (hex6 || '#000000').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return { r, g, b };
    }

    function applyCssColor(node, prop, hex6, alpha) {
        const a = clamp(parseFloat(alpha || 1), 0, 1);
        const { r, g, b } = hexToRgb(hex6 || '#000000');
        node.style[prop] = `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    // --- Resize Observer ---
    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const node = entry.target;
            if (node.dataset.resizing !== '1') continue;

            if (node.dataset.type === 'text') {
                const baseW = parseFloat(node.dataset.baseWidth) || 0;
                const baseFont = parseFloat(node.dataset.baseFont) || getFontPx(node);
                if (!baseW) continue;
                const currentW = node.offsetWidth;
                const ratio = currentW / baseW;
                const newFont = baseFont * ratio;
                setFontPx(node, newFont);
            }
        }
    });

    // --- Text Node Creation ---
    function createTextNode(text = 'Double-click to edit') {
        const node = document.createElement('div');
        node.className = 'text-node';
        node.dataset.type = 'text';
        node.textContent = text;
        node.style.position = 'absolute';
        node.style.left = '10%';
        node.style.top = '10%';
        node.style.zIndex = String(++zCounter);
        node.style.fontFamily = "Inter, system-ui, sans-serif";
        node.style.fontSize = "24px";
        layer.appendChild(node);
        attachNodeEvents(node);
        ro.observe(node);
        select(node);
        return node;
    }

    // --- Image Node Creation ---
    function createImageNode(src) {
        const node = document.createElement('div');
        node.className = 'image-node';
        node.dataset.type = 'image';
        node.style.position = 'absolute';
        node.style.left = '10%';
        node.style.top = '10%';
        node.style.zIndex = String(++zCounter);
        node.style.width = '200px';
        node.style.height = '200px';
        node.style.resize = 'both';
        node.style.overflow = 'hidden';
        node.style.cursor = 'move';

        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';

        node.appendChild(img);
        layer.appendChild(node);
        attachNodeEvents(node);
        select(node);
        return node;
    }

    function attachNodeEvents(node) {
        node.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            select(node);

            const rect = node.getBoundingClientRect();
            const corner = 14;
            const nearRight = e.clientX > rect.right - corner;
            const nearBottom = e.clientY > rect.bottom - corner;
            if (nearRight || nearBottom) {
                node.dataset.resizing = '1';
                if (node.dataset.type === 'text') {
                    node.dataset.baseWidth = String(node.offsetWidth);
                    node.dataset.baseFont = String(getFontPx(node));
                }
                resizingNode = node;
                return;
            }

            drag = {
                startX: e.clientX,
                startY: e.clientY,
                left: node.offsetLeft,
                top: node.offsetTop
            };
            try { node.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            e.preventDefault();
        });

        node.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            let newLeft = drag.left + dx;
            let newTop  = drag.top + dy;

            const maxLeft = stage.clientWidth - node.offsetWidth;
            const maxTop  = stage.clientHeight - node.offsetHeight;
            newLeft = clamp(newLeft, 0, Math.max(0, maxLeft));
            newTop  = clamp(newTop,  0, Math.max(0, maxTop));

            node.style.left = newLeft + 'px';
            node.style.top  = newTop + 'px';
        });

        node.addEventListener('pointerup', () => { drag = null; });
        node.addEventListener('lostpointercapture', () => { drag = null; });

        if (node.dataset.type === 'text') {
            node.addEventListener('dblclick', () => {
                node.contentEditable = 'true';
                node.focus();
                document.execCommand && document.execCommand('selectAll', false, null);
                document.getSelection && document.getSelection().collapseToEnd();
            });

            node.addEventListener('blur', () => {
                node.contentEditable = 'false';
                if (inputText) inputText.value = node.innerText;
            });

            ro.observe(node);
        }

        node.addEventListener('click', (e) => { select(node); e.stopPropagation(); });
    }

    window.addEventListener('pointerup', () => {
        if (resizingNode) {
            resizingNode.dataset.resizing = '0';
            delete resizingNode.dataset.baseWidth;
            delete resizingNode.dataset.baseFont;
            resizingNode = null;
        }
    });

    if (layer) layer.addEventListener('click', () => select(null));

    // --- Add Buttons ---
    if (addTextBtn) addTextBtn.addEventListener('click', () => {
        createTextNode();
        if (inputText) { inputText.focus(); inputText.select(); }
    });

    if (addImageBtn) addImageBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async () => {
            if (!input.files || !input.files[0]) return;
            const file = input.files[0];
            const url = URL.createObjectURL(file);
            createImageNode(url);
        });
        input.click();
    });

    // --- Input Handlers ---
    if (inputText) inputText.addEventListener('input', () => { if (selected?.dataset.type==='text') selected.textContent = inputText.value; });
    if (fontFamily) fontFamily.addEventListener('change', () => { if (selected?.dataset.type==='text') selected.style.fontFamily = fontFamily.value; });
    if (fontSize) fontSize.addEventListener('input', () => { if (selected?.dataset.type==='text') setFontPx(selected, parseFloat(fontSize.value || 24)); });

    function updateTextColor() { if (selected?.dataset.type==='text') applyCssColor(selected, 'color', color.value, textAlpha.value); }
    function updateBgColor() { if (selected?.dataset.type==='text') applyCssColor(selected, 'backgroundColor', bg.value, bgAlpha.value); }
    if (color) color.addEventListener('input', updateTextColor);
    if (textAlpha) textAlpha.addEventListener('input', updateTextColor);
    if (bg) bg.addEventListener('input', updateBgColor);
    if (bgAlpha) bgAlpha.addEventListener('input', updateBgColor);

    if (rotation) rotation.addEventListener('input', () => {
        if (!selected) return;
        selected.style.rotate = rotation.value + 'deg';
        selected.style.transform = `rotate(${rotation.value}deg)`;
    });
    if (opacity) opacity.addEventListener('input', () => { if (selected) selected.style.opacity = opacity.value; });

    // --- Toggle State ---
    function updateToggleState() {
        if (!selected || selected.dataset.type !== 'text') {
            if (boldBtn) boldBtn.ariaPressed = 'false';
            if (italicBtn) italicBtn.ariaPressed = 'false';
            if (underlineBtn) underlineBtn.ariaPressed = 'false';
            return;
        }
        if (boldBtn) boldBtn.ariaPressed = String(selected.style.fontWeight === '700' || selected.style.fontWeight === 'bold');
        if (italicBtn) italicBtn.ariaPressed = String(selected.style.fontStyle === 'italic');
        if (underlineBtn) underlineBtn.ariaPressed = String((selected.style.textDecoration || '').includes('underline'));
    }

    if (boldBtn) boldBtn.addEventListener('click', () => { if (!selected?.dataset.type==='text') return; selected.style.fontWeight = (selected.style.fontWeight==='bold'||selected.style.fontWeight==='700')?'400':'700'; updateToggleState(); });
    if (italicBtn) italicBtn.addEventListener('click', () => { if (!selected?.dataset.type==='text') return; selected.style.fontStyle = selected.style.fontStyle==='italic'?'normal':'italic'; updateToggleState(); });
    if (underlineBtn) underlineBtn.addEventListener('click', () => { if (!selected?.dataset.type==='text') return; const has=(selected.style.textDecoration||'').includes('underline'); selected.style.textDecoration = has?'none':'underline'; updateToggleState(); });

    if (forwardBtn) forwardBtn.addEventListener('click', () => { if (!selected) return; selected.style.zIndex = String(++zCounter); });
    if (backwardBtn) backwardBtn.addEventListener('click', () => { if (!selected) return; selected.style.zIndex = String(Math.max(1, Number(selected.style.zIndex||1)-1)); });
    if (deleteBtn) deleteBtn.addEventListener('click', () => { if (!selected) return; const toRemove = selected; select(null); if (toRemove.dataset.type === 'text') ro.unobserve(toRemove); toRemove.remove(); });

    // --- Serialization  ---
    async function toDataURL(src) {
        if (!src) return null;
        if (src.startsWith('data:')) return src;
        try {
            const resp = await fetch(src);
            const blob = await resp.blob();
            return await new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => res(fr.result);
                fr.onerror = rej;
                fr.readAsDataURL(blob);
            });
        } catch (err) {
            console.warn('Failed to convert image to data URL', src, err);
            return src;
        }
    }

    async function serializeNodeAsync(node) {
        const common = {
            type: node.dataset.type || 'text',
            left: Math.round(node.offsetLeft),
            top: Math.round(node.offsetTop),
            width: node.offsetWidth,
            height: node.offsetHeight,
            zIndex: Number(node.style.zIndex || 1),
            rotate: node.style.rotate || (node.style.transform || ''),
            opacity: node.style.opacity != null ? node.style.opacity : 1
        };
        if (node.dataset.type === 'text') {
            return Object.assign({}, common, {
                text: node.innerText,
                fontFamily: node.style.fontFamily || '',
                fontSize: node.style.fontSize || '',
                color: node.style.color || '',
                backgroundColor: node.style.backgroundColor || '',
                textAlign: node.style.textAlign || '',
                fontWeight: node.style.fontWeight || '',
                fontStyle: node.style.fontStyle || '',
                textDecoration: node.style.textDecoration || ''
            });
        } else if (node.dataset.type === 'image') {
            const img = node.querySelector('img');
            const src = img ? img.src : null;
            const dataSrc = await toDataURL(src);
            return Object.assign({}, common, {
                src: dataSrc,
                objectFit: img ? img.style.objectFit : 'contain'
            });
        }
        return common;
    }

    async function serializeOverlay() {
        if (!layer) return { exportedAt: new Date().toISOString(), nodes: [] };
        const imgEl = document.getElementById('overlay-image');
        const nodes = Array.from(layer.querySelectorAll('.text-node, .image-node'));
        const arr = [];
        for (const n of nodes) {
            try {
                arr.push(await serializeNodeAsync(n));
            } catch (err) {
                console.warn('Failed to serialize node', n, err);
            }
        }
        return {
            exportedAt: new Date().toISOString(),
            image: imgEl ? imgEl.src : null,
            nodes: arr
        };
    }

    // --- Import ---
    function clearNodes() {
        if (!layer) return;
        const nodes = Array.from(layer.querySelectorAll('.text-node, .image-node'));
        for (const n of nodes) {
            if (n.dataset.type === 'text') ro.unobserve(n);
            n.remove();
        }
        selected = null;
        drag = null;
    }

    function createNodeFromData(d) {
        if (!layer || !d) return null;
        if (d.type === 'image') {
            const node = document.createElement('div');
            node.className = 'image-node';
            node.dataset.type = 'image';
            node.style.position = 'absolute';
            node.style.left = (typeof d.left === 'number' ? d.left + 'px' : (d.left || '10%'));
            node.style.top  = (typeof d.top === 'number' ? d.top + 'px' : (d.top || '10%'));
            if (d.width) node.style.width = d.width + 'px';
            if (d.height) node.style.height = d.height + 'px';
            if (d.zIndex) node.style.zIndex = String(d.zIndex);
            if (d.rotate) {
                const r = (typeof d.rotate === 'string' && d.rotate.includes('deg')) ? d.rotate : (d.rotate ? d.rotate + 'deg' : '0deg');
                node.style.rotate = r;
                node.style.transform = `rotate(${r.replace('deg','') || 0}deg)`;
            }
            if (d.opacity != null) node.style.opacity = String(d.opacity);
            node.style.resize = 'both';
            node.style.overflow = 'hidden';
            node.style.cursor = 'move';

            const img = document.createElement('img');
            img.src = d.src || '';
            img.alt = '';
            img.draggable = false;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = d.objectFit || 'contain';
            img.style.pointerEvents = 'none';
            node.appendChild(img);

            layer.appendChild(node);
            attachNodeEvents(node);
            return node;
        } else {
            const node = document.createElement('div');
            node.className = 'text-node';
            node.dataset.type = 'text';
            node.textContent = d.text || '';
            node.style.position = 'absolute';
            node.style.left = (typeof d.left === 'number' ? d.left + 'px' : (d.left || '10%'));
            node.style.top  = (typeof d.top === 'number' ? d.top + 'px' : (d.top || '10%'));
            if (d.width) node.style.width = d.width + 'px';
            if (d.height) node.style.height = d.height + 'px';
            if (d.zIndex) node.style.zIndex = String(d.zIndex);
            if (d.fontFamily) node.style.fontFamily = d.fontFamily;
            if (d.fontSize) node.style.fontSize = d.fontSize;
            if (d.color) node.style.color = d.color;
            if (d.backgroundColor) node.style.backgroundColor = d.backgroundColor;
            if (d.textAlign) node.style.textAlign = d.textAlign;
            if (d.rotate) {
                const r = (typeof d.rotate === 'string' && d.rotate.includes('deg')) ? d.rotate : (d.rotate ? d.rotate + 'deg' : '0deg');
                node.style.rotate = r;
                node.style.transform = `rotate(${r.replace('deg','') || 0}deg)`;
            }
            if (d.opacity != null) node.style.opacity = String(d.opacity);
            if (d.fontWeight) node.style.fontWeight = d.fontWeight;
            if (d.fontStyle) node.style.fontStyle = d.fontStyle;
            if (d.textDecoration) node.style.textDecoration = d.textDecoration;

            layer.appendChild(node);
            attachNodeEvents(node);
            ro.observe(node);
            return node;
        }
    }

    async function importOverlayFromObject(obj) {
        if (!obj || !layer) return;
        if (Array.isArray(obj.nodes)) {
            clearNodes();
            for (const n of obj.nodes) createNodeFromData(n);
        }
    }

    // --- Export UI Handler ---
    function attachExportHandler() {
        const exportConfirmBtn = document.querySelector('.export-confirm-btn');
        const exportFilename = document.getElementById('export-filename');
        if (!exportConfirmBtn || !exportFilename) return;
        exportConfirmBtn.addEventListener('click', async () => {
            const filename = (exportFilename.value && exportFilename.value.trim()) || 'overlay.json';
            const payload = await serializeOverlay();
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            const exportWrapper = document.querySelector('.export-wrapper');
            if (exportWrapper) exportWrapper.classList.add('hidden');
        });
    }

    // --- File input import (global) ---
    function attachToGlobalFileInput() {
        const fileInput = document.querySelector('input[type="file"][accept="image/*,application/json"]');
        if (!fileInput) return;
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    await importOverlayFromObject(data);
                } catch (err) {
                    console.warn('Failed to import overlay JSON', err);
                }
            } else if (file.type.startsWith('image/')) {
                const dataUrl = await new Promise((res, rej) => {
                    const fr = new FileReader();
                    fr.onload = () => res(fr.result);
                    fr.onerror = rej;
                    fr.readAsDataURL(file);
                });
                const imgEl = document.getElementById('overlay-image');
                if (imgEl) imgEl.src = dataUrl;
                else createImageNode(dataUrl);
            }
        });
    }

    function attachExportToServerHandler() {
        const exportBtn = document.querySelector('.export-server-btn');
        const exportFilename = document.getElementById('export-filename');
        if (!exportBtn || !exportFilename) return;

        exportBtn.addEventListener('click', async () => {
            let filename = (exportFilename.value && exportFilename.value.trim()) || 'overlay.json';
            if (!filename.toLowerCase().endsWith('.json')) filename += '.json';

            try {
            const payload = await serializeOverlay();
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });

            const form = new FormData();
            form.append('template', blob, filename);

            const resp = await fetch('/upload', {
                method: 'POST',
                body: form,
                credentials: 'same-origin'
            });

            if (resp.status === 201) {
                const exportWrapper = document.querySelector('.export-wrapper');
                if (exportWrapper) exportWrapper.classList.add('hidden');
                alert('Template uploaded successfully: ' + filename);
            } else {
                const body = await resp.json().catch(() => null) || await resp.text().catch(() => null);
                console.warn('Failed to upload template', resp.status, body);
                alert('Failed to upload template: ' + (resp.statusText || resp.status));
            }
            } catch (err) {
            console.warn('Error uploading template', err);
            alert('Error uploading template');
            }
        });
    }
    
    // --- Keyboard Shortcuts ---
    function attachKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.isContentEditable
            );

            const mod = e.ctrlKey || e.metaKey;

            if (isTyping && !['Escape', 'Delete', 'Backspace'].includes(e.key)) return;

            function nudgeSelected(dx, dy) {
                if (!selected) return;
                const left = (parseFloat(selected.style.left) || selected.offsetLeft) + dx;
                const top  = (parseFloat(selected.style.top)  || selected.offsetTop)  + dy;
                const maxLeft = stage.clientWidth - selected.offsetWidth;
                const maxTop  = stage.clientHeight - selected.offsetHeight;
                selected.style.left = clamp(left, 0, Math.max(0, maxLeft)) + 'px';
                selected.style.top  = clamp(top,  0, Math.max(0, maxTop))  + 'px';
                e.preventDefault();
            }

            switch (e.key) {
                case 'Escape':
                    select(null);
                    e.preventDefault();
                    return;
                case 'Delete':
                case 'Backspace':
                    if (selected && !isTyping) {
                        const toRemove = selected;
                        select(null);
                        if (toRemove.dataset.type === 'text') ro.unobserve(toRemove);
                        toRemove.remove();
                        e.preventDefault();
                    }
                    return;
                case 'ArrowLeft':
                    if (mod && selected) { nudgeSelected(- (e.shiftKey ? 10 : 1), 0); return; }
                    if (selected && !mod) { nudgeSelected(- (e.shiftKey ? 10 : 1), 0); return; }
                    break;
                case 'ArrowRight':
                    if (mod && selected) { nudgeSelected((e.shiftKey ? 10 : 1), 0); return; }
                    if (selected && !mod) { nudgeSelected((e.shiftKey ? 10 : 1), 0); return; }
                    break;
                case 'ArrowUp':
                    if (mod && selected) {
                        selected.style.zIndex = String(++zCounter);
                        e.preventDefault();
                        return;
                    }
                    if (selected) { nudgeSelected(0, - (e.shiftKey ? 10 : 1)); return; }
                    break;
                case 'ArrowDown':
                    if (mod && selected) {
                        selected.style.zIndex = String(Math.max(1, Number(selected.style.zIndex || 1) - 1));
                        e.preventDefault();
                        return;
                    }
                    if (selected) { nudgeSelected(0, (e.shiftKey ? 10 : 1)); return; }
                    break;
            }
            
            // Alt-key combos
            if (e.altKey) {
                const k = e.key.toLowerCase();

                // Save / Export Alt+S
                if (k === 's') {
                    e.preventDefault();
                    try {
                        const filenameEl = document.getElementById('export-filename');
                        let filename = (filenameEl && filenameEl.value && filenameEl.value.trim()) || 'overlay.json';
                        if (!filename.toLowerCase().endsWith('.json')) filename += '.json';
                        const payload = await serializeOverlay();
                        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    } catch (err) {
                        console.warn('Export shortcut failed', err);
                    }
                    return;
                }

                // Add text node Alt+T
                if (k === 't') {
                    e.preventDefault();
                    const n = createTextNode();
                    if (n) select(n);
                    return;
                }

                // Duplicate selected Alt+D
                if (k === 'd') {
                    if (!selected) return;
                    e.preventDefault();
                    try {
                        const data = await serializeNodeAsync(selected);
                        // offset duplicated node slightly
                        if (typeof data.left === 'number') data.left = data.left + 10;
                        if (typeof data.top === 'number') data.top = data.top + 10;
                        data.zIndex = ++zCounter;
                        const newNode = createNodeFromData(data);
                        if (newNode) select(newNode);
                    } catch (err) {
                        console.warn('Duplicate shortcut failed', err);
                    }
                    return;
                }

                // Bold Alt+B
                if (k === 'b') {
                    if (selected?.dataset.type === 'text') {
                        e.preventDefault();
                        selected.style.fontWeight = (selected.style.fontWeight === 'bold' || selected.style.fontWeight === '700') ? '400' : '700';
                        updateToggleState();
                    }
                    return;
                }

                // Italic Alt+Shift+I (keep Alt+I reserved for adding images)
                if (k === 'i' && e.shiftKey) {
                    if (selected?.dataset.type === 'text') {
                        e.preventDefault();
                        selected.style.fontStyle = selected.style.fontStyle === 'italic' ? 'normal' : 'italic';
                        updateToggleState();
                    }
                    return;
                }

                // Underline Alt+U
                if (k === 'u') {
                    if (selected?.dataset.type === 'text') {
                        e.preventDefault();
                        const has = (selected.style.textDecoration || '').includes('underline');
                        selected.style.textDecoration = has ? 'none' : 'underline';
                        updateToggleState();
                    }
                    return;
                }

                // Add image Alt+I - open image picker
                if (k === 'i' && !e.shiftKey) {
                    e.preventDefault();
                    if (addImageBtn) {
                        addImageBtn.click();
                    } else {
                        const fileInput = document.querySelector('input[type="file"][accept="image/*,application/json"]');
                        if (fileInput) fileInput.click();
                    }
                    return;
                }
            }
        });
    }

    // --- Init ---
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            attachToGlobalFileInput();
            attachExportHandler();
            attachExportToServerHandler();
            if (layer) layer.addEventListener('click', () => select(null));
            attachKeyboardShortcuts();
        }, 50);
    });

    window.overlayEditor = window.overlayEditor || {};
    window.overlayEditor.serialize = serializeOverlay;
    window.overlayEditor.importObject = importOverlayFromObject;
    window.overlayEditor.clearNodes = clearNodes;
    window.overlayEditor.createNodeFromData = createNodeFromData;
})();

