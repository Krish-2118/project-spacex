/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS webpack test runner */
// Isolated component harness; no fixture routes or fake identities enter the Next.js app.
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, '.pass-test');
webpack({
  mode: 'development', devtool: false, entry: path.join(__dirname, 'harness.tsx'),
  plugins: [new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_SITE_URL': 'undefined', 'process.env.VERCEL_ENV': 'undefined' })],
  output: { path: output, filename: 'bundle.js', publicPath: '/' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@/lib/supabase$': path.join(__dirname, 'session.ts'), '@': path.join(root, 'src') } },
  module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: path.join(__dirname, 'loader.cjs') }] },
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString('errors-only')); process.exit(1); }
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:3191');
    const preview = new URL(req.headers.referer || 'http://127.0.0.1:3191').searchParams.get('preview');
    if (preview && req.method === 'POST' && url.pathname.startsWith('/api/pass')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/api/pass/experience') {
        let body = ''; req.on('data', data => { body += data; });
        req.on('end', () => res.end(JSON.stringify({ result: JSON.parse(body).action === 'claim' ? 'claimed' : true })));
      } else res.end(JSON.stringify({ pass: {
        registrationStatus: preview === 'pending' ? 'pending' : preview === 'rejected' ? 'rejected' : 'confirmed',
        passStatus: preview === 'pending' || preview === 'rejected' ? 'none' : 'active',
        registrationId: 'PREVIEW-ONLY', name: 'Sample Participant', college: 'Sample College', checkedIn: false, token: null,
      } }));
      return;
    }
    if (req.url === '/__shutdown' && req.method === 'POST') {
      res.end('closed', () => setImmediate(() => process.exit(0))); return;
    }
    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:DM;src:url('/font.ttf')} :root{--font-display:DM,serif;--font-sans:'Segoe UI',sans-serif}*{box-sizing:border-box}body{margin:0;padding:20px;background:#100f0e;color:#ece8df;font-family:var(--font-sans)}#root{max-width:960px;margin:auto}button{font:inherit}button:focus-visible{outline:2px solid #c9a24a;outline-offset:4px}[role=dialog]{padding:10px 0} [role=dialog]>button{margin-bottom:20px}</style></head><body><main id="root"></main><script src="/bundle.js"></script></body></html>`);
    }
    const name = (req.url || '').slice(1);
    const file = name === 'font.ttf' ? path.join(root, 'src/assets/fonts/DMSerifDisplay-Regular.ttf') : /^[\w.-]+\.js$/.test(name) ? path.join(output, name) : null;
    if (!file || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'font/ttf'); fs.createReadStream(file).pipe(res);
  }).listen(3191, '127.0.0.1', () => console.log('Pass harness listening on 3191'));
});
