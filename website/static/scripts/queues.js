(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const Fallbacks = {
    img: "/static/images/preview.jpg",
    pc: "Unknown",
    plot: "-",
    overlay: "-",
  };

  const clear = (node) => (node ? (node.textContent = "") : null);

  const emptyState = (root, text) => {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = text;
    root.appendChild(div);
  };

  const itemHTML = (job, { type }) => {
    console.log(job);
    console.log(type);
    console.log("PCName: " + job.pc_name)
    const pc = job?.pc_name ?? Fallbacks.pc;
    const plot = job?.plot ?? Fallbacks.plot;
    const overlay = job?.overlay ?? Fallbacks.overlay;
    const imgUrl = job?.image_url ?? Fallbacks.img;

    if (type === "unlisted") {
      return `
        <div class="unlisted-item">
          <img src="${imgUrl}" class="unlisted-image" alt="IMG" loading="lazy" decoding="async">
          <div class="unlisted-info">
            <p><strong>PC:</strong> ${pc}</p>
            <p><strong>Plot:</strong> ${plot}</p>
            <p><strong>Overlay:</strong> ${overlay}</p>
          </div>
          <button class="btn primary" type="button">Print</button>
        </div>`;
    }

    // queue
    return `
      <div class="queue-item">
        <img src="${imgUrl}" class="unlisted-image" alt="IMG" loading="lazy" decoding="async">
        <div class="queue-info">
          <p><strong>PC:</strong> ${pc}</p>
          <p><strong>Plot:</strong> ${plot}</p>
          <p><strong>Overlay:</strong> ${overlay}</p>
        </div>
      </div>`;
  };

  function renderList(list, { rootId, type, emptyText }) {
    console.log("Render List: " + list + ", " + rootId + ", " + type + ", " + emptyText)
    const root = $(rootId);
    if (!root) return;
    clear(root);
    console.log(list)
    if (!Array.isArray(list) || list.length === 0) {
      emptyState(root, emptyText);
      return;
    }

    const frag = document.createDocumentFragment();
    const wrapper = document.createElement("div"); // für einmaliges innerHTML
    wrapper.innerHTML = list.map((j) => itemHTML(j, { type })).join("");
    while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
    root.appendChild(frag);
  }

  function connectSSE(url, onData) {
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        onData(JSON.parse(e.data) ?? []);
      } catch (err) {
        console.error("Bad SSE JSON from", url, err);
      }
    };
    es.onerror = () => es.close(); // simpel halten; Seite lädt neu / Nutzer interagiert
    return () => es.close();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const stopUnlisted = connectSSE("/api/queues/unlisted", (list) =>
      renderList(list, { rootId: "#unlisted-list", type: "unlisted", emptyText: "No unlisted jobs" })
    );

    const stopQueue = connectSSE("/api/queues/queue", (list) =>
      renderList(list, { rootId: "#queue-list", type: "queue", emptyText: "Queue is empty" })
    );

    window.addEventListener("beforeunload", () => {
      stopUnlisted();
      stopQueue();
    });
  });
})();
