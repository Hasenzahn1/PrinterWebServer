/**
 * streams.js — SSE lists for unlisted + queue
 */
(() => {
    "use strict";
    const $ = (sel) => document.querySelector(sel);

    const Fallbacks = { img: "/static/images/preview.jpg", pc: "Unknown", plot: "-", overlay: "-" };
    const clear = (node) => node && (node.textContent = "");
    const emptyState = (root, text) => { const d = document.createElement("div"); d.className = "empty"; d.textContent = text; root.appendChild(d); };

    const itemHTML = (job, type) => {
        const pc = job?.pc_name ?? Fallbacks.pc;
        const plot = job?.plot ?? Fallbacks.plot;
        const overlay = job?.overlay ?? Fallbacks.overlay;
        const imgUrl = job?.image_url ?? Fallbacks.img;
        const info = [
            `<p><strong>PC:</strong> ${pc}</p>`,
            `<p><strong>Plot:</strong> ${plot}</p>`,
            `<p><strong>Overlay:</strong> ${overlay}</p>`
        ].join("");
        if (type === "unlisted") {
            return `<div class="unlisted-item">
                <img src="${imgUrl}" class="unlisted-image" alt="IMG" loading="lazy" decoding="async">
                <div class="unlisted-info">${info}</div>
                <button class="btn primary" type="button">Print</button>
            </div>`;
        }
        return `<div class="queue-item">
            <img src="${imgUrl}" class="unlisted-image" alt="IMG" loading="lazy" decoding="async">
            <div class="queue-info">${info}</div>
        </div>`;
    };

    const renderList = (list, rootId, type, emptyText) => {
        const root = $(rootId);
        if (!root) return;
        clear(root);
        if (!Array.isArray(list) || list.length === 0) return emptyState(root, emptyText);
        const wrapper = document.createElement("div");
        wrapper.innerHTML = list.map((j) => itemHTML(j, type)).join("");
        root.appendChild(wrapper);
    };

    const connectSSE = (url, onData) => {
        const es = new EventSource(url);
        es.onmessage = (e) => { try { onData(JSON.parse(e.data)); } catch {} };
        es.onerror = () => es.close();
        return () => es.close();
    };

    document.addEventListener("DOMContentLoaded", () => {
        const stopUnlisted = connectSSE("/api/queues/unlisted", (list) => renderList(list, "#unlisted-list", "unlisted", "No unlisted jobs"));
        const stopQueue = connectSSE("/api/queues/queue", (list) => renderList(list, "#queue-list", "queue", "Queue is empty"));
        window.addEventListener("beforeunload", () => { stopUnlisted(); stopQueue(); });
    });
})();
