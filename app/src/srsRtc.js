const base = process.env.SRS_API_BASE || "http://srs:1985";

export async function rtcPlay({ domain, publishKey, sdp }) {
  const api = new URL("/rtc/v1/play/", base).toString();
  const streamurl = `webrtc://${domain}/live/${encodeURIComponent(publishKey)}`;

  const res = await fetch(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api, streamurl, sdp })
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

