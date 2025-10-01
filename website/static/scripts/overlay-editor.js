(function () {
    const stage = document.getElementById('overlay-stage');
    const layer = document.getElementById('overlay-layer');

    const addBtn = document.querySelector('.add-text');
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
        if (selected === node) fontSize.value = Math.round(px);
    }

    function select(node) {
        if (selected === node) return;
        if (selected) selected.classList.remove('selected');
        selected = node;
        if (selected) {
            selected.classList.add('selected');
            inputText.value = selected.innerText;
            fontFamily.value = selected.style.fontFamily || "Inter, system-ui, sans-serif";
            fontSize.value = parseInt(selected.style.fontSize || 24, 10);

            const cs = getComputedStyle(selected);
            const colHex = toColor(cs.color) || '#ffffff';
            const bgHex = toColor(cs.backgroundColor) || '#00000000';
            const c = splitHexAlpha(colHex);
            const b = splitHexAlpha(bgHex);
            color.value = c.hex6;
            textAlpha.value = c.a.toFixed(2);
            bg.value = b.hex6;
            bgAlpha.value = b.a.toFixed(2);

            align.value = selected.style.textAlign || 'left';
            rotation.value = parseInt((selected.style.rotate || '0').replace('deg', ''), 10) || 0;
            opacity.value = selected.style.opacity || 1;
            updateToggleState();
        } else {
            inputText.value = '';
        }
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
        let h = hex6.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return { r, g, b };
    }

    function applyCssColor(node, prop, hex6, alpha) {
        const a = clamp(parseFloat(alpha || 1), 0, 1);
        const { r, g, b } = hexToRgb(hex6);
        node.style[prop] = `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const node = entry.target;
            if (node.dataset.resizing !== '1') continue;

            const baseW = parseFloat(node.dataset.baseWidth) || 0;
            const baseFont = parseFloat(node.dataset.baseFont) || getFontPx(node);
            if (!baseW) continue;

            const currentW = node.offsetWidth;
            const ratio = currentW / baseW;
            const newFont = baseFont * ratio;
            setFontPx(node, newFont);
        }
    });

    function createTextNode(text = 'Double-click to edit') {
        const node = document.createElement('div');
        node.className = 'text-node';
        node.textContent = text;
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
                node.dataset.baseWidth = String(node.offsetWidth);
                node.dataset.baseFont = String(getFontPx(node));
                resizingNode = node;
                return;
            }

            drag = {
                startX: e.clientX,
                startY: e.clientY,
                left: node.offsetLeft,
                top: node.offsetTop
            };
            node.setPointerCapture(e.pointerId);
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

        node.addEventListener('dblclick', () => {
            node.contentEditable = 'true';
            node.focus();
            document.execCommand && document.execCommand('selectAll', false, null);
            document.getSelection && document.getSelection().collapseToEnd();
        });

        node.addEventListener('blur', () => {
            node.contentEditable = 'false';
            inputText.value = node.innerText;
        });

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

    layer.addEventListener('click', () => select(null));

    addBtn.addEventListener('click', () => {
        const node = createTextNode();
        inputText.focus();
        inputText.select();
    });

    inputText.addEventListener('input', () => { if (selected) selected.textContent = inputText.value; });
    fontFamily.addEventListener('change', () => { if (selected) selected.style.fontFamily = fontFamily.value; });
    fontSize.addEventListener('input', () => {
        if (!selected) return;
        setFontPx(selected, parseFloat(fontSize.value || 24));
    });

    function updateTextColor() {
        if (!selected) return;
        applyCssColor(selected, 'color', color.value, textAlpha.value);
    }
    function updateBgColor() {
        if (!selected) return;
        applyCssColor(selected, 'backgroundColor', bg.value, bgAlpha.value);
    }

    color.addEventListener('input', updateTextColor);
    textAlpha.addEventListener('input', updateTextColor);

    bg.addEventListener('input', updateBgColor);
    bgAlpha.addEventListener('input', updateBgColor);

    align.addEventListener('change', () => { if (selected) selected.style.textAlign = align.value; });
    rotation.addEventListener('input', () => {
        if (!selected) return;
        selected.style.rotate = rotation.value + 'deg';
        selected.style.transform = `rotate(${rotation.value}deg)`;
    });
    opacity.addEventListener('input', () => { if (selected) selected.style.opacity = opacity.value; });

    function updateToggleState() {
        if (!selected) { boldBtn.ariaPressed = italicBtn.ariaPressed = underlineBtn.ariaPressed = 'false'; return; }
        boldBtn.ariaPressed = String(selected.style.fontWeight === '700' || selected.style.fontWeight === 'bold');
        italicBtn.ariaPressed = String(selected.style.fontStyle === 'italic');
        underlineBtn.ariaPressed = String((selected.style.textDecoration || '').includes('underline'));
    }

    boldBtn.addEventListener('click', () => {
        if (!selected) return;
        selected.style.fontWeight = (selected.style.fontWeight === 'bold' || selected.style.fontWeight === '700') ? '400' : '700';
        updateToggleState();
    });
    italicBtn.addEventListener('click', () => {
        if (!selected) return;
        selected.style.fontStyle = selected.style.fontStyle === 'italic' ? 'normal' : 'italic';
        updateToggleState();
    });
    underlineBtn.addEventListener('click', () => {
        if (!selected) return;
        const has = (selected.style.textDecoration || '').includes('underline');
        selected.style.textDecoration = has ? 'none' : 'underline';
        updateToggleState();
    });

    forwardBtn.addEventListener('click', () => {
        if (!selected) return;
        selected.style.zIndex = String(++zCounter);
    });
    backwardBtn.addEventListener('click', () => {
        if (!selected) return;
        selected.style.zIndex = String(Math.max(1, Number(selected.style.zIndex || 1) - 1));
    });
    deleteBtn.addEventListener('click', () => {
        if (!selected) return;
        const toRemove = selected;
        select(null);
        ro.unobserve(toRemove);
        toRemove.remove();
    });

    function syncStageHeight() {
        const img = document.getElementById('overlay-image');
        if (!img.complete) { img.addEventListener('load', syncStageHeight, { once: true }); return; }
    }
    syncStageHeight();

    function serializeNode(node) {
        const rect = node.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const left = Math.round(node.offsetLeft);
        const top = Math.round(node.offsetTop);
        return {
            text: node.innerText,
            left,
            top,
            width: node.offsetWidth,
            height: node.offsetHeight,
            zIndex: Number(node.style.zIndex || 1),
            fontFamily: node.style.fontFamily || '',
            fontSize: node.style.fontSize || '',
            color: node.style.color || '',
            backgroundColor: node.style.backgroundColor || '',
            textAlign: node.style.textAlign || '',
            rotate: node.style.rotate || (node.style.transform || ''),
            opacity: node.style.opacity != null ? node.style.opacity : 1,
            fontWeight: node.style.fontWeight || '',
            fontStyle: node.style.fontStyle || '',
            textDecoration: node.style.textDecoration || ''
        };
    }

    function serializeOverlay() {
        const img = document.getElementById('overlay-image');
        const nodes = Array.from(layer.querySelectorAll('.text-node')).map(serializeNode);
        return {
            exportedAt: new Date().toISOString(),
            image: img ? img.src : null,
            nodes
        };
    }

    function clearNodes() {
        const nodes = Array.from(layer.querySelectorAll('.text-node'));
        for (const n of nodes) {
            ro.unobserve(n);
            n.remove();
        }
        selected = null;
    }

    function createNodeFromData(d) {
        const node = document.createElement('div');
        node.className = 'text-node';
        node.textContent = d.text || '';
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

    function importOverlayFromObject(obj) {
        if (!obj) return;
        const img = document.getElementById('overlay-image');
        if (obj.image) {
            img.src = obj.image;
        }
        if (Array.isArray(obj.nodes)) {
            clearNodes();
            for (const n of obj.nodes) {
                createNodeFromData(n);
            }
        }
    }

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
                    importOverlayFromObject(data);
                } catch (err) {
                    console.warn('Failed to import overlay JSON', err);
                }
            }
        });
    }

    function attachExportHandler() {
        const exportConfirmBtn = document.querySelector('.export-confirm-btn');
        const exportFilename = document.getElementById('export-filename');
        if (!exportConfirmBtn || !exportFilename) return;
        exportConfirmBtn.addEventListener('click', (e) => {
            const filename = (exportFilename.value && exportFilename.value.trim()) || 'overlay.json';
            const payload = serializeOverlay();
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

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            attachToGlobalFileInput();
            attachExportHandler();
        }, 50);
    });

    window.overlayEditor = window.overlayEditor || {};
    window.overlayEditor.serialize = serializeOverlay;
    window.overlayEditor.importObject = importOverlayFromObject;
    window.overlayEditor.clearNodes = clearNodes;
    window.overlayEditor.createNodeFromData = createNodeFromData;
})();