(function () {
  const cfg = window.__ROOM__ || {};
  const roomId = cfg.roomId;
  const meId = cfg.meId;
  const promptName = !!cfg.promptName;

  const video = document.getElementById("v");
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const errEl = document.getElementById("err");
  const selEl = document.getElementById("sel");
  const cards = Array.from(document.querySelectorAll("[data-member-id]"));
  const modal = document.getElementById("modal");
  const renameBtn = document.getElementById("renameBtn");
  const nameInput = document.getElementById("nameInput");
  const saveName = document.getElementById("saveName");
  const closeModal = document.getElementById("closeModal");
  const nameErr = document.getElementById("nameErr");

  let selectedMemberId = null;
  let pc = null;

  function setErr(e) {
    errEl.textContent = e ? String(e && e.stack ? e.stack : e) : "";
  }

  function openModal() {
    if (!modal) return;
    if (nameErr) nameErr.textContent = "";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 0);
  }

  function closeModalUi() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  async function submitName() {
    const name = String(nameInput ? nameInput.value : "").trim();
    if (!name) {
      if (nameErr) nameErr.textContent = "请输入昵称";
      return;
    }
    if (name.length > 24) {
      if (nameErr) nameErr.textContent = "昵称太长（最多 24 个字符）";
      return;
    }

    const res = await fetch("/api/public/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, name })
    });
    const data = await res.json().catch(() => null);
    if (!data || data.code !== 0) throw new Error("保存失败: " + JSON.stringify(data));

    const myCard = cards.find((c) => c.getAttribute("data-member-id") === meId);
    const myNameEl = myCard ? myCard.querySelector(".p-name") : null;
    if (myNameEl) {
      const meTag = myNameEl.querySelector(".p-me");
      myNameEl.textContent = data.name;
      if (meTag) myNameEl.appendChild(meTag);
      else myNameEl.insertAdjacentHTML("beforeend", '<span class="p-me">（我）</span>');
    }

    closeModalUi();
  }

  function setSelected(id) {
    selectedMemberId = id;
    for (const c of cards) {
      const cid = c.getAttribute("data-member-id");
      c.classList.toggle("p-selected", cid === id);
    }
    const chosen = cards.find((c) => c.getAttribute("data-member-id") === id);
    const nameEl = chosen ? chosen.querySelector(".p-name") : null;
    const name = nameEl ? nameEl.textContent.replace("（我）", "").trim() : "";
    selEl.textContent = id ? `已选择：${name || id}${id === meId ? "（我）" : ""}` : "请先从右侧选择一个成员";
    playBtn.disabled = !id;
    stopBtn.disabled = !pc;
  }

  function waitIce(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      const onState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", onState);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", onState);
      setTimeout(() => resolve(), 1500);
    });
  }

  async function play() {
    setErr("");
    if (!selectedMemberId) return;

    if (pc) {
      pc.close();
      pc = null;
    }

    pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });
    stopBtn.disabled = false;

    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });

    pc.ontrack = (e) => {
      if (!e.streams || !e.streams[0]) return;
      video.srcObject = e.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);

    const res = await fetch("/api/public/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        memberId: selectedMemberId,
        sdp: pc.localDescription.sdp
      })
    });
    const data = await res.json().catch(() => null);
    if (!data || data.code !== 0 || !data.sdp) throw new Error("播放失败: " + JSON.stringify(data));

    await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
    video.muted = false;
  }

  function stop() {
    setErr("");
    if (pc) {
      pc.close();
      pc = null;
    }
    stopBtn.disabled = true;
    if (video) video.srcObject = null;
  }

  for (const c of cards) {
    c.addEventListener("click", () => {
      const id = c.getAttribute("data-member-id");
      setSelected(id);
    });
  }

  playBtn.addEventListener("click", () => play().catch(setErr));
  stopBtn.addEventListener("click", stop);

  setSelected(null);

  if (renameBtn) renameBtn.addEventListener("click", openModal);
  if (closeModal) closeModal.addEventListener("click", closeModalUi);
  if (saveName) saveName.addEventListener("click", () => submitName().catch((e) => (nameErr.textContent = String(e))));
  if (modal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModalUi();
    });
  if (nameInput)
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitName().catch((er) => (nameErr.textContent = String(er)));
      }
      if (e.key === "Escape") closeModalUi();
    });

  if (promptName) openModal();
})();

