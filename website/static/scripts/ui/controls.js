document.addEventListener('DOMContentLoaded', () => {
  const $autoToggle = document.querySelector('#auto-print-toggle');
  const $pauseBtn   = document.querySelector('#btn-pause');

  fetch('/api/controls/state')
    .then(r => r.json())
    .then(s => {
      if ($autoToggle && typeof s.auto_print_on_receive === 'boolean') {
        $autoToggle.checked = s.auto_print_on_receive;
      }
      if ($pauseBtn && typeof s.paused === 'boolean') {
        $pauseBtn.dataset.paused = String(s.paused);
        $pauseBtn.textContent = s.paused ? 'Resume' : 'Pause';
        // Optional: Styling anpassen
        $pauseBtn.classList.toggle('warning', !s.paused); // Pause = "warning"
        $pauseBtn.classList.toggle('primary', s.paused);  // Resume = "primary"
      }
    })
    .catch(() => { /* Ignorieren oder Toast zeigen */ });

  if ($autoToggle) {
    $autoToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      try {
        const res = await fetch('/api/controls/print_on_receive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'failed');
      } catch (err) {
        e.target.checked = !enabled;
        console.error('Failed to set auto_print_on_receive:', err);
      }
    });
  }

  // Pause / Resume
  if ($pauseBtn) {
    $pauseBtn.addEventListener('click', async () => {
      const currentlyPaused = $pauseBtn.dataset.paused === 'true';
      $pauseBtn.disabled = true;
      try {
        const url = currentlyPaused ? '/api/controls/resume' : '/api/controls/pause';
        const res = await fetch(url, { method: 'POST' });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'failed');

        const paused = Boolean(data.paused);
        $pauseBtn.dataset.paused = String(paused);
        $pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        $pauseBtn.classList.toggle('warning', !paused);
        $pauseBtn.classList.toggle('primary', paused);

        if (typeof setStatusLabel === 'function') {
          setStatusLabel(paused ? 'Paused' : 'Waiting');
        }
      } catch (err) {
        console.error('Failed to toggle pause:', err);
      } finally {
        $pauseBtn.disabled = false;
      }
    });
  }
});
