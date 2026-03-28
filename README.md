# GAONE Live（OBS 推流 + WebRTC 低延迟观看）

目标：像 Twitch 一样给每个直播间分配推流码（Stream Key），OBS 填服务器地址 + 推流码即可开播；观众端走 WebRTC，延迟尽量低；Docker Compose 一键部署，适配 1Panel/宝塔。

## 架构

- 推流：OBS → RTMP（1935/TCP）→ SRS
- 播放：浏览器 → WebRTC（8000/UDP）→ SRS
- 信令：浏览器 → HTTPS `/rtc/v1/play/` → 反代 → SRS（仅转发 WebRTC 信令接口）
- 管理：Web 管理后台生成推流码，SRS 通过 HTTP Hooks 回调校验推流码合法性

## 端口与要求

- 1935/TCP、8000/UDP 必须放行
- WebRTC 播放建议 HTTPS 域名访问（安全上下文）

## 快速开始（Docker Compose）

1. 复制并编辑环境变量

```bash
cp .env.example .env
```

2. 修改 `.env`

- `DOMAIN`：你的公网域名（解析到当前服务器）
- `ACME_EMAIL`：用于申请证书
- `RTC_CANDIDATE`：建议填你的公网域名或公网 IP（用于 WebRTC ICE 候选）
- `ADMIN_TOKEN`：后台管理口令
- `CADDY_HTTP_PORT`/`CADDY_HTTPS_PORT`：Caddy 绑定端口（默认 80/443）

3. 启动

方案 A：用本项目自带 Caddy（自动 HTTPS，要求宿主机 80/443 未被占用）

```bash
docker compose --profile caddy up -d --build
```

4. 访问

- 首页：`https://DOMAIN/`
- 管理后台：`https://DOMAIN/admin?token=ADMIN_TOKEN`

方案 B：在 1Panel/宝塔使用它们自带的 Nginx/网关做 HTTPS 与反代（推荐，避免 80/443 端口冲突）

```bash
docker compose up -d --build
```

默认将 `3000`（站点）和 `1985`（SRS 信令/API）只绑定到 `127.0.0.1`，供面板反代使用，不对公网直接暴露。

然后在面板里为 `DOMAIN` 配置反向代理：

```nginx
location /rtc/v1/ {
  proxy_pass http://127.0.0.1:1985;
}
location / {
  proxy_pass http://127.0.0.1:3000;
}
```

并确保面板/防火墙放行：80/443（由面板占用）+ 1935/TCP + 8000/UDP。

## OBS 设置

OBS → 设置 → 推流

- 服务：自定义
- 服务器：`rtmp://DOMAIN/live`
- 串流密钥：在管理后台创建直播间后得到的 key

## 常见问题

- 观众端打不开/黑屏：优先检查 8000/UDP 是否放行；其次确认 `RTC_CANDIDATE` 填的是公网可达地址
- 推流被拒绝：说明推流码不存在（SRS 会回调应用校验），请在后台创建直播间后再推流
