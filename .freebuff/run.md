# Running eclipsed. (`index.svg`) for live preview

Static, single-file app. No package manager, build step, or dependencies —
`index.svg` is the whole app (a self-contained SVG shell with embedded
HTML/CSS/JS). For LAN rooms there is one extra file, `lan-server.mjs`, a tiny
zero-dependency Node server that hosts the app and resolves short room codes
between devices on the same network (see below).

## How to reproduce the artifacts

None. The workspace needs `index.svg` (+ `lan-server.mjs` for LAN rooms); no
`.env` files or generated output exist.

## How to run the app

Serving the file over HTTP is required (dynamic imports and Notification
permission need an `http://` origin — `file://` breaks them).

### Quick start — LAN rooms (recommended)

```bash
node lan-server.mjs            # default port 8377
```

Open the printed `http://<this-machine's-LAN-ip>:8377/` URL from any device on
the same network. The LAN server is what makes rooms behave like a normal chat
app: create a room with any code (as short as one character) and others type
that code to join — no long invite strings, no copying replies. The invite card
also shows a QR code carrying the room's join link: point the other device's
camera at it and the room opens with zero typing. Room endpoints answer
LAN/loopback clients only, so nothing is reachable from the internet.

Optional flags: `node lan-server.mjs --port 9000 --host 0.0.0.0`.

### Plain static hosting (offline / same-browser only)

```bash
cd /Users/rohan/eclipse
python3 -m http.server 8377 --bind 127.0.0.1
```

Open `http://127.0.0.1:8377/index.svg` in Chrome. Without the LAN server, the
app still works for a single browser (join a code from another window/tab) and
keeps the manual raw-invite flow as a fallback, but codes do not resolve across
devices.
