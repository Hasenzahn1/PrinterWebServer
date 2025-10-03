// current-job.js — SSE client for current job box (uses window.App)
(function(){
  const { qs } = window.App;

  const $img     = qs('#current-box-image');
  const $pc      = qs('#current-box-pc');
  const $plot    = qs('#current-box-plot');
  const $overlay = qs('#current-box-overlay');
  const $noJob   = qs('#current-box-no-data');
  const $progress= qs('#job-progress');
  const $time    = qs('#job-time-left');

  function showNoJob(){
    [$img,$pc,$plot,$overlay].forEach(el => el && (el.style.display='none'));
    if ($noJob) $noJob.style.display='';
  }
  function showJob({ image_url, pc, plot, overlay, progress, time_left }){
    if (image_url) $img.src = image_url;
    if (pc !== undefined)      $pc.innerHTML      = `<strong>PC:</strong> ${pc}`;
    if (plot !== undefined)    $plot.innerHTML    = `<strong>Plot:</strong> ${plot}`;
    if (overlay !== undefined) $overlay.innerHTML = `<strong>Overlay:</strong> ${overlay}`;
    if (typeof progress === 'number' && $progress) $progress.style.width = Math.max(0,Math.min(100,progress)) + '%';
    if (typeof time_left === 'string' && $time) $time.textContent = `Time left: ${time_left}`;

    [$img,$pc,$plot,$overlay].forEach(el => el && (el.style.display=''));
    if ($noJob) $noJob.style.display='none';
  }

  showNoJob();

  const es = new EventSource('/api/current_job/stream');
  es.onmessage = (e) => {
    let obj = {}; try { obj = JSON.parse(e.data); } catch {}
    const hasData = obj && (obj.active === true || obj.pc !== undefined || obj.plot !== undefined || obj.overlay !== undefined || obj.image_url !== undefined);
    hasData ? showJob(obj) : showNoJob();
  };
  es.onerror = () => { showNoJob(); };
  window.addEventListener('beforeunload', () => es.close());
})();
