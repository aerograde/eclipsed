#!/usr/bin/env node
/*
 * eclipsed. smoke suite — static integrity checks across index.svg and
 * lan-server.mjs (the app is a single self-contained file; the service
 * worker and the GIF library live inside it). Run:  node tests/smoke.mjs
 * Exit code 0 = all green. Each check prints PASS/FAIL.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = join(root, 'index.svg');
const serverPath = join(root, 'lan-server.mjs');
const SW_BEGIN = '/*__ECLIPSED_SW_BEGIN__*/';
const SW_END = '/*__ECLIPSED_SW_END__*/';

function embeddedWorker(app) {
  const start = app.indexOf(SW_BEGIN);
  const end = app.indexOf(SW_END);
  if (start < 0 || end < 0 || end <= start) return null;
  return app.slice(start + SW_BEGIN.length, end);
}

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

const app = readFileSync(appPath, 'utf8');

console.log('\n[1] Structure');
{
  // Real XML parse when python3 is present (authoritative well-formedness).
  const py = spawnSync('python3', ['-c', `import xml.etree.ElementTree as ET; ET.parse(${JSON.stringify(appPath)}); print('ok')`], { encoding: 'utf8' });
  if (py.status !== null) check('index.svg is well-formed XML (python3 parse)', py.status === 0, String(py.stderr).slice(0, 200));
  else check('index.svg is well-formed XML (python3 available)', false, 'python3 not found — skipped');
}
{
  const cssBlocks = app.split(/<style[^>]*>/).slice(1).map((b) => b.split('</style>')[0]);
  const balanced = cssBlocks.every((b) => { const o = (b.match(/{/g) || []).length; const c = (b.match(/}/g) || []).length; return o === c; });
  check('CSS braces balance', balanced);
}

console.log('\n[2] Scripts parse');
{
  const scriptBlocks = [...app.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  check('app + worker script blocks present (>=7)', scriptBlocks.length >= 7, `${scriptBlocks.length} found`);
  scriptBlocks.forEach((m, i) => {
    let code = m[1].trim();
    if (code.startsWith('<![CDATA[')) code = code.slice('<![CDATA['.length);
    if (code.endsWith(']]>')) code = code.slice(0, -3);
    const tmp = join(root, `.work/block-${i}.js`);
    writeFileSync(tmp, code);
    try { execFileSync('node', ['--check', tmp], { stdio: 'pipe' }); check(`script block ${i} parses (${code.length} chars)`, true); }
    catch (e) { check(`script block ${i} parses`, false, String(e.stderr).slice(0, 200)); }
  });
  // The embedded worker must itself be a valid standalone worker script.
  const worker = embeddedWorker(app);
  check('embedded worker block has markers + handlers', worker !== null && worker.includes('notificationclick') && worker.includes('showNotification'), worker === null ? 'markers missing' : 'content present');
  if (worker) {
    const tmp = join(root, '.work/embedded-sw.js');
    writeFileSync(tmp, worker);
    try { execFileSync('node', ['--check', tmp], { stdio: 'pipe' }); check('embedded worker block parses standalone', true); }
    catch (e) { check('embedded worker block parses standalone', false, String(e.stderr).slice(0, 200)); }
  }
}

console.log('\n[3] Branding / placeholders');
check('no sidebar wordmark (logo)', !app.includes('class="wordmark"') && !app.includes('side-brand'));
check('boot preloader no longer paints the wordmark', !app.includes('pre-word') && !app.includes('Loading eclipsed'));
check('no "Known" section markup', !app.includes('aria-label="People you have met"'));
check('legacy name generator is never called', (() => { const call = app.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').match(/createLocalName\s*\(\s*\)/g); return !call || call.length === 1; })());
check('boot purges legacy directory data', /indexedDB\.deleteDatabase\(PEOPLE_DB_NAME\)/.test(app));
check('no "paste this into eclipsed." invite copy', !app.includes('into eclipsed.'));
{
  // Any visible text node carrying the product name as a wordmark?
  const py = spawnSync('python3', ['-c', `
import xml.etree.ElementTree as ET
t = ET.parse('${appPath}')
hits = []
meta = ('title', 'desc', 'metadata', 'style', 'script')
for el in t.iter():
    tag = el.tag.rsplit('}', 1)[-1]
    if tag in meta: continue
    if el.text and 'eclipsed.' in el.text: hits.append((el.tag, el.text[:60]))
import json
print(json.dumps(hits))`], { encoding: 'utf8' });
  let hits = [];
  try { hits = JSON.parse(py.stdout); } catch { hits = [{ raw: py.stdout }]; }
  // svg aria-label carries the app name by design; any other text is a logo echo.
  const real = hits.filter((h) => !(Array.isArray(h) && h[0] === 'aria-label'));
  check('no rendered wordmark text anywhere in UI', real.length === 0, JSON.stringify(hits).slice(0, 200));
}

console.log('\n[4] Palette (matte grey theme)');
{
  const hexes = new Set();
  for (const m of app.matchAll(/#[0-9a-fA-F]{6}\b/g)) hexes.add(m[0]);
  const chroma = (h) => { const v = h.slice(1); const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16); return Math.max(r, g, b) - Math.min(r, g, b); };
  const colorful = [...hexes].map((h) => [h, chroma(h)]).filter(([, c]) => c > 6);
  const themeColors = colorful.filter(([h]) => !['#e0a194', '#e0716a', '#d0776f'].includes(h)); // danger tones are semantic
  check('no colorful theme hexes', themeColors.length === 0, JSON.stringify(themeColors.slice(0, 6)));
}

console.log('\n[5] Free room switching plumbing');
for (const fn of ['parkCurrentRoom', 'resumeHostedRoom', 'liveRoomUsers', 'lanRoomFresh', 'roomResume', 'lanJoinNearbyRoom', 'openGlobalChat', 'tryJoinOpenGlobalRoom']) {
  check(`engine defines ${fn}()`, new RegExp(`function ${fn}\\s*\\(`).test(app));
}
check('leaveRoom no longer erases transcript', !/function leaveRoom\(roomId\) \{[\s\S]*?deleteRoomHistory/.test(app));
check('room rows highlight the open room (is-open)', /is-open/.test(app));
check('roomResume focuses the active room instead of restarting', /Already live in this room/.test(app));

console.log('\n[6] Accent tinting chain');
for (const probe of ['--member-gradient', 'applyRoomTint', 'liveRoomUsers', 'tint-multi', '.chat { --tint: #c9c9c9']) check(`tint wiring: ${probe.slice(0, 44)}`, app.includes(probe));

console.log('\n[7] Speed posture');
check('Chatty model prewarm is deferred (idle-gated)', /scheduleChattyPrewarm/.test(app) && !/setTimeout\(function \(\) \{ prewarmChatty\(\); \}, 1500\)/.test(app));

console.log('\n[8] LAN server invariants');
{
  const srv = readFileSync(serverPath, 'utf8');
  check('lan-server.mjs parses', (() => { try { execFileSync('node', ['--check', serverPath], { stdio: 'pipe' }); return true; } catch { return false; } })());
  check('room TTL shortened (<=3 min)', /ROOM_TTL_MS = 3 \* 60 \* 1000/.test(srv));
  check('stale-host takeover defined', /ROOM_STALE_MS = 90 \* 1000/.test(srv) && /Date\.now\(\) - existing\.at <= ROOM_STALE_MS/.test(srv));
  check('server serves the embedded worker (svg-as-sw route)', /function serveEmbeddedWorker/.test(srv) && /isServiceWorkerFetch\(request\)/.test(srv) && /serveEmbeddedWorker\(response\)/.test(srv));
}

console.log('\n[11] Single-file embedding (worker + GIF library live inside the SVG)');
{
  check('worker registered from the SVG itself', app.includes("navigator.serviceWorker.register('/index.svg')"));
  const beginCount = (app.match(/ECLIPSED_SW_BEGIN/g) || []).length;
  const endCount = (app.match(/ECLIPSED_SW_END/g) || []).length;
  check('worker markers unique', beginCount === 1 && endCount === 1, `begin:${beginCount} end:${endCount}`);
  check('GIF library embedded in the SVG', app.includes('GIF_BUNDLED') && app.includes('"source":"snipe/animated-gifs@master"'));
  check('no external catalog fetch remains', !app.includes('gifs-catalog.json') && !app.includes('GIF_CATALOG_URL'));
  check('no standalone sw.js file reference remains in the app', !app.includes("serviceWorker.register('/sw.js')"));
}

console.log('\n[9] Static ID wiring (engine els.* ids must exist in markup)');
{
  const elsMapBlocks = [...app.matchAll(/els\s*=\s*\{([\s\S]*?)\};/g)];
  const markup = app.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const markupIds = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const referenced = new Set();
  if (elsMapBlocks.length) {
    for (const m of elsMapBlocks[0][1].matchAll(/^[ \t]*([A-Za-z0-9_]+):\s*byId\('([^']+)'\)/gm)) referenced.add(m[2]);
  }
  // ids created dynamically by the engine itself (never in static markup)
  const runtime = new Set([
    'roomAsk', 'roomAskInput', 'roomAskError', 'toast', 'chatLeaveButton',
    'globalOpenButton', 'profileSheet', 'colRoomsList', 'colFriendsList',
    'colPeopleList', 'friendsCount', 'roomCount',
    // legacy rail/hero ids referenced by guarded motion/wiring code
    'railPeopleBtn', 'railChatBtn', 'railAiBtn', 'railNewBtn', 'sideUserHex',
    'heroTitle', 'heroCta', 'heroMeta', 'landCreateCta', 'landJoinCta', 'directoryCount', 'colDirectoryList',
    // Chatty chrome removed from the surface; status setters stay null-guarded
    'aiStatusDot', 'aiStatusTitle', 'aiStatusDetail', 'chattyButton'
  ]);
  const missing = [...referenced].filter((id) => !markupIds.has(id) && !runtime.has(id));
  check('all engine-referenced ids exist in markup', missing.length === 0, missing.slice(0, 20).join(', '));
}

console.log('\n[10] Bug-fix batch (names-not-codes, Chatty, persistent Global)');
{
  check('no Chatty toggle row / dot anywhere', !app.includes('chattyButton') && !app.includes('chatty-row') && !app.includes('.ai-dot'));
  check('notification titles lead with the person, never the room code', app.includes('DM from \' + sender') && app.includes("sender + ' mentioned you'") && !app.includes("sender + ' in #'"));
  check('notification body only trails a code for non-global rooms', /!isDm && !isGlobalHere && codeHere\) body/.test(app));
  check('DM popup header carries the name only (no #id line)', !app.includes("meta.className = 'dm-pop-hex'"));
  check('message rows no longer mint #id footnotes', !app.includes("authorIdLabel.className = 'message-author-id'"));
  check('person rows show presence, not #ids', !app.includes("'#' + record.id + ' · online'"));
  check('identifier footnotes hidden by CSS', /\.peer-hex, \.uc-id, \.dm-pop-hex, \.message-author-id \{ display: none; \}/.test(app));
  check('friend banner drops the room code', !app.includes('wants to connect in #'));
  check('hostGlobalChat marks the persistent flag', /state\.enterGlobalChat = true;/.test(app));
  check('global hosting lands in the chat stage, not an invite', /Global is open — waiting for people/.test(app));
  check('stranded global host re-hosts quietly in chat', app.includes("Re-host #global quietly") || /normalizeRoomId\(state\.roomId\) === GLOBAL_ROOM_ID\) \{[\s\S]*?setMode\('offer'\);/.test(app));
  check('park clears the persistent flag', /function parkCurrentRoom\(\) \{[\s\S]*?state\.enterGlobalChat = false;/.test(app));
}

console.log(`\n${'='.repeat(52)}\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
