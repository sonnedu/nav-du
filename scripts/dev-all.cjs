const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const pagesPort = process.env.NAV_PAGES_PORT || '8799';
const faviconPort = process.env.NAV_FAVICON_PORT || '8787';
const vitePort = process.env.NAV_VITE_PORT || '5173';

const pagesOrigin = `http://127.0.0.1:${pagesPort}`;

const build = spawnSync(npm, ['run', 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

const children = [];
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 2000);
}

function start(cmd, args, extraEnv) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...(extraEnv || {}) },
  });

  children.push(child);

  child.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0) {
      process.exitCode = code;
      shutdown();
    }
  });

  return child;
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, init) {
  const resp = await fetch(url, init);
  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    void e;
  }
  return { resp, json, text };
}

function readBaseConfigJson() {
  const yamlPath = path.join(process.cwd(), 'src', 'data', 'nav.yaml');
  const yamlText = fs.readFileSync(yamlPath, 'utf8');
  const { load } = require('js-yaml');
  const parsed = load(yamlText);
  return JSON.stringify(parsed);
}

function parseSessionCookie(headerValue) {
  if (!headerValue) return '';
  const m = headerValue.match(/\bnav_admin=[^;]+/);
  return (m ? m[0] : '').trim();
}

async function seedKvIfEmpty() {
  const url = `${pagesOrigin}/api/config`;

  for (let i = 0; i < 50; i += 1) {
    try {
      const probe = await fetch(url, { method: 'GET' });
      void probe;
      break;
    } catch (e) {
      void e;
    }
    await sleep(200);
  }

  const { resp, json } = await fetchJson(url, { method: 'GET' });
  if (resp.ok) return;

  const err = json && typeof json === 'object' ? json.error : null;
  if (err !== 'not found') return;

  const username = (process.env.ADMIN_USERNAME || '').trim() || 'admin';
  const password = (process.env.ADMIN_PASSWORD || '').trim() || 'admin2026';

  const login = await fetchJson(`${pagesOrigin}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!login.resp.ok) return;

  const cookiePair = parseSessionCookie(login.resp.headers.get('set-cookie'));
  if (!cookiePair) return;

  const body = readBaseConfigJson();

  await fetch(`${pagesOrigin}/api/config`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: cookiePair,
    },
    body,
  });
}

function readGit(args) {
  try {
    const out = spawnSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout.toString().trim();
    return out;
  } catch (e) {
    void e;
    return '';
  }
}

function readGitCommit() {
  return readGit(['rev-parse', '--short', 'HEAD']);
}

function readGitVersion() {
  return readGit(['describe', '--tags', '--always', '--dirty']);
}

const appVersion = process.env.APP_VERSION || readGitVersion() || process.env.npm_package_version || '0.0.0';
const appCommit = process.env.APP_COMMIT || readGitCommit();
const buildTime = process.env.BUILD_TIME || new Date().toISOString();

start(npx, [
  'wrangler',
  'pages',
  'dev',
  'dist',
  '--ip',
  '127.0.0.1',
  '--port',
  pagesPort,
  '--kv',
  'NAV_CONFIG_KV',
  '--persist-to',
  '.wrangler/state',
  '--log-level',
  'warn',
  '-b',
  'ALLOW_DEV_DEFAULT_ADMIN=1',
  '-b',
  `APP_VERSION=${appVersion}`,
  '-b',
  `APP_COMMIT=${appCommit}`,
  '-b',
  `BUILD_TIME=${buildTime}`,
]);

seedKvIfEmpty()
  .catch((e) => {
    void e;
  })
  .finally(() => {
    start(npm, ['run', 'worker:favicon:dev', '--', '--ip', '127.0.0.1', '--port', faviconPort]);
    start(
      npm,
      ['run', 'dev', '--', '--host', '--port', vitePort],
      { VITE_FAVICON_PROXY_BASE: `http://127.0.0.1:${faviconPort}/ico`, NAV_PAGES_PORT: pagesPort },
    );
  });
