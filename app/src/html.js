function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function layout({ title, body, theme = "pink" }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root{--bg:#140018;--bg2:#1b0622;--card:rgba(255,255,255,.06);--border:rgba(255,255,255,.10);--text:#ffe7f3;--muted:rgba(255,231,243,.72);--pink:#ff4da6;--pink2:#ff86c8;--shadow:0 20px 60px rgba(0,0,0,.45)}
    body.theme-watch{--bg:#241300;--bg2:#2b1700;--card:rgba(255,255,255,.07);--border:rgba(255,255,255,.12);--text:#fff2da;--muted:rgba(255,242,218,.72);--pink:#ff9a1f;--pink2:#ffd166}
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;min-height:100vh;margin:0;color:var(--text);background:radial-gradient(1200px 600px at 20% 0%,rgba(255,77,166,.22),transparent 60%),radial-gradient(900px 500px at 100% 10%,rgba(255,134,200,.16),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2))}
    body.theme-watch{background:radial-gradient(1200px 600px at 20% 0%,rgba(255,154,31,.22),transparent 60%),radial-gradient(900px 500px at 100% 10%,rgba(255,209,102,.18),transparent 55%),linear-gradient(180deg,var(--bg),var(--bg2))}
    a{color:var(--pink2);text-decoration:none}
    a:hover{text-decoration:underline}
    .wrap{max-width:1080px;margin:0 auto;padding:26px}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;box-shadow:var(--shadow);backdrop-filter:blur(10px)}
    .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .grid{display:grid;grid-template-columns:1fr;gap:14px;margin-top:14px}
    @media (min-width:900px){.grid{grid-template-columns:1fr 1fr}}
    .tag{display:inline-flex;gap:8px;align-items:center;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.18);border:1px solid var(--border);color:var(--text);font-size:12px}
    .btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,var(--pink),var(--pink2));color:#240012;border:0;cursor:pointer;font-weight:800}
    .btn[disabled]{opacity:.55;cursor:not-allowed}
    .btn2{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:12px;background:rgba(0,0,0,.18);color:var(--text);border:1px solid var(--border);cursor:pointer}
    .btn2[disabled]{opacity:.55;cursor:not-allowed}
    input{padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.22);color:var(--text);outline:none}
    input:focus{border-color:rgba(255,77,166,.55);box-shadow:0 0 0 4px rgba(255,77,166,.18)}
    code{background:rgba(0,0,0,.22);border:1px solid var(--border);border-radius:10px;padding:2px 8px}
    video{width:100%;background:#000;border-radius:16px;aspect-ratio:16/9}
    .err{margin-top:10px;color:#ffd1e6;white-space:pre-wrap}

    .p-list{display:grid;grid-template-columns:1fr;gap:10px}
    @media (min-width:700px){.p-list{grid-template-columns:1fr 1fr}}
    .p-card{width:100%;text-align:left;border-radius:14px;padding:12px;border:1px solid var(--border);background:rgba(0,0,0,.18);color:var(--text);cursor:pointer}
    .p-card:hover{border-color:rgba(255,134,200,.55)}
    .p-selected{outline:3px solid rgba(255,77,166,.35)}
    .p-top{display:flex;justify-content:space-between;gap:10px;align-items:center}
    .p-name{font-weight:900}
    .p-me{font-weight:800;color:var(--pink2);margin-left:6px}
    .p-sub{margin-top:6px;color:var(--muted);font-size:12px}
    .badge{display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;border:1px solid var(--border);font-size:12px}
    .badge-live{background:rgba(255,77,166,.18);border-color:rgba(255,77,166,.45);color:var(--pink2)}
    .badge-off{background:rgba(0,0,0,.16);color:var(--muted)}
    .modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);z-index:50}
    .modal.show{display:flex}
    .modal-card{width:min(560px,100%);border-radius:18px;border:1px solid var(--border);background:rgba(20,0,24,.88);box-shadow:var(--shadow);padding:16px}
    .modal-title{font-size:18px;font-weight:950}
    .modal-sub{color:var(--muted);margin-top:6px}
  </style>
  <script>
    function copyText(text){navigator.clipboard.writeText(text).catch(()=>{})}
  </script>
</head>
<body class="${theme === "watch" ? "theme-watch" : ""}">
  <div class="wrap">${body}</div>
</body>
</html>`;
}

export function h(s) {
  return esc(s);
}
