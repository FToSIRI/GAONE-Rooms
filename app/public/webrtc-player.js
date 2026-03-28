(function () {
  const streamKey = window.__STREAM_KEY__;
  const video = document.getElementById("v");
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const errEl = document.getElementById("err");

  let pc = null;

  function setErr(e) {
    errEl.textContent = e ? String(e && e.stack ? e.stack : e) : "";
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

    if (pc) {
      pc.close();
      pc = null;
    }

    pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });

    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });

    pc.ontrack = (e) => {
      if (!e.streams || !e.streams[0]) return;
      video.srcObject = e.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);

    const apiPath = "/rtc/v1/play/";
    const apiUrl = location.origin + apiPath;
    const streamUrl = "webrtc://" + location.host + "/live/" + encodeURIComponent(streamKey);

    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api: apiUrl,
        streamurl: streamUrl,
        sdp: pc.localDescription.sdp
      })
    });

    const data = await res.json();
    if (!data || data.code !== 0 || !data.sdp) throw new Error("SRS 播放失败: " + JSON.stringify(data));

    await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
    video.muted = false;
  }

  function stop() {
    setErr("");
    if (pc) {
      pc.close();
      pc = null;
    }
    if (video) video.srcObject = null;
  }

  playBtn.addEventListener("click", () => play().catch(setErr));
  stopBtn.addEventListener("click", stop);
})();
