(function () {
  const cfg = window.__WATCH__ || {};
  const roomId = cfg.roomId;
  const isHost = !!cfg.isHost;
  const init = cfg.init || { url: "", paused: true, time: 0, updatedAt: 0, seq: 0 };

  const v = document.getElementById("wv");
  const errEl = document.getElementById("werr");
  const urlInput = document.getElementById("wurl");
  const setBtn = document.getElementById("wset");
  const playBtn = document.getElementById("wplay");
  const pauseBtn = document.getElementById("wpause");
  const syncBtn = document.getElementById("wsync");

  let applying = false;
  let lastSeq = 0;
  let lastState = init;
  let lastServerTime = Date.now();
  let hostSyncTimer = null;

  function setErr(e) {
    errEl.textContent = e ? String(e && e.stack ? e.stack : e) : "";
  }

  function clamp(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }

  async function api(type, payload) {
    const res = await fetch("/api/watch/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, type, ...payload })
    });
    const data = await res.json().catch(() => null);
    if (!data || data.code !== 0) throw new Error("操作失败: " + JSON.stringify(data));
    return data.state;
  }

  async function resolveBili(url) {
    const res = await fetch("/api/watch/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, url })
    });
    const data = await res.json().catch(() => null);
    if (!data || data.code !== 0 || !data.url) throw new Error((data && data.message) || "解析失败");
    return data.url;
  }

  function isBili(url) {
    try {
      const u = new URL(url);
      return (
        u.hostname === "www.bilibili.com" ||
        u.hostname === "bilibili.com" ||
        u.hostname === "m.bilibili.com" ||
        u.hostname === "b23.tv"
      );
    } catch {
      return false;
    }
  }

  async function ensureSrc(url) {
    const u = String(url || "").trim();
    if (!u) return;
    if (v.getAttribute("data-url") === u) return;
    v.setAttribute("data-url", u);
    v.src = u;
    try {
      await v.load();
    } catch {}
  }

  function scheduleHostSync() {
    if (!isHost) return;
    if (hostSyncTimer) clearInterval(hostSyncTimer);
    hostSyncTimer = setInterval(() => {
      if (!v || v.paused) return;
      api("sync", { time: clamp(v.currentTime), paused: false }).catch(() => {});
    }, 5000);
  }

  async function applyState({ state, serverTime }) {
    if (!state) return;
    if (state.seq && state.seq <= lastSeq) return;
    lastSeq = state.seq || lastSeq + 1;
    lastState = state;
    lastServerTime = Number(serverTime || Date.now());

    applying = true;
    try {
      if (urlInput && !urlInput.value) urlInput.value = state.url || "";
      await ensureSrc(state.url);

      const driftSec = (Date.now() - lastServerTime) / 1000;
      const base = clamp(state.time);
      const target = state.paused ? base : base + driftSec;

      if (Number.isFinite(v.duration) && v.duration > 0) {
        const diff = Math.abs(v.currentTime - target);
        if (diff > 0.6) v.currentTime = target;
      } else {
        v.currentTime = target;
      }

      if (state.paused) {
        if (!v.paused) await v.pause();
      } else {
        try {
          await v.play();
        } catch {}
      }
    } finally {
      applying = false;
    }
  }

  function connectEvents() {
    const es = new EventSource("/api/watch/events?roomId=" + encodeURIComponent(roomId));
    es.addEventListener("msg", (e) => {
      const data = JSON.parse(e.data);
      applyState(data).catch(setErr);
    });
    es.addEventListener("error", () => {
      setTimeout(connectEvents, 1500);
      es.close();
    });
  }

  if (isHost) {
    setBtn.addEventListener("click", () => {
      setErr("");
      const input = String(urlInput.value || "").trim();
      if (!input) return;
      setBtn.disabled = true;
      setBtn.textContent = "解析中…";
      const p = isBili(input) ? resolveBili(input) : Promise.resolve(input);
      p.then((url) => api("set_url", { url }))
        .catch(setErr)
        .finally(() => {
          setBtn.disabled = false;
          setBtn.textContent = "拉取链接";
        });
    });
    playBtn.addEventListener("click", () => {
      setErr("");
      api("play", { time: clamp(v.currentTime) }).catch(setErr);
    });
    pauseBtn.addEventListener("click", () => {
      setErr("");
      api("pause", { time: clamp(v.currentTime) }).catch(setErr);
    });
    syncBtn.addEventListener("click", () => {
      setErr("");
      api("sync", { time: clamp(v.currentTime), paused: v.paused }).catch(setErr);
    });

    v.addEventListener("seeked", () => {
      if (applying) return;
      api("seek", { time: clamp(v.currentTime), paused: v.paused }).catch(() => {});
    });
    v.addEventListener("pause", () => {
      if (applying) return;
      api("pause", { time: clamp(v.currentTime) }).catch(() => {});
    });
    v.addEventListener("play", () => {
      if (applying) return;
      api("play", { time: clamp(v.currentTime) }).catch(() => {});
    });
    scheduleHostSync();
  } else {
    if (setBtn) setBtn.disabled = true;
    if (playBtn) playBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = true;
    if (syncBtn) syncBtn.disabled = true;
    if (urlInput) urlInput.disabled = true;
    v.addEventListener("play", (e) => {
      if (applying) return;
      e.preventDefault();
      v.pause();
    });
    v.addEventListener("seeking", () => {
      if (applying) return;
      const driftSec = (Date.now() - lastServerTime) / 1000;
      const base = clamp(lastState.time);
      const target = lastState.paused ? base : base + driftSec;
      if (Math.abs(v.currentTime - target) > 0.2) v.currentTime = target;
    });
    v.addEventListener("pause", () => {
      if (applying) return;
      if (!lastState.paused) v.play().catch(() => {});
    });
  }

  applyState({ type: "state", state: init, serverTime: Date.now() }).catch(() => {});
  connectEvents();
})();

