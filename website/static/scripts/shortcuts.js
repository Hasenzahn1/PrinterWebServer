(function(){
        const openBtn = document.getElementById('open-shortcuts');
        const dialog  = document.getElementById('shortcuts-dialog');
        const xBtn    = document.getElementById('shortcuts-x');
        if(!openBtn || !dialog) return;

        function open(){
            dialog.classList.remove('hidden');
            openBtn.setAttribute('aria-expanded','true');
            const focusable = dialog.querySelectorAll('button,[href],summary');
            (focusable[0]||dialog).focus({preventScroll:true});
            document.addEventListener('keydown', escClose, { once:true });
        }
        function close(){
            dialog.classList.add('hidden');
            openBtn.setAttribute('aria-expanded','false');
            openBtn.focus({preventScroll:true});
        }
        function escClose(e){
            if(e.key === 'Escape'){ close(); }
            else document.addEventListener('keydown', escClose, { once:true });
        }
        openBtn.addEventListener('click', open);
        (xBtn||dialog).addEventListener('click', close);
        dialog.addEventListener('click', e => { if(e.target === dialog) close(); });
})();