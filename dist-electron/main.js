import { app as S, ipcMain as d, BrowserWindow as O, clipboard as V, dialog as C } from "electron";
import h from "path";
import { fileURLToPath as ne } from "url";
import re from "better-sqlite3";
import w from "fs";
import { Client as oe } from "ssh2";
import { SocksClient as se } from "socks";
const ae = process.env.VITE_DEV_SERVER_URL !== void 0, ie = S.getPath("userData"), W = h.join(ie, "webssh_data");
w.existsSync(W) || w.mkdirSync(W, { recursive: !0 });
const le = h.join(W, "database.sqlite3"), g = new re(le, { verbose: ae ? console.log : void 0 });
g.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    privateKeyPath TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER,
    command TEXT,
    log_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(server_id) REFERENCES servers(id)
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);
function Y(e, t, n) {
  g.prepare(`PRAGMA table_info(${e})`).all().some((r) => r.name === t) || g.exec(`ALTER TABLE ${e} ADD COLUMN ${t} ${n}`);
}
Y("servers", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP");
Y("servers", "last_used_at", "DATETIME");
function ce() {
  d.handle("get-servers", () => g.prepare("SELECT * FROM servers ORDER BY created_at DESC").all()), d.handle("add-server", (e, t) => {
    const { name: n, host: a, port: o, username: r, password: i, privateKeyPath: l, remark: s } = t;
    return g.prepare(`
      INSERT INTO servers (name, host, port, username, password, privateKeyPath, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(n, a, o, r, i, l, s).lastInsertRowid;
  }), d.handle("delete-server", (e, t) => (g.prepare("DELETE FROM servers WHERE id = ?").run(t), !0)), d.handle("update-server", (e, { id: t, ...n }) => {
    const { name: a, host: o, port: r, username: i, password: l, privateKeyPath: s, remark: c } = n;
    return g.prepare(`
      UPDATE servers SET name = ?, host = ?, port = ?, username = ?, password = ?, privateKeyPath = ?, remark = ?
      WHERE id = ?
    `).run(a, o, r, i, l, s, c, t), !0;
  }), d.handle("touch-server-last-used", (e, t) => (g.prepare("UPDATE servers SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(t), !0)), d.handle("get-scripts", () => g.prepare("SELECT * FROM scripts ORDER BY created_at DESC").all()), d.handle("add-script", (e, t) => g.prepare("INSERT INTO scripts (name, content) VALUES (?, ?)").run(t.name, t.content).lastInsertRowid), d.handle("get-settings", () => g.prepare("SELECT key, value FROM settings").all()), d.handle("save-setting", (e, { key: t, value: n }) => (g.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(t, n), !0)), d.handle("save-latest-singbox-url", (e, { url: t }) => {
    const n = typeof t == "string" ? t.trim() : "";
    if (!n)
      throw new Error("URL is required.");
    const a = g.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
    return a.run("latest_singbox_url", n), a.run("latest_singbox_url_saved_at", (/* @__PURE__ */ new Date()).toISOString()), !0;
  }), d.handle("get-latest-singbox-url", () => {
    const e = g.prepare("SELECT value FROM settings WHERE key = ?"), t = g.prepare("SELECT value FROM settings WHERE key = ?"), n = e.get("latest_singbox_url"), a = t.get("latest_singbox_url_saved_at");
    return {
      url: n?.value?.trim() || "",
      savedAt: a?.value?.trim() || ""
    };
  });
}
const P = {};
function j(e) {
  return S.isPackaged ? h.join(process.resourcesPath, "singbox", e) : h.join(process.env.APP_ROOT || h.join(__dirname, ".."), "resources", "singbox", e);
}
function M(...e) {
  for (const t of e) {
    const n = j(t);
    if (w.existsSync(n))
      return n;
  }
  return null;
}
function D(e) {
  return h.join(S.getPath("userData"), "singbox-cache", e);
}
const de = `#!/usr/bin/env bash
set -e

ROOT_DIR="$1"
if [[ -z "$ROOT_DIR" ]]; then
    echo "Missing install root dir" >&2
    exit 1
fi

cd "$ROOT_DIR"

printf '\\n[1/3] Update mirrors...\\n'
bash ./main.sh --source mirrors.aliyun.com --protocol http --use-intranet-source false --install-epel false --upgrade-software false --ignore-backup-tips

printf '\\n[2/3] Check wget...\\n'
if ! command -v wget >/dev/null 2>&1; then
    if command -v yum >/dev/null 2>&1; then
        yum install wget -y
    elif command -v dnf >/dev/null 2>&1; then
        dnf install wget -y
    elif command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y wget
    elif command -v zypper >/dev/null 2>&1; then
        zypper --non-interactive install wget
    elif command -v apk >/dev/null 2>&1; then
        apk add wget
    else
        echo "Unsupported package manager: cannot install wget" >&2
        exit 1
    fi
else
    echo "wget already installed"
fi

printf '\\n[3/3] Install sing-box locally...\\n'
tar zxf code.tar.gz
install -m 755 "./jq-bin" /usr/bin/jq
chmod +x ./install.sh
./install.sh -l -f "$ROOT_DIR/$CORE_TAR_NAME"
`;
function R(e) {
  return typeof e == "string" ? e.trim() : "";
}
function v(e) {
  return `'${e.replace(/'/g, "'\\''")}'`;
}
function ue(e) {
  const t = R(e.host), n = R(e.username) || "root", a = Number(e.port || 22), o = typeof e.password == "string" ? e.password : "", r = R(e.privateKeyPath);
  if (!t)
    throw new Error("SSH host is required");
  if (!Number.isInteger(a) || a <= 0 || a > 65535)
    throw new Error("SSH port is invalid");
  return { host: t, username: n, port: a, password: o, privateKeyPath: r };
}
function me(e) {
  return e.message.includes("All configured authentication methods failed") ? new Error("Authentication failed. Check the username, password/private key, and whether the server allows this login method.") : e;
}
function he(e) {
  const t = R(e).toLowerCase();
  if (t === "x86_64" || t === "amd64")
    return "amd64";
  if (t === "aarch64" || t === "arm64")
    return "arm64";
  throw new Error(`Unsupported server architecture: ${e || "unknown"}`);
}
async function pe(e, t, n, a) {
  const o = `${t}.download`, r = new AbortController(), i = setTimeout(() => r.abort(), 45e3);
  try {
    const l = await fetch(e, {
      headers: n ?? {
        "User-Agent": "WebSSHClient"
      },
      signal: r.signal
    });
    if (!l.ok)
      throw new Error(`Download failed: ${e} (${l.status})`);
    const s = l.headers.get("content-length"), c = s ? Number(s) : null, u = l.body;
    if (!u) {
      const E = Buffer.from(await l.arrayBuffer());
      await w.promises.writeFile(o, E), a?.(E.length, c ?? E.length), await w.promises.rename(o, t);
      return;
    }
    let m = 0;
    const f = w.createWriteStream(o);
    await new Promise(async (E, y) => {
      f.on("error", y);
      try {
        for await (const b of u) {
          const x = Buffer.from(b);
          m += x.length, a?.(m, c), f.write(x) || await new Promise((N) => f.once("drain", N));
        }
        f.end(() => E());
      } catch (b) {
        y(b);
      }
    }), a?.(m, c ?? m), await w.promises.rename(o, t);
  } catch (l) {
    throw await w.promises.rm(o, { force: !0 }).catch(() => {
    }), l instanceof Error && l.name === "AbortError" ? new Error(`Download timed out: ${e}`) : l;
  } finally {
    clearTimeout(i);
  }
}
async function fe() {
  const e = await fetch("https://api.github.com/repos/SagerNet/sing-box/releases/latest", {
    headers: {
      "User-Agent": "WebSSHClient",
      Accept: "application/vnd.github+json"
    }
  });
  if (!e.ok)
    throw new Error(`Failed to query sing-box release metadata (${e.status})`);
  return e.json();
}
function F(e, t, n) {
  let a = -1, o = -1;
  return (r, i) => {
    if (i && i > 0) {
      const s = Math.max(0, Math.min(100, Math.floor(r / i * 100)));
      if (s === a || s < 100 && s - a < 10)
        return;
      a = s, T(e, t, `[0/3] Downloading ${n}... ${s}%\r
`);
      return;
    }
    const l = Math.floor(r / (1024 * 1024));
    l <= 0 || l === o || (o = l, T(e, t, `[0/3] Downloading ${n}... ${l} MB\r
`));
  };
}
async function z(e, t, n, a) {
  const o = h.dirname(D(t)), r = D(t);
  await w.promises.mkdir(o, { recursive: !0 });
  const i = await w.promises.stat(r).catch(() => null);
  return i && i.isFile() && i.size > 0 ? (n?.(i.size, i.size), r) : (await pe(e, r, a, n), r);
}
async function A(e, t) {
  return new Promise((n, a) => {
    e.exec(t, (o, r) => {
      if (o) {
        a(o);
        return;
      }
      let i = "", l = "";
      r.on("data", (s) => {
        i += s.toString();
      }), r.stderr.on("data", (s) => {
        l += s.toString();
      }), r.on("close", (s) => {
        if (s && s !== 0) {
          a(new Error((l || i || `Remote command failed with exit code ${s}`).trim()));
          return;
        }
        n((i || l).trim());
      });
    });
  });
}
async function we(e, t, n) {
  return new Promise((a, o) => {
    e.exec(t, (r, i) => {
      if (r) {
        o(r);
        return;
      }
      let l = "";
      i.on("data", (s) => {
        n(s.toString());
      }), i.stderr.on("data", (s) => {
        const c = s.toString();
        l += c, n(c);
      }), i.on("close", (s) => {
        if (s && s !== 0) {
          o(new Error((l || `Remote command failed with exit code ${s}`).trim()));
          return;
        }
        a();
      });
    });
  });
}
async function I(e) {
  return new Promise((t, n) => {
    e.sftp((a, o) => {
      if (a) {
        n(a);
        return;
      }
      t(o);
    });
  });
}
async function $(e, t, n) {
  await new Promise((a, o) => {
    e.fastPut(t, n, (r) => {
      if (r) {
        o(r);
        return;
      }
      a();
    });
  });
}
async function K(e, t, n, a) {
  const r = (await w.promises.stat(t)).size;
  await new Promise((i, l) => {
    e.fastPut(t, n, {
      step: (s, c, u) => {
        a?.(s, u || r);
      }
    }, (s) => {
      if (s) {
        l(s);
        return;
      }
      a?.(r, r), i();
    });
  });
}
async function Ee(e, t, n) {
  await new Promise((a, o) => {
    const r = e.createWriteStream(t, {
      encoding: "utf8",
      mode: 493
    });
    r.on("error", o), r.on("close", () => a()), r.end(n);
  });
}
function T(e, t, n) {
  e.sender.isDestroyed() || e.sender.send(`ssh-data-${t}`, n);
}
function X(e, t, n) {
  e.sender.isDestroyed() || e.sender.send(`ssh-upload-progress-${t}`, n);
}
function ge() {
  d.handle("connect-ssh", async (e, { sessionId: t, server: n, options: a }) => new Promise((o, r) => {
    const i = new oe();
    let l;
    try {
      l = ue(n || {});
    } catch (c) {
      r(c);
      return;
    }
    i.on("ready", () => {
      i.shell({ term: "xterm-color" }, (c, u) => {
        if (c) {
          r(c);
          return;
        }
        P[t] = {
          conn: i,
          manualClose: !1
        }, u.on("data", (m) => {
          e.sender.isDestroyed() || e.sender.send(`ssh-data-${t}`, m.toString());
        }), d.on(`ssh-write-${t}`, (m, f) => {
          u.write(f);
        }), d.on(`ssh-resize-${t}`, (m, { cols: f, rows: E }) => {
          u.setWindow(E, f, 0, 0);
        }), u.on("close", () => {
          const m = P[t], f = m?.manualClose ?? !1;
          i.end(), d.removeAllListeners(`ssh-write-${t}`), d.removeAllListeners(`ssh-resize-${t}`), m?.conn === i && delete P[t], m?.resolveDisconnect?.(!0), !f && !e.sender.isDestroyed() && e.sender.send(`ssh-closed-${t}`);
        }), o(!0);
      });
    }).on("keyboard-interactive", (c, u, m, f, E) => {
      E(f.map(() => l.password));
    }).on("error", (c) => {
      r(me(c));
    });
    const s = {
      host: l.host,
      port: l.port,
      username: l.username
    };
    if (l.password)
      s.password = l.password, s.tryKeyboard = !0;
    else if (l.privateKeyPath)
      try {
        s.privateKey = w.readFileSync(l.privateKeyPath);
      } catch (c) {
        r(new Error("Failed to read private key file: " + String(c)));
        return;
      }
    a?.proxy ? se.createConnection({
      proxy: {
        host: a.proxy.host,
        port: a.proxy.port,
        type: 5
      },
      command: "connect",
      destination: {
        host: l.host,
        port: l.port
      }
    }).then((c) => {
      s.sock = c.socket, i.connect(s);
    }).catch((c) => {
      r(new Error("Proxy connection failed: " + c.message));
    }) : i.connect(s);
  })), d.handle("exec-command", async (e, { sessionId: t, command: n }) => new Promise((a, o) => {
    const r = P[t];
    if (!r)
      return o(new Error("SSH session not found."));
    r.conn.exec(n, (i, l) => {
      if (i) return o(i);
      let s = "";
      l.on("data", (c) => {
        s += c.toString();
      }).on("close", () => {
        a(s);
      });
    });
  })), d.handle("disconnect-ssh", (e, t) => {
    const n = P[t];
    return n ? (n.disconnectPromise || (n.manualClose = !0, n.disconnectPromise = new Promise((a) => {
      n.resolveDisconnect = a, n.conn.end();
    })), n.disconnectPromise) : !0;
  }), d.handle("upload-file-to-session", async (e, { sessionId: t, localPath: n, remotePath: a }) => {
    const o = P[t];
    if (!o)
      throw new Error("SSH session not found.");
    const r = R(n), i = R(a);
    if (!r)
      throw new Error("Local file path is required.");
    if (!i)
      throw new Error("Remote path is required.");
    const l = await w.promises.stat(r).catch(() => null);
    if (!l || !l.isFile())
      throw new Error("Selected local file does not exist.");
    const s = h.posix.dirname(i);
    await A(o.conn, `mkdir -p '${s.replace(/'/g, "'\\''")}'`);
    const c = await I(o.conn);
    try {
      await K(
        c,
        r,
        i,
        (u, m) => {
          X(e, t, {
            transferred: u,
            total: m,
            fileName: h.basename(r),
            remotePath: i
          });
        }
      );
    } finally {
      c.end();
    }
    return {
      fileName: h.basename(r),
      remotePath: i,
      size: l.size
    };
  }), d.handle("upload-files-to-session", async (e, { sessionId: t, files: n, remoteDir: a }) => {
    const o = P[t];
    if (!o)
      throw new Error("SSH session not found.");
    if (!Array.isArray(n) || n.length === 0)
      throw new Error("No local files selected.");
    const r = R(a);
    if (!r)
      throw new Error("Remote directory is required.");
    const i = r.replace(/\\/g, "/").replace(/'/g, "'\\''");
    await A(o.conn, `mkdir -p '${i}'`);
    const l = await I(o.conn), s = [];
    try {
      for (const u of n) {
        const m = R(u?.path), f = await w.promises.stat(m).catch(() => null);
        if (!f || !f.isFile())
          throw new Error(`Selected local file does not exist: ${m}`);
        const E = R(u?.name) || h.basename(m), y = `${r.replace(/\/+$/, "")}/${E}`;
        await K(
          l,
          m,
          y,
          (b, x) => {
            X(e, t, {
              transferred: b,
              total: x,
              fileName: E,
              remotePath: y
            });
          }
        ), s.push({
          fileName: E,
          remotePath: y,
          size: f.size
        });
      }
    } finally {
      l.end();
    }
    const c = `printf '\\n[Upload] Files uploaded to ${r}\\n'; ls -lh '${i}'`;
    return T(e, t, `\r
[Upload] Refreshing remote directory listing...\r
`), await we(o.conn, `bash -lc "${c.replace(/"/g, '\\"')}"`, (u) => {
      T(e, t, u);
    }), {
      remoteDir: r,
      uploadedFiles: s
    };
  }), d.handle("install-singbox-locally", async (e, { sessionId: t }) => {
    const n = P[t];
    if (!n)
      throw new Error("SSH session not found.");
    {
      T(e, t, `\r
[0/3] Detecting server architecture...\r
`);
      const a = await A(n.conn, "uname -m"), o = he(a), r = M(`sing-box-linux-${o}.tar.gz`);
      let i = r ? h.basename(r) : "", l = "";
      if (!r) {
        const H = await fe();
        i = `sing-box-${H.tag_name.slice(1)}-linux-${o}.tar.gz`;
        const B = H.assets.find((te) => te.name === i);
        if (!B)
          throw new Error(`Unable to find sing-box asset for ${o}`);
        l = B.browser_download_url;
      }
      const s = `/root/.webssh-singbox-${Date.now()}`, c = `${s}/main.sh`, u = `${s}/install.sh`, m = `${s}/run-install.sh`, f = j("main.sh"), E = j("install.sh"), y = M("code.tar.gz"), b = M(`jq-linux-${o}`), x = D("code.tar.gz"), N = D(i), Z = D(`jq-linux-${o}`);
      let U = y;
      U ? T(e, t, `[0/3] Using bundled code.tar.gz...\r
`) : (T(
        e,
        t,
        `${w.existsSync(x) ? "[0/3] Using cached code.tar.gz..." : "[0/3] Downloading code.tar.gz..."}\r
`
      ), U = await z(
        "https://github.com/233boy/sing-box/releases/latest/download/code.tar.gz",
        "code.tar.gz",
        F(e, t, "code.tar.gz")
      ));
      let L = r;
      L ? T(e, t, `[0/3] Using bundled ${i}...\r
`) : (T(
        e,
        t,
        `${w.existsSync(N) ? `[0/3] Using cached ${i}...` : `[0/3] Downloading ${i}...`}\r
`
      ), L = await z(
        l,
        i,
        F(e, t, i)
      ));
      let k = b;
      k ? T(e, t, `[0/3] Using bundled jq-linux-${o}...\r
`) : (T(
        e,
        t,
        `${w.existsSync(Z) ? `[0/3] Using cached jq-linux-${o}...` : `[0/3] Downloading jq-linux-${o}...`}\r
`
      ), k = await z(
        `https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-${o}`,
        `jq-linux-${o}`,
        F(e, t, `jq-linux-${o}`)
      ));
      const _ = await I(n.conn);
      T(e, t, `[0/3] Uploading installer resources...\r
`), await A(n.conn, `mkdir -p '${s}'`), await $(_, f, c), await $(_, E, u), await $(_, U, `${s}/code.tar.gz`), await $(_, L, `${s}/${i}`), await $(_, k, `${s}/jq-bin`), await Ee(
        _,
        m,
        `#!/usr/bin/env bash
set -e
CORE_TAR_NAME='${i}'
${de}`
      ), _.end(), await A(
        n.conn,
        `chmod +x ${v(c)} ${v(u)} ${v(m)}`
      );
      const ee = `bash ${v(m)} ${v(s)}`;
      return T(e, t, `[0/3] Installer assets ready. Launching in current terminal...\r
`), {
        remoteDir: s,
        launchCommand: ee
      };
    }
  });
}
const G = h.dirname(ne(import.meta.url));
process.env.APP_ROOT = h.join(G, "..");
const q = process.env.VITE_DEV_SERVER_URL, Ae = h.join(process.env.APP_ROOT, "dist-electron"), J = h.join(process.env.APP_ROOT, "dist-renderer");
process.env.VITE_PUBLIC = q ? h.join(process.env.APP_ROOT, "public") : J;
let p;
const Te = S.isPackaged ? h.join(process.resourcesPath, "webssh.ico") : h.join(process.env.APP_ROOT || "", "webssh.ico");
process.platform === "win32" && S.setAppUserModelId("com.webssh.client");
function Q() {
  p = new O({
    icon: Te,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: !0,
    webPreferences: {
      preload: h.join(G, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0
    }
    // 暗色主题玻璃风格可以结合 frame: false 或 titleBarStyle 后续补充
  }), p.webContents.on("did-finish-load", () => {
    p?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  const e = (t) => {
    !p || p.isDestroyed() || p.webContents.isDestroyed() || p.webContents.send("window-layout-changed", {
      state: t,
      timestamp: Date.now()
    });
  };
  p.on("resize", () => e("resize")), p.on("maximize", () => e("maximize")), p.on("unmaximize", () => e("unmaximize")), p.on("restore", () => e("restore")), p.on("enter-full-screen", () => e("enter-full-screen")), p.on("leave-full-screen", () => e("leave-full-screen")), p.removeMenu(), q ? p.loadURL(q) : p.loadFile(h.join(J, "index.html"));
}
S.on("window-all-closed", () => {
  process.platform !== "darwin" && (S.quit(), p = null);
});
S.on("activate", () => {
  O.getAllWindows().length === 0 && Q();
});
S.whenReady().then(Q);
d.handle("get-system-locale", () => S.getLocale());
d.handle("clipboard-write-text", (e, t) => (V.writeText(String(t ?? "")), !0));
d.handle("clipboard-read-text", () => V.readText());
d.handle("check-remote-embed-page", async (e, t) => {
  let n;
  try {
    n = new URL(String(t ?? ""));
  } catch {
    return { ok: !1 };
  }
  const a = async (r) => {
    const i = new AbortController(), l = setTimeout(() => i.abort(), 7e3);
    try {
      const s = await fetch(n, {
        method: r,
        redirect: "follow",
        signal: i.signal,
        headers: {
          "User-Agent": "WebSSHClient"
        }
      }), c = s.headers.get("content-type") || "", u = !c || c.includes("text/html") || c.includes("application/xhtml+xml");
      return {
        ok: s.ok && u,
        url: s.url
      };
    } catch {
      return {
        ok: !1,
        url: n.toString()
      };
    } finally {
      clearTimeout(l);
    }
  };
  let o = await a("HEAD");
  return o.ok || (o = await a("GET")), o.ok ? o : { ok: !1 };
});
d.handle("pick-upload-file", async () => {
  const e = O.getFocusedWindow() ?? p, t = e ? await C.showOpenDialog(e, {
    properties: ["openFile"],
    title: "Select File"
  }) : await C.showOpenDialog({
    properties: ["openFile"],
    title: "Select File"
  });
  return t.canceled || t.filePaths.length === 0 ? null : t.filePaths[0];
});
d.handle("pick-upload-files", async () => {
  const e = O.getFocusedWindow() ?? p, t = e ? await C.showOpenDialog(e, {
    properties: ["openFile", "multiSelections"],
    title: "Select Files"
  }) : await C.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    title: "Select Files"
  });
  return t.canceled || t.filePaths.length === 0 ? [] : Promise.all(t.filePaths.map(async (n) => {
    const a = await import("fs/promises").then((o) => o.stat(n));
    return {
      path: n,
      name: h.basename(n),
      size: a.size
    };
  }));
});
ce();
ge();
export {
  Ae as MAIN_DIST,
  J as RENDERER_DIST,
  q as VITE_DEV_SERVER_URL
};
