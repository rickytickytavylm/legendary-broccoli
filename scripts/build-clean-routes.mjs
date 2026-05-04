import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const routes = new Map([
  ['index.html', '/'],
  ['about.html', '/about/'],
  ['account.html', '/account/'],
  ['ai.html', '/ai/'],
  ['antologiya.html', '/antologiya/'],
  ['auth-magic.html', '/auth-magic/'],
  ['author.html', '/author/'],
  ['course.html', '/course/'],
  ['courses.html', '/courses/'],
  ['dermer.html', '/dermer/'],
  ['feed.html', '/feed/'],
  ['geshtalt.html', '/geshtalt/'],
  ['gipnoz.html', '/gipnoz/'],
  ['marathons.html', '/marathons/'],
  ['master.html', '/master/'],
  ['mj.html', '/mj/'],
  ['profiling.html', '/profiling/'],
  ['psihosomatika.html', '/psihosomatika/'],
  ['shorts.html', '/shorts/'],
  ['sozavisimost.html', '/sozavisimost/'],
  ['subscription.html', '/subscription/'],
  ['superviziya.html', '/superviziya/'],
  ['terapiya.html', '/terapiya/'],
  ['week.html', '/week/'],
  ['yoga.html', '/yoga/'],
]);

const generatedDirs = [...routes.values()]
  .filter((route) => route !== '/')
  .map((route) => route.replace(/^\/|\/$/g, ''));

function cleanGeneratedRoutes() {
  for (const dir of generatedDirs) {
    rmSync(join(root, dir), { recursive: true, force: true });
  }
}

function rewriteInternalRoutes(content) {
  for (const [file, route] of routes) {
    content = content.split(file).join(route);
  }
  return content;
}

function rewriteRootRelativeAssets(content) {
  return content
    .replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/)(assets|css|js)\//g, '$1="/$2/')
    .replace(/href="(?!https?:|mailto:|tel:|#|\/)manifest\.json"/g, 'href="/manifest.json"')
    .replace(/url\((['"]?)(?!https?:|data:|\/)(assets\/)/g, 'url($1/$2');
}

function rewriteHtml(content) {
  return rewriteRootRelativeAssets(rewriteInternalRoutes(content));
}

function rewriteJs(content) {
  return rewriteInternalRoutes(content).replace(/(['"`])(assets\/)/g, '$1/$2');
}

cleanGeneratedRoutes();

const rootHtmlFiles = readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => routes.has(file));

for (const file of rootHtmlFiles) {
  const sourcePath = join(root, file);
  const rewritten = rewriteHtml(readFileSync(sourcePath, 'utf8'));
  writeFileSync(sourcePath, rewritten, 'utf8');

  const route = routes.get(file);
  if (route === '/') continue;

  const dir = route.replace(/^\/|\/$/g, '');
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'index.html'), rewritten, 'utf8');
}

for (const dir of ['js']) {
  for (const file of readdirSync(join(root, dir)).filter((name) => name.endsWith('.js'))) {
    const path = join(root, dir, file);
    writeFileSync(path, rewriteJs(readFileSync(path, 'utf8')), 'utf8');
  }
}

const manifestPath = join(root, 'manifest.json');
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.start_url = '/';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
} catch {
  // Keep the build non-fatal if the optional PWA manifest is absent or malformed.
}

console.log(`Built ${rootHtmlFiles.length - 1} clean routes.`);
