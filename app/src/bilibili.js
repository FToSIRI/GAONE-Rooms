const ALLOWED_HOSTS = new Set(["www.bilibili.com", "bilibili.com", "m.bilibili.com", "b23.tv"]);

function timeoutSignal(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, clear: () => clearTimeout(t) };
}

function normalizeUrl(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) return null;
  return u;
}

function extractBvidFromUrl(u) {
  const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/);
  return m ? m[1] : null;
}

function extractPage(u) {
  const p = Number(u.searchParams.get("p") || 1);
  if (!Number.isFinite(p) || p < 1) return 1;
  return Math.floor(p);
}

async function resolveB23(u) {
  const { signal, clear } = timeoutSignal(8000);
  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.bilibili.com/"
      },
      signal
    });
    return new URL(res.url);
  } finally {
    clear();
  }
}

async function httpGetJson(url) {
  const { signal, clear } = timeoutSignal(8000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Referer: "https://www.bilibili.com/"
      },
      signal
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } finally {
    clear();
  }
}

async function getCidForPage(bvid, page) {
  const js = await httpGetJson(
    `https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}&jsonp=jsonp`
  );
  const arr = Array.isArray(js?.data) ? js.data : [];
  const item = arr.find((x) => x && x.page === page) || arr[0];
  return item?.cid ? String(item.cid) : null;
}

async function fetchPlayurl(bvid, cid, qn) {
  const params = new URLSearchParams({
    bvid: String(bvid),
    cid: String(cid),
    qn: String(qn),
    fourk: "1",
    fnver: "0",
    fnval: "0",
    otype: "json",
    platform: "html5"
  });
  return await httpGetJson(`https://api.bilibili.com/x/player/playurl?${params.toString()}`);
}

function pickMp4(js) {
  const durl = js?.data?.durl;
  if (!Array.isArray(durl) || durl.length === 0) return null;
  for (const e of durl) {
    const url = e?.url;
    if (typeof url === "string" && url.toLowerCase().includes(".mp4") && !url.toLowerCase().includes(".m4s")) {
      return url;
    }
    const bu = e?.backup_url;
    if (Array.isArray(bu)) {
      const b = bu.find(
        (x) => typeof x === "string" && x.toLowerCase().includes(".mp4") && !x.toLowerCase().includes(".m4s")
      );
      if (b) return b;
    }
  }
  return null;
}

export async function resolveBilibiliToMp4(inputUrl) {
  let u = normalizeUrl(inputUrl);
  if (!u) return { ok: false, error: "仅支持 bilibili.com / b23.tv 链接" };

  if (u.hostname === "b23.tv") {
    u = await resolveB23(u);
    if (!ALLOWED_HOSTS.has(u.hostname)) return { ok: false, error: "短链跳转目标不被允许" };
  }

  const bvid = extractBvidFromUrl(u);
  if (!bvid) return { ok: false, error: "无法解析 BV 号" };

  const page = extractPage(u);
  const cid = await getCidForPage(bvid, page);
  if (!cid) return { ok: false, error: "无法获取 CID" };

  const qnTry = [64, 80, 32, 16];
  for (const qn of qnTry) {
    const js = await fetchPlayurl(bvid, cid, qn);
    const url = pickMp4(js);
    if (url) return { ok: true, url, qn };
  }
  return { ok: false, error: "未找到可用的 MP4 直链" };
}

