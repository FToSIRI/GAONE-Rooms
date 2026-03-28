import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const dataDir = process.env.DATA_DIR || "/data";
const dbPath = path.join(dataDir, "db.json");

let writeChain = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readDb() {
  await ensureDir();
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { rooms: [], members: [], watch: {} };
    const rooms = Array.isArray(data.rooms) ? data.rooms : [];
    const members = Array.isArray(data.members) ? data.members : [];
    const watch = data.watch && typeof data.watch === "object" ? data.watch : {};
    return { rooms, members, watch };
  } catch (e) {
    if (e && e.code === "ENOENT") return { rooms: [], members: [], watch: {} };
    throw e;
  }
}

async function writeDb(data) {
  await ensureDir();
  const tmp = `${dbPath}.tmp`;
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, dbPath);
}

function withWriteLock(fn) {
  writeChain = writeChain.then(fn, fn);
  return writeChain;
}

function genId(bytes = 6) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function genPublishKey() {
  return crypto.randomBytes(16).toString("hex");
}

export async function createRoom({ title, userId, name }) {
  const now = new Date().toISOString();

  return withWriteLock(async () => {
    const db = await readDb();
    const room = {
      id: genId(6),
      title: String(title || "").trim() || "未命名房间",
      createdAt: now,
      createdBy: userId
    };
    db.rooms.unshift(room);

    const member = {
      id: genId(9),
      roomId: room.id,
      userId,
      name: String(name || "").trim() || "访客",
      publishKey: genPublishKey(),
      createdAt: now
    };
    db.members.unshift(member);
    await writeDb(db);
    return { room, member };
  });
}

export async function joinRoom({ roomId, userId, name }) {
  const now = new Date().toISOString();

  return withWriteLock(async () => {
    const db = await readDb();
    const room = db.rooms.find((r) => r.id === roomId) || null;
    if (!room) return { room: null, member: null };

    const existing = db.members.find((m) => m.roomId === roomId && m.userId === userId) || null;
    if (existing) {
      if (String(name || "").trim()) existing.name = String(name).trim();
      await writeDb(db);
      return { room, member: existing };
    }

    const member = {
      id: genId(9),
      roomId,
      userId,
      name: String(name || "").trim() || "访客",
      publishKey: genPublishKey(),
      createdAt: now
    };
    db.members.unshift(member);
    await writeDb(db);
    return { room, member };
  });
}

export async function getRoom(roomId) {
  const db = await readDb();
  return db.rooms.find((r) => r.id === roomId) || null;
}

export async function listRoomsForUser(userId) {
  const db = await readDb();
  const roomIds = new Set(db.members.filter((m) => m.userId === userId).map((m) => m.roomId));
  return db.rooms.filter((r) => roomIds.has(r.id));
}

export async function listMembers(roomId) {
  const db = await readDb();
  return db.members.filter((m) => m.roomId === roomId);
}

export async function getMember(roomId, memberId) {
  const db = await readDb();
  return db.members.find((m) => m.roomId === roomId && m.id === memberId) || null;
}

export async function getMemberByPublishKey(publishKey) {
  const db = await readDb();
  return db.members.find((m) => m.publishKey === publishKey) || null;
}

export async function getWatchState(roomId) {
  const db = await readDb();
  const s = db.watch[String(roomId)] || null;
  if (!s || typeof s !== "object") return null;
  return {
    url: typeof s.url === "string" ? s.url : "",
    paused: !!s.paused,
    time: Number.isFinite(s.time) ? s.time : 0,
    updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : 0,
    seq: Number.isFinite(s.seq) ? s.seq : 0
  };
}

export async function setWatchState(roomId, patch) {
  const rid = String(roomId);
  const now = Date.now();

  return withWriteLock(async () => {
    const db = await readDb();
    if (!db.watch || typeof db.watch !== "object") db.watch = {};

    const prev = db.watch[rid] && typeof db.watch[rid] === "object" ? db.watch[rid] : {};
    const next = {
      url: typeof patch.url === "string" ? patch.url : typeof prev.url === "string" ? prev.url : "",
      paused: typeof patch.paused === "boolean" ? patch.paused : !!prev.paused,
      time: Number.isFinite(patch.time) ? patch.time : Number.isFinite(prev.time) ? prev.time : 0,
      updatedAt: now,
      seq: (Number.isFinite(prev.seq) ? prev.seq : 0) + 1
    };

    db.watch[rid] = next;
    await writeDb(db);
    return next;
  });
}
