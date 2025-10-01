document.addEventListener('DOMContentLoaded', function() {
    const overlayBtn = document.getElementById('overlay-editor-btn');
    const container = document.getElementById('overlay-editor-container');
    const closeBtn = document.getElementById('close-overlay-editor');
    const importBtn = document.querySelector('.import-btn');
    const exportBtn = document.querySelector('.export-btn');
    const exportWrapper = document.querySelector('.export-wrapper');
    const exportFilename = document.getElementById('export-filename');
    const exportConfirmBtn = document.querySelector('.export-confirm-btn');
    const overlayImage = document.getElementById('overlay-image');

    overlayBtn.addEventListener('click', () => {
        container.classList.remove('hidden');
        closeBtn.focus();
    });

    closeBtn.addEventListener('click', () => container.classList.add('hidden'));
    container.addEventListener('click', (e) => {
        if (e.target === container) container.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !container.classList.contains('hidden')) container.classList.add('hidden');
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    importBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            overlayImage.src = url;
            exportFilename.value = (file.name.replace(/\.[^/.]+$/, '') || 'overlay') + '.json';
        } else {
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (data && typeof data.image === 'string' && data.image.startsWith('data:')) {
                    overlayImage.src = data.image;
                }
                exportFilename.value = file.name || 'overlay.json';
            } catch (err) {
                alert('Unable to read file. Make sure it is a valid image or JSON overlay.');
            }
        }
        fileInput.value = '';
    });

    exportBtn.addEventListener('click', () => exportWrapper.classList.toggle('hidden'));

    exportConfirmBtn.addEventListener('click', () => {
        const filename = (exportFilename.value && exportFilename.value.trim()) || 'overlay.json';
        const payload = {
            exportedAt: new Date().toISOString(),
            image: overlayImage.src || null
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        exportWrapper.classList.add('hidden');
    });
});