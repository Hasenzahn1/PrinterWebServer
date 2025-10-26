/**
 * current-job.js — SSE client for current job + progress/eta
 */
(() => {
    "use strict";
    const { qs, clamp } = window.App || { qs: (s) => document.querySelector(s), clamp: (n,min,max)=>Math.min(Math.max(+n||0,min),max) };

    const $img = qs("#current-box-image");
    const $pc = qs("#current-box-pc");
    const $plot = qs("#current-box-plot");
    const $overlay = qs("#current-box-overlay");
    const $noJob = qs("#current-box-no-data");
    const $progress = qs("#job-progress");
    const $time = qs("#job-time-left");
    const $status = qs("#status-text");

    // ARIA
    if ($progress) {
        $progress.setAttribute("role", "progressbar");
        $progress.setAttribute("aria-valuemin", "0");
        $progress.setAttribute("aria-valuemax", "100");
        $progress.setAttribute("aria-valuenow", "0");
    }

    const STATUS_CLASS = { pending: "pending", printing: "printing", paused: "paused", error: "error" };
    const setStatusLabel = (label = "—") => {
        if (!$status) return;
        const key = String(label).toLowerCase();
        $status.textContent = label;
        $status.className = "status " + (STATUS_CLASS[key] || "offline");
        $status.setAttribute("aria-live", "polite");
    };

    const setProgress = (pct = 0) => {
        if (!$progress) return;
        const p = clamp(pct, 0, 100);
        $progress.style.width = p + "%";
        $progress.setAttribute("aria-valuenow", String(p));
    };

    const setEta = (eta = "—") => { if ($time) $time.textContent = `Time left: ${eta}`; };

    const hideJob = () => {
        [$img, $pc, $plot, $overlay].forEach((el) => el && (el.style.display = "none"));
        setProgress(0);
        setEta("—");
        if ($noJob) $noJob.style.display = "";
    };

    const showJob = (job) => {
        if (!job) return hideJob();
        const { image_url, pc, plot, overlay, progress, time_left } = job;
        if ($img && image_url) $img.src = image_url;
        if ($pc && pc !== undefined) $pc.innerHTML = `<strong>PC:</strong> ${pc}`;
        if ($plot && plot !== undefined) $plot.innerHTML = `<strong>Plot:</strong> ${plot}`;
        if ($overlay && overlay !== undefined) $overlay.innerHTML = `<strong>Overlay:</strong> ${overlay}`;
        if (typeof progress === "number") setProgress(clamp(progress, 0, 100));
        if (typeof time_left === "string") setEta(time_left);
        [$img, $pc, $plot, $overlay].forEach((el) => el && (el.style.display = ""));
        if ($noJob) $noJob.style.display = "none";
    };

    document.addEventListener("DOMContentLoaded", () => {
        hideJob();
        const safeJSON = (t) => { try { return JSON.parse(t); } catch { return null; } };

        const jobES = new EventSource("/api/current_job/stream");
        jobES.onmessage = (e) => {
            const raw = safeJSON(e.data);
            (!raw || raw.active === false) ? hideJob() : showJob(raw);
        };

        const progES = new EventSource("/api/current_job/progress");
        progES.onmessage = (e) => {
            const d = safeJSON(e.data) || {};
            if (d.active === false) { setProgress(0); setEta("—"); return; }
            if (typeof d.value === "number") setProgress(d.value * 100);
            if (typeof d.eta === "string") setEta(d.eta);
        };

        setStatusLabel("offline");
        const statusES = new EventSource("/api/current_job/status");
        statusES.onmessage = (e) => {
            const d = safeJSON(e.data);
            if (d?.status) setStatusLabel(d.status);
        };

        window.addEventListener("beforeunload", () => {
            jobES.close();
            progES.close();
            statusES.close();
        });
    });
})();
