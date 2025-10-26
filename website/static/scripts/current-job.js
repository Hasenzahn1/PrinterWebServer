// scripts/current-job.js — SSE client for current job box + progress/eta
(function () {
  const qs = (window.App && window.App.qs) ? window.App.qs : (s) => document.querySelector(s);

  const $img      = qs('#current-box-image');
  const $pc       = qs('#current-box-pc');
  const $plot     = qs('#current-box-plot');
  const $overlay  = qs('#current-box-overlay');
  const $noJob    = qs('#current-box-no-data');
  const $progress = qs('#job-progress');
  const $time     = qs('#job-time-left');

  // ARIA für Progressbar (Zugänglichkeit)
  if ($progress) {
    $progress.setAttribute('role', 'progressbar');
    $progress.setAttribute('aria-valuemin', '0');
    $progress.setAttribute('aria-valuemax', '100');
    $progress.setAttribute('aria-valuenow', '0');
  }

    // === Status handling ===
  const $status = qs('#status-text');

  function statusClassFor(label) {
    // Mappe Server-Status auf CSS-Klassen
    switch ((label || '').toLowerCase()) {
      case 'pending':   return 'pending';
      case 'printing':  return 'printing';
      case 'paused':   return 'paused';
      case 'error':    return 'error';
      default:         return 'offline';
    }
  }

  function setStatusLabel(label) {
    if (!$status) return;
    $status.textContent = label || '—';
    // bekannte Status-Klassen entfernen und neue setzen
    $status.classList.remove('pending','printing','paused','error','offline');
    $status.classList.add(statusClassFor(label));
    // optional: Zugänglichkeit
    $status.setAttribute('aria-live', 'polite');
  }

  function setProgressPercent(pct) {

    if (!$progress) return;
    const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    $progress.style.width = p + '%';
    $progress.setAttribute('aria-valuenow', String(p));
  }

  function setEtaText(eta) {
    if ($time) $time.textContent = `Time left: ${eta ?? '—'}`;
  }

  function showNoJob() {
    [$img, $pc, $plot, $overlay].forEach(el => el && (el.style.display = 'none'));
    if ($progress) setProgressPercent(0);
    setEtaText('—');
    if ($noJob) $noJob.style.display = '';
  }

  function showJob(job) {
    if (!job) return showNoJob();

    const { image_url, pc, plot, overlay, progress, time_left } = job;

    if (image_url)                $img.src = image_url;
    if (pc       !== undefined)   $pc.innerHTML      = `<strong>PC:</strong> ${pc}`;
    if (plot     !== undefined)   $plot.innerHTML    = `<strong>Plot:</strong> ${plot}`;
    if (overlay  !== undefined)   $overlay.innerHTML = `<strong>Overlay:</strong> ${overlay}`;

    // Falls der Current-Job-Stream anfangs schon grobe Werte liefert, einmalig setzen:
    if (typeof progress === 'number') setProgressPercent(Math.max(0, Math.min(100, progress)));
    if (typeof time_left === 'string') setEtaText(time_left);

    [$img, $pc, $plot, $overlay].forEach(el => el && (el.style.display = ''));
    if ($noJob) $noJob.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    showNoJob();

    // ===== Current Job =====
    const jobES = new EventSource('/api/current_job/stream');

    jobES.onmessage = (e) => {
      let raw = null;
      try { raw = JSON.parse(e.data); } catch {}
      if (raw == null || raw.active === false) {
        showNoJob();
      } else {
        showJob(raw);
      }
    };

    jobES.onerror = () => { /* EventSource reconnectet automatisch; UI beibehalten */ };

    // ===== Progress (value 0..1 + eta) =====
    const progES = new EventSource('/api/current_job/progress');

    progES.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        // Inaktiv? —> zurücksetzen
        if (data && data.active === false) {
          setProgressPercent(0);
          setEtaText('—');
          return;
        }

        // value im Bereich 0..1
        const v = (typeof data?.value === 'number') ? data.value : null;
        if (v != null) setProgressPercent(v * 100);

        // eta (z. B. "32s", "01:12")
        if (typeof data?.eta === 'string') setEtaText(data.eta);
      } catch {
        // ignorieren bei fehlerhaften Nachrichten
      }
    };

    progES.onerror = () => { /* ebenfalls: auto-reconnect, UI unverändert lassen */ };

        // ===== Status (Waiting | Printing | …) =====
    setStatusLabel('offline'); // Initialer UI-Zustand beim Laden

    const statusES = new EventSource('/api/current_job/status');

    statusES.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && typeof data.status === 'string') {
          setStatusLabel(data.status);
        }
      } catch {
        // Ignoriere fehlerhafte Events
      }
    };

    statusES.onerror = () => { /* auto-reconnect durch EventSource; UI beibehalten */ };

    window.addEventListener('beforeunload', () => {
      try { jobES.close(); } catch {}
      try { progES.close(); } catch {}
      try { statusES.close(); } catch {}
    });
  });
})();
