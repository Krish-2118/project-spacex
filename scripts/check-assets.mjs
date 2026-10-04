// Fails when src/ references a file that is missing from public/assets.
//
// Recognised reference forms (comments are stripped first):
//   '/assets/x.webp', url(/assets/x.webp)   -- absolute paths
//   A + 'x.webp', `${A}x.webp`              -- the A = '/assets/' prefix from data.ts
//   'x.webp'                                -- bare filenames in arrays/maps (gates, PILLS,
//                                              PRELOAD, SCHED_DAYS, ORBS, Howl sources) that
//                                              become paths later via A + f or "/assets/" + f
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const root = join(import.meta.dirname, '..');
const srcDir = join(root, 'src');
const assetsDir = join(root, 'public', 'assets');

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css']);
const ASSET_EXT = 'webp|png|jpe?g|gif|svg|avif|ico|mp3|mp4|webm|ogg|wav|woff2?|ttf|otf|json|glb|gltf';

const PATTERNS = [
  new RegExp(`/assets/([^'"\`)\\s$]+)`, 'g'),
  /\bA\s*\+\s*(['"`])([^'"`$]+)\1/g,
  /\$\{A\}([^`$]+)/g,
  new RegExp(`(['"\`])([\\w.-]+\\.(?:${ASSET_EXT}))\\1`, 'gi'),
];

// Removes block comments (keeping their newlines so line numbers stay right) and // line
// comments, leaving URLs like https://... intact.
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');

const files = readdirSync(srcDir, { recursive: true })
  .map((f) => join(srcDir, f))
  .filter((f) => SOURCE_EXT.has(extname(f)));

const refs = new Map(); // asset path -> Set of "file:line"
for (const file of files) {
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const re of PATTERNS) {
      for (const m of line.matchAll(re)) {
        const name = m[m.length - 1];
        if (!name || name.endsWith('/')) continue;
        if (!refs.has(name)) refs.set(name, new Set());
        refs.get(name).add(`${relative(root, file)}:${i + 1}`);
      }
    }
  });
}

const missing = [...refs].filter(([name]) => !existsSync(join(assetsDir, name)));
const onDisk = readdirSync(assetsDir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(assetsDir, join(d.parentPath, d.name)).replaceAll('\\', '/'));
const unused = onDisk.filter((f) => !refs.has(f));

console.log(`check-assets: ${refs.size} referenced, ${onDisk.length} in public/assets, ${files.length} source files scanned.`);
if (unused.length) console.log(`note: ${unused.length} file(s) in public/assets not referenced: ${unused.join(', ')}`);

if (missing.length) {
  console.error(`\n✗ ${missing.length} referenced asset(s) missing from public/assets:`);
  for (const [name, where] of missing) console.error(`  ${name}  <- ${[...where].join(', ')}`);
  process.exit(1);
}
console.log('✓ all referenced assets exist.');
