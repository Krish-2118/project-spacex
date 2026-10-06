/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node (CommonJS) script */
const fs = require('fs');
let inn = fs.readFileSync('src/components/innovision/Innovision.tsx', 'utf8');
inn = inn.replace(/PRELOAD,/g, 'PRELOAD_DEFERRED,');

// Replace the howler block completely
const startStr = "import('howler').then((hw) => {";
const endStr = "this.hw = hw;";
const startIdx = inn.indexOf(startStr);
const endIdx = inn.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  inn = inn.substring(0, startIdx) + "(() => {" + inn.substring(endIdx + endStr.length);
  // Remove the trailing `.catch(() => { });` for the howler import
  inn = inn.replace(/\}\)\.catch\(\(\) => \{ \}\);\n\s*\}\)\.catch\(\(\) => \{ \}\);/g, '}).catch(() => { });');
}

fs.writeFileSync('src/components/innovision/Innovision.tsx', inn);
console.log('Fixed PRELOAD and Howler');
