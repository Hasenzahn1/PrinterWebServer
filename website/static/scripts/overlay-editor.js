(function () {
    console.log("Overlay.js geladen");
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
        if (selected === node) fontSize.value = Math.round(px);
    }

    // --- Node Selection ---
    function select(node) {
        if (selected === node) return;
        if (selected) selected.classList.remove('selected');
        selected = node;
        if (!selected) return;

        selected.classList.add('selected');

        if (selected.dataset.type === 'text') {
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
            updateToggleState();
        } else if (selected.dataset.type === 'image') {
            inputText.value = '';
            fontFamily.value = '';
            fontSize.value = '';
            color.value = '#ffffff';
            textAlpha.value = 1;
            bg.value = '#000000';
            bgAlpha.value = 0;
            align.value = '';
            boldBtn.ariaPressed = italicBtn.ariaPressed = underlineBtn.ariaPressed = 'false';
        }

        rotation.value = parseInt((selected.style.rotate || '0').replace('deg', ''), 10) || 0;
        opacity.value = selected.style.opacity || 1;
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

        if (node.dataset.type === 'text') {
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

    layer.addEventListener('click', () => select(null));

    // --- Add Buttons ---
    addTextBtn.addEventListener('click', () => {
        console.log("text added");
        const node = createTextNode();
        inputText.focus();
        inputText.select();
    });

    addImageBtn.addEventListener('click', () => {
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
    inputText.addEventListener('input', () => { if (selected?.dataset.type==='text') selected.textContent = inputText.value; });
    fontFamily.addEventListener('change', () => { if (selected?.dataset.type==='text') selected.style.fontFamily = fontFamily.value; });
    fontSize.addEventListener('input', () => { if (selected?.dataset.type==='text') setFontPx(selected, parseFloat(fontSize.value || 24)); });

    function updateTextColor() { if (selected?.dataset.type==='text') applyCssColor(selected, 'color', color.value, textAlpha.value); }
    function updateBgColor() { if (selected?.dataset.type==='text') applyCssColor(selected, 'backgroundColor', bg.value, bgAlpha.value); }
    color.addEventListener('input', updateTextColor);
    textAlpha.addEventListener('input', updateTextColor);
    bg.addEventListener('input', updateBgColor);
    bgAlpha.addEventListener('input', updateBgColor);

    rotation.addEventListener('input', () => {
        if (!selected) return;
        selected.style.rotate = rotation.value + 'deg';
        selected.style.transform = `rotate(${rotation.value}deg)`;
    });
    opacity.addEventListener('input', () => { if (selected) selected.style.opacity = opacity.value; });

    // --- Toggle State ---
    function updateToggleState() {
        if (!selected || selected.dataset.type !== 'text') {
            boldBtn.ariaPressed = italicBtn.ariaPressed = underlineBtn.ariaPressed = 'false';
            return;
        }
        boldBtn.ariaPressed = String(selected.style.fontWeight === '700' || selected.style.fontWeight === 'bold');
        italicBtn.ariaPressed = String(selected.style.fontStyle === 'italic');
        underlineBtn.ariaPressed = String((selected.style.textDecoration || '').includes('underline'));
    }

    boldBtn.addEventListener('click', () => { if (!selected?.dataset.type==='text') return; selected.style.fontWeight = (selected.style.fontWeight==='bold'||selected.style.fontWeight==='700')?'400':'700'; updateToggleState(); });
    italicBtn.addEventListener('click', () => { if (!selected?.dataset.type==='text') return; selected.style.fontStyle = selected.style.fontStyle==='italic'?'normal':'italic'; updateToggleState(); });
    underlineBtn.addEventListener('click', () => { if (!selected?.dataset.type==='text') return; const has=(selected.style.textDecoration||'').includes('underline'); selected.style.textDecoration = has?'none':'underline'; updateToggleState(); });

    forwardBtn.addEventListener('click', () => { if (!selected) return; selected.style.zIndex = String(++zCounter); });
    backwardBtn.addEventListener('click', () => { if (!selected) return; selected.style.zIndex = String(Math.max(1, Number(selected.style.zIndex||1)-1)); });
    deleteBtn.addEventListener('click', () => { if (!selected) return; selected.remove(); selected = null; });
})();
