export function isAdmin(req) {
  const token = process.env.ADMIN_TOKEN || "";
  if (!token) return { ok: false, error: "ADMIN_TOKEN 未配置", status: 500 };

  const q = typeof req.query.token === "string" ? req.query.token : "";
  const h = String(req.headers.authorization || "");
  const headerToken = h.startsWith("Bearer ") ? h.slice("Bearer ".length).trim() : "";
  const ok = q === token || headerToken === token;

  if (!ok) return { ok: false, error: "未授权", status: 401 };
  return { ok: true };
}

export function requireAdmin(req, res, next) {
  const a = isAdmin(req);
  if (!a.ok) return res.status(a.status).send(a.error);
  return next();
}
