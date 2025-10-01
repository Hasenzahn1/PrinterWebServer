(function(){
    const nameInput = document.getElementById('overlay-name');

    // Wait until overlayEditor API exists, then augment serialize/import to include the name
    function patchWhenReady() {
        if (window.overlayEditor && typeof window.overlayEditor.serialize === 'function') {
            const origSerialize = window.overlayEditor.serialize;
            window.overlayEditor.serialize = function() {
                const payload = origSerialize();
                payload.name = nameInput.value || '';
                return payload;
            };

            if (typeof window.overlayEditor.importObject === 'function') {
                const origImport = window.overlayEditor.importObject;
                window.overlayEditor.importObject = function(obj) {
                    origImport(obj);
                    try {
                        if (obj && typeof obj.name === 'string') nameInput.value = obj.name;
                    } catch(e){}
                };
            }

            return;
        }
        setTimeout(patchWhenReady, 60);
    }
    patchWhenReady();

    function syncExportFilename() {
        const exportInput = document.getElementById('export-filename');
        if (!exportInput) return;
        const name = (nameInput.value || '').trim();
        if (!name) return;
        if (!exportInput._userEdited) {
            exportInput.value = (name.replace(/\.[^/.]+$/, '') || 'overlay') + '.json';
            exportInput._autoValue = exportInput.value;
        }
    }

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'export-filename') {
            e.target._userEdited = true;
        }
    }, true);

    nameInput.addEventListener('input', () => {
        syncExportFilename();
    });

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(syncExportFilename, 100);
    });
})();