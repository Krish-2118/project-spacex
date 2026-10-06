/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node (CommonJS) script */
const fs = require('fs');
const logPath = "C:\\Users\\agarw\\.gemini\\antigravity-ide\\brain\\8b3300c2-2db2-4906-88d6-43afe8db0094\\.system_generated\\logs\\transcript_full.jsonl";

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);

for (const line of lines) {
  try {
    const parsed = JSON.parse(line);
    if (parsed.type === 'PLANNER_RESPONSE' && parsed.tool_calls) {
      for (const call of parsed.tool_calls) {
        if (call.name === 'write_to_file') {
          if (call.args.TargetFile && (call.args.TargetFile.includes('fix_local.js') || call.args.TargetFile.includes('fix2.js'))) {
            fs.writeFileSync(call.args.TargetFile, call.args.CodeContent);
            console.log(`Recovered ${call.args.TargetFile}`);
          }
        }
      }
    }
  } catch {}
}
