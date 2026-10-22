/* eslint-disable @typescript-eslint/no-require-imports -- webpack loaders use the CommonJS loader API */
const ts = require('typescript');
module.exports = function(source) {
  if (this.resourcePath.endsWith('.css')) {
    const names = [...source.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1]);
    return `const s=document.createElement('style');s.textContent=${JSON.stringify(source)};document.head.append(s);export default ${JSON.stringify(Object.fromEntries(names.map(n => [n,n])))};`;
  }
  return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
};
