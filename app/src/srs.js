const base = process.env.SRS_API_BASE || "http://srs:1985";

export async function getLiveStreamKeys() {
  const url = new URL("/api/v1/streams", base);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return new Set();
  const data = await res.json().catch(() => null);
  if (!data || data.code !== 0 || !Array.isArray(data.streams)) return new Set();

  const keys = new Set();
  for (const s of data.streams) {
    if (!s) continue;
    if (s.app !== "live") continue;
    if (typeof s.name === "string" && s.name) keys.add(s.name);
  }
  return keys;
}
