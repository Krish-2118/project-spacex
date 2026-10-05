const fs = require('fs');

const files = [
  'src/components/innovision/AuthOverlay.tsx',
  'src/components/innovision/DetailView.tsx',
  'src/components/innovision/HomeView.tsx',
  'src/components/innovision/Innovision.tsx'
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  let newContent = content;
  
  // Use regex to keep HEAD version
  // Match <<<<<<< HEAD\n(head content)\n=======\n(remote content)\n>>>>>>> (commit)
  const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>> [a-f0-9]+\r?\n/g;
  
  newContent = newContent.replace(regex, (match, p1) => {
    return p1;
  });
  
  if (content !== newContent) {
    fs.writeFileSync(f, newContent);
    console.log(`Resolved conflicts in ${f}`);
  } else {
    console.log(`No conflicts matched in ${f}`);
  }
}
