import express from "express";
import {
  createRoom,
  joinRoom,
  getRoom,
  listRoomsForUser,
  listMembers,
  getMember,
  getMemberByPublishKey,
  getWatchState,
  setWatchState
} from "./db.js";
import { getLiveStreamKeys } from "./srs.js";
import { rtcPlay } from "./srsRtc.js";
import { layout, h } from "./html.js";
import { ensureUser } from "./user.js";
import { resolveBilibiliToMp4 } from "./bilibili.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(new URL("../public", import.meta.url).pathname, { maxAge: "1h" }));

app.use((req, res, next) => {
  req.user = ensureUser(req, res);
  next();
});

function getDomain(req) {
  const envDomain = (process.env.DOMAIN || "").trim();
  if (envDomain) return envDomain;
  return req.headers.host || "localhost";
}

function rtmpServer(domain) {
  return `rtmp://${domain}/live`;
}

const watchStreams = new Map();

function watchBroadcast(roomId, event) {
  const rid = String(roomId);
  const set = watchStreams.get(rid);
  if (!set || set.size === 0) return;
  const payload = `event: msg\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of set) res.write(payload);
}

app.get("/", async (req, res) => {
  const domain = getDomain(req);
  const rooms = await listRoomsForUser(req.user.id);
  const list = rooms
    .map(
      (r) => `<div class="card">
  <div class="row" style="justify-content:space-between">
    <div>
      <div style="font-size:18px;font-weight:800">${h(r.title)}</div>
      <div style="margin-top:8px" class="row">
        <span class="tag">房间号 <code>${h(r.id)}</code></span>
      </div>
    </div>
    <div class="row">
      <a class="btn2" href="/r/${encodeURIComponent(r.id)}">进入</a>
      <a class="btn" href="/r/${encodeURIComponent(r.id)}/watch">一起看</a>
    </div>
  </div>
</div>`
    )
    .join("");

  const body = `<div class="row" style="justify-content:space-between;align-items:flex-end">
  <div>
    <div style="font-size:30px;font-weight:900">GAONE Rooms</div>
    <div style="color:var(--muted);margin-top:6px">每个房间每个人都有自己的推流码，只在自己页面显示</div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <div style="font-size:16px;font-weight:800">创建房间</div>
    <form class="row" method="post" action="/rooms" style="margin-top:12px">
      <input name="title" placeholder="房间标题" style="min-width:220px" />
      <input name="name" placeholder="你的昵称" style="min-width:160px" />
      <button class="btn" type="submit">创建</button>
    </form>
    <div style="color:var(--muted);margin-top:10px;line-height:1.8">
      <div>OBS 服务器：<code>${h(rtmpServer(domain))}</code></div>
      <div>推流码：进入房间后自动生成（仅你可见）</div>
    </div>
  </div>
  <div class="card">
    <div style="font-size:16px;font-weight:800">加入房间</div>
    <form class="row" method="post" action="/rooms/join" style="margin-top:12px">
      <input name="roomId" placeholder="房间号，例如 ${h(rooms[0]?.id || "AbC123")}" style="min-width:220px" />
      <input name="name" placeholder="你的昵称" style="min-width:160px" />
      <button class="btn2" type="submit">加入</button>
    </form>
  </div>
</div>

<div style="margin-top:18px;font-size:18px;font-weight:900">我的房间</div>
${list || `<div class="card" style="margin-top:12px">你还没有加入任何房间。</div>`}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(layout({ title: "GAONE Rooms", body }));
});

app.post("/rooms", async (req, res) => {
  const title = req.body?.title;
  const name = req.body?.name;
  const { room } = await createRoom({ title, userId: req.user.id, name });
  res.redirect(`/r/${encodeURIComponent(room.id)}`);
});

app.post("/rooms/join", async (req, res) => {
  const roomId = String(req.body?.roomId || "").trim();
  const name = String(req.body?.name || "").trim();
  if (!roomId) return res.redirect("/");
  const q = name ? `?name=${encodeURIComponent(name)}` : "";
  res.redirect(`/r/${encodeURIComponent(roomId)}${q}`);
});

app.get("/r/:roomId", async (req, res) => {
  const domain = getDomain(req);
  const roomId = String(req.params.roomId || "");
  const name = typeof req.query.name === "string" ? req.query.name : "";
  const joined = await joinRoom({ roomId, userId: req.user.id, name });
  if (!joined.room || !joined.member) return res.status(404).send("房间不存在");

  const [members, liveKeys] = await Promise.all([listMembers(roomId), getLiveStreamKeys()]);
  const me = joined.member;
  const invite = `https://${domain}/r/${encodeURIComponent(roomId)}`;
  const promptName = !me.name || me.name === "访客";

  const memberCards = members
    .map((m) => {
      const live = liveKeys.has(m.publishKey);
      const mine = m.id === me.id;
      return `<button class="p-card" data-member-id="${h(m.id)}" type="button">
  <div class="p-top">
    <div class="p-name">${h(m.name)}${mine ? `<span class="p-me">（我）</span>` : ""}</div>
    <div class="p-badges">
      <span class="badge ${live ? "badge-live" : "badge-off"}">${live ? "LIVE" : "OFF"}</span>
    </div>
  </div>
  <div class="p-sub">点击选择并播放</div>
</button>`;
    })
    .join("");

  const body = `<div class="row" style="justify-content:space-between;align-items:flex-end">
  <div>
    <div style="font-size:28px;font-weight:900">${h(joined.room.title)}</div>
    <div style="color:var(--muted);margin-top:6px" class="row">
      <span class="tag">房间号 <code>${h(roomId)}</code></span>
      <span class="tag">邀请链接 <code>${h(invite)}</code> <button class="btn2" onclick="copyText('${h(
    invite
  )}')">复制</button></span>
    </div>
  </div>
  <div class="row">
    <a class="btn2" href="/">返回</a>
    <a class="btn" href="/r/${encodeURIComponent(roomId)}/watch">一起看</a>
  </div>
</div>

<div class="grid">
  <div class="card">
    <div style="font-size:16px;font-weight:900">你的推流信息（仅你可见）</div>
    <div style="margin-top:10px;line-height:1.9">
      <div>OBS 服务器：<code>${h(rtmpServer(domain))}</code> <button class="btn2" onclick="copyText('${h(
    rtmpServer(domain)
  )}')">复制</button></div>
      <div>推流码：<code>${h(me.publishKey)}</code> <button class="btn2" onclick="copyText('${h(
    me.publishKey
  )}')">复制</button></div>
      <div style="color:var(--muted)">OBS 里用“显示器采集/窗口采集”即可分享屏幕</div>
      <div style="margin-top:10px" class="row">
        <button id="renameBtn" class="btn2" type="button">改昵称</button>
      </div>
    </div>
  </div>
  <div class="card">
    <div style="font-size:16px;font-weight:900">房间成员</div>
    <div class="p-list" style="margin-top:12px">
      ${memberCards || `<div style="color:var(--muted)">暂无成员</div>`}
    </div>
  </div>
</div>

<div class="card" style="margin-top:14px">
  <div class="row" style="justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:16px;font-weight:900">观看</div>
      <div id="sel" style="color:var(--muted);margin-top:6px">请先从右侧选择一个成员</div>
    </div>
    <div class="row">
      <button id="play" class="btn" type="button" disabled>开始播放</button>
      <button id="stop" class="btn2" type="button" disabled>停止</button>
    </div>
  </div>
  <div style="margin-top:12px">
    <video id="v" playsinline autoplay muted controls></video>
    <div id="err" class="err"></div>
  </div>
</div>

<script>
  window.__ROOM__ = ${JSON.stringify({ roomId, meId: me.id, promptName })};
</script>
<div id="modal" class="modal" aria-hidden="true">
  <div class="modal-card" role="dialog" aria-modal="true">
    <div class="modal-title">设置昵称</div>
    <div class="modal-sub">昵称会显示给房间内其他人看到</div>
    <div class="row" style="margin-top:12px">
      <input id="nameInput" placeholder="输入昵称" style="min-width:260px" maxlength="24" />
      <button id="saveName" class="btn" type="button">保存</button>
      <button id="closeModal" class="btn2" type="button">取消</button>
    </div>
    <div id="nameErr" class="err"></div>
  </div>
</div>
<script src="/room.js"></script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(layout({ title: joined.room.title, body }));
});

app.get("/r/:roomId/watch", async (req, res) => {
  const domain = getDomain(req);
  const roomId = String(req.params.roomId || "");
  const joined = await joinRoom({ roomId, userId: req.user.id, name: "" });
  if (!joined.room || !joined.member) return res.status(404).send("房间不存在");

  const room = joined.room;
  const isHost = room.createdBy === req.user.id;
  const state = (await getWatchState(roomId)) || { url: "", paused: true, time: 0, updatedAt: 0, seq: 0 };
  const invite = `https://${domain}/r/${encodeURIComponent(roomId)}/watch`;

  const body = `<div class="row" style="justify-content:space-between;align-items:flex-end">
  <div>
    <div style="font-size:28px;font-weight:950">一起看</div>
    <div style="color:var(--muted);margin-top:6px" class="row">
      <span class="tag">房间号 <code>${h(roomId)}</code></span>
      <span class="tag">邀请链接 <code>${h(invite)}</code> <button class="btn2" onclick="copyText('${h(
    invite
  )}')">复制</button></span>
    </div>
  </div>
  <div class="row">
    <a class="btn2" href="/r/${encodeURIComponent(roomId)}">回到房间</a>
  </div>
</div>

<div class="grid">
  <div class="card">
    <div style="font-size:16px;font-weight:950">播放器</div>
    <div style="margin-top:12px">
      <video id="wv" playsinline controls></video>
      <div id="werr" class="err"></div>
    </div>
  </div>
  <div class="card">
    <div style="font-size:16px;font-weight:950">房主控制</div>
    <div style="color:var(--muted);margin-top:6px">${isHost ? "你是房主，可控制播放/暂停/进度/换片" : "仅房主可以控制，其他人将自动同步"}</div>
    <div style="margin-top:12px" class="row">
      <input id="wurl" placeholder="粘贴视频链接（mp4 直链，或哔哩哔哩链接自动解析默认 720p）" style="min-width:360px;flex:1" />
      <button id="wset" class="btn" type="button"${isHost ? "" : " disabled"}>拉取链接</button>
    </div>
    <div style="margin-top:12px" class="row">
      <button id="wplay" class="btn"${isHost ? "" : " disabled"} type="button">播放</button>
      <button id="wpause" class="btn2"${isHost ? "" : " disabled"} type="button">暂停</button>
      <button id="wsync" class="btn2"${isHost ? "" : " disabled"} type="button">同步一次</button>
    </div>
    <div style="margin-top:12px;color:var(--muted);line-height:1.8">
      <div>不占用服务器上下行带宽：每个人浏览器直接拉取视频，服务器只负责同步指令。</div>
      <div>提示：部分视频网站链接不支持直接在 video 播放，请用 mp4 直链或自建视频源。</div>
    </div>
  </div>
</div>

<script>
  window.__WATCH__ = ${JSON.stringify({ roomId, isHost, init: state })};
</script>
<script src="/watch.js"></script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(layout({ title: `一起看 - ${room.title}`, body, theme: "watch" }));
});

app.get("/api/watch/events", async (req, res) => {
  const roomId = typeof req.query.roomId === "string" ? req.query.roomId : "";
  if (!roomId) return res.status(400).end();

  const joined = await joinRoom({ roomId, userId: req.user.id, name: "" });
  if (!joined.room || !joined.member) return res.status(404).end();

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const rid = String(roomId);
  const set = watchStreams.get(rid) || new Set();
  set.add(res);
  watchStreams.set(rid, set);

  const state = (await getWatchState(roomId)) || { url: "", paused: true, time: 0, updatedAt: 0, seq: 0 };
  res.write(`event: msg\ndata: ${JSON.stringify({ type: "state", state, serverTime: Date.now() })}\n\n`);

  const ping = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(ping);
    const s = watchStreams.get(rid);
    if (s) {
      s.delete(res);
      if (s.size === 0) watchStreams.delete(rid);
    }
  });
});

app.post("/api/watch/command", async (req, res) => {
  const roomId = String(req.body?.roomId || "");
  const type = String(req.body?.type || "");
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  const time = Number(req.body?.time || 0);
  const paused = typeof req.body?.paused === "boolean" ? req.body.paused : undefined;

  if (!roomId || !type) return res.status(400).json({ code: 400 });

  const room = await getRoom(roomId);
  if (!room) return res.status(404).json({ code: 404 });
  if (room.createdBy !== req.user.id) return res.status(403).json({ code: 403 });

  if (type === "set_url") {
    const next = await setWatchState(roomId, { url, time: 0, paused: true });
    watchBroadcast(roomId, { type: "state", state: next, serverTime: Date.now() });
    return res.json({ code: 0, state: next });
  }

  if (type === "play") {
    const next = await setWatchState(roomId, { time, paused: false });
    watchBroadcast(roomId, { type: "state", state: next, serverTime: Date.now() });
    return res.json({ code: 0, state: next });
  }

  if (type === "pause") {
    const next = await setWatchState(roomId, { time, paused: true });
    watchBroadcast(roomId, { type: "state", state: next, serverTime: Date.now() });
    return res.json({ code: 0, state: next });
  }

  if (type === "seek") {
    const next = await setWatchState(roomId, { time, paused: paused === true });
    watchBroadcast(roomId, { type: "state", state: next, serverTime: Date.now() });
    return res.json({ code: 0, state: next });
  }

  if (type === "sync") {
    const next = await setWatchState(roomId, {
      time,
      paused: typeof paused === "boolean" ? paused : undefined
    });
    watchBroadcast(roomId, { type: "state", state: next, serverTime: Date.now() });
    return res.json({ code: 0, state: next });
  }

  res.status(400).json({ code: 400 });
});

app.post("/api/watch/resolve", async (req, res) => {
  const roomId = String(req.body?.roomId || "");
  const url = String(req.body?.url || "").trim();
  if (!roomId || !url) return res.status(400).json({ code: 400, message: "bad request" });

  const room = await getRoom(roomId);
  if (!room) return res.status(404).json({ code: 404, message: "room not found" });
  if (room.createdBy !== req.user.id) return res.status(403).json({ code: 403, message: "forbidden" });

  const r = await resolveBilibiliToMp4(url);
  if (!r.ok) return res.status(400).json({ code: 400, message: r.error });
  res.json({ code: 0, url: r.url, qn: r.qn || 0 });
});

app.post("/hooks/on_publish", async (req, res) => {
  const key = String(req.body?.stream || "");
  const member = await getMemberByPublishKey(key);
  if (!member) return res.status(403).json({ code: 403, message: "forbidden" });
  res.json({ code: 0 });
});

app.post("/hooks/on_unpublish", async (req, res) => {
  res.json({ code: 0 });
});

app.post("/api/public/play", async (req, res) => {
  const roomId = String(req.body?.roomId || "");
  const memberId = String(req.body?.memberId || "");
  const sdp = String(req.body?.sdp || "");
  if (!roomId || !memberId || !sdp) return res.status(400).json({ code: 400, message: "bad request" });

  const room = await getRoom(roomId);
  if (!room) return res.status(404).json({ code: 404, message: "room not found" });

  const member = await getMember(roomId, memberId);
  if (!member) return res.status(404).json({ code: 404, message: "member not found" });

  const domain = getDomain(req);
  const r = await rtcPlay({ domain, publishKey: member.publishKey, sdp });
  if (!r.data || r.data.code !== 0 || !r.data.sdp) return res.status(502).json({ code: 502, data: r.data });
  res.json({ code: 0, sdp: r.data.sdp });
});

app.post("/api/public/rename", async (req, res) => {
  const roomId = String(req.body?.roomId || "");
  const name = String(req.body?.name || "").trim();
  if (!roomId || !name) return res.status(400).json({ code: 400, message: "bad request" });
  if (name.length > 24) return res.status(400).json({ code: 400, message: "name too long" });

  const joined = await joinRoom({ roomId, userId: req.user.id, name });
  if (!joined.room || !joined.member) return res.status(404).json({ code: 404, message: "room not found" });
  res.json({ code: 0, name: joined.member.name });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0");
