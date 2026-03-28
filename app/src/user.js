import crypto from "node:crypto";

function parseCookie(header) {
  const out = {};
  const raw = String(header || "");
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function ensureUser(req, res) {
  const cookies = parseCookie(req.headers.cookie);
  let uid = cookies.gaone_uid;
  if (!uid || typeof uid !== "string" || uid.length < 10) {
    uid = crypto.randomBytes(16).toString("hex");
    const secure = String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https";
    res.setHeader(
      "Set-Cookie",
      serializeCookie("gaone_uid", uid, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
        maxAge: 60 * 60 * 24 * 365 * 5
      })
    );
  }
  return { id: uid };
}

