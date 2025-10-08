// current-job.js — SSE client for current job box (persist across reloads)
(function(){
  const qs = (window.App && window.App.qs) ? window.App.qs : (s)=>document.querySelector(s);

  const $img      = qs('#current-box-image');
  const $pc       = qs('#current-box-pc');
  const $plot     = qs('#current-box-plot');
  const $overlay  = qs('#current-box-overlay');
  const $noJob    = qs('#current-box-no-data');
  const $progress = qs('#job-progress');
  const $time     = qs('#job-time-left');

  function showNoJob(){
    [$img,$pc,$plot,$overlay].forEach(el => el && (el.style.display='none'));
    console.log("nojob");
    if ($progress) $progress.style.width = '0%';
    if ($time)     $time.textContent = 'Time left: —';
    if ($noJob)    $noJob.style.display='';
  }
  function showJob(job){
    if (!job) return showNoJob();
    console.log("showJob")
    const { image_url, pc, plot, overlay, progress, time_left } = job;
    if (image_url)                $img.src = image_url;
    if (pc       !== undefined)   $pc.innerHTML      = `<strong>PC:</strong> ${pc}`;
    if (plot     !== undefined)   $plot.innerHTML    = `<strong>Plot:</strong> ${plot}`;
    if (overlay  !== undefined)   $overlay.innerHTML = `<strong>Overlay:</strong> ${overlay}`;
    if (typeof progress === 'number' && $progress)
      $progress.style.width = Math.max(0, Math.min(100, progress)) + '%';
    if (typeof time_left === 'string' && $time)
      $time.textContent = `Time left: ${time_left}`;

    [$img,$pc,$plot,$overlay].forEach(el => el && (el.style.display=''));
    if ($noJob) $noJob.style.display='none';
  }
  // Live-Updates via SSE
  document.addEventListener("DOMContentLoaded", () => {
    const es = new EventSource('/api/current_job/stream');
    showNoJob();

    es.onmessage = (e) => {
      let raw = null;
      try { raw = JSON.parse(e.data); } catch {}
      console.log(raw)
      if (raw == null || raw.active === false){
        showNoJob();
      }else{
        showJob(raw);
      }
    };

    // Bei transienten Fehlern UI nicht leeren; EventSource reconnectet von selbst
    es.onerror = () => { /* keep showing cached */ };

    window.addEventListener('beforeunload', () => es.close());
  })
})();
