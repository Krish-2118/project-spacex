/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node (CommonJS) script */
const fs = require('fs');

// 1. Fix images in all views
['src/components/innovision/HomeView.tsx', 'src/components/innovision/DetailView.tsx', 'src/components/innovision/ScheduleView.tsx', 'src/components/innovision/AdminDashboard.tsx', 'src/components/innovision/AuthOverlay.tsx'].forEach(f => {
  try {
    let d = fs.readFileSync(f, 'utf8');
    d = d.replace(/<img (?!(?:[^>]*\b)decoding=)/g, '<img decoding="async" ');
    fs.writeFileSync(f, d);
    console.log('Fixed async images in ' + f);
  } catch {}
});

// 2. Fix data.ts
try {
  let data = fs.readFileSync('src/components/innovision/data.ts', 'utf8');
  data = data.replace(/'home-rocks\.webp',\s*/g, '');
  fs.writeFileSync('src/components/innovision/data.ts', data);
  console.log('Fixed data.ts');
} catch {}

// 3. Fix Innovision.tsx (howler & lazy)
try {
  let inn = fs.readFileSync('src/components/innovision/Innovision.tsx', 'utf8');
  inn = inn.replace(/import type \{ Howl \} from 'howler';\n/, '');
  inn = inn.replace(/import\('howler'\)\.then\(\(hw\) => \{[\s\S]*?\}\);\n/g, '');
  inn = inn.replace(/this\.sfx = \{.*?\};\n/g, '');
  inn = inn.replace(/const song = .*?\n/g, '');
  inn = inn.replace(/this\.music = \{[\s\S]*?\};\n/g, '');
  inn = inn.replace(/Howler\.mute\(this\.state\.muted\);\n/g, '');
  inn = inn.replace(/if \(this\.wanted\) this\.playMusic\(this\.wanted, true\);\n/g, '');
  inn = inn.replace(/this\.play\('beep'\)/g, 'playClick()');
  inn = inn.replace(/this\.play\('thumpSoft'\)/g, 'playClick()');
  inn = inn.replace(/this\.play\('vanish'\)/g, 'playClick()');
  inn = inn.replace(/this\.play\('thump'\)/g, 'playClick()');
  inn = inn.replace(/this\.play\('fx'\)/g, 'playClick()');
  inn = inn.replace(/this\.play\('swoosh'\)/g, 'playClick()');
  inn = inn.replace(/this\.hw\?\.Howler\.mute\(this\.state\.muted \|\| document\.hidden\)/g, 'setClickMuted(this.state.muted || document.hidden)');
  if (!inn.includes('import { playClick, setClickMuted }')) {
    inn = inn.replace(/import gsap from 'gsap';/, "import { playClick, setClickMuted } from './clickSound';\nimport gsap from 'gsap';");
  }
  inn = inn.replace(/play\(n: string\) \{.*?\}/g, 'play(n: string) {}');
  inn = inn.replace(/playMusic\(key: MusicKey, force\?: boolean\) \{[\s\S]*?\}\n/g, 'playMusic(key: any, force?: boolean) {}\n');

  // Add lazy loading logic
  if (!inn.includes('import dynamic from \'next/dynamic\';')) {
    inn = inn.replace(/import gsap from 'gsap';/, "import dynamic from 'next/dynamic';\nimport gsap from 'gsap';");
  }

  const toRemove = ['DetailView', 'GalleryView', 'MerchView', 'ScheduleView', 'MenuOverlay', 'AuthOverlay', 'BagPanel'];
  for (const comp of toRemove) {
    const re = new RegExp(`import ${comp} from '\\./${comp}';\\r?\\n?`, 'g');
    inn = inn.replace(re, '');
  }

  inn = inn.replace(/<DetailV v={v} deps={\[s\.dIndex, s\.compact, s\.dbEvents\]} \/>/, '{s.lazy.detail && <DetailV v={v} deps={[s.dIndex, s.compact, s.dbEvents]} />}');
  inn = inn.replace(/<GalleryV v={v} deps={\[s\.gIdx, s\.dbGallery\]} \/>/, '{s.lazy.gallery && <GalleryV v={v} deps={[s.gIdx, s.dbGallery]} />}');
  inn = inn.replace(/<MerchV v={v} deps={\[s\.sel, s\.added\]} \/>/, '{s.lazy.merch && <MerchV v={v} deps={[s.sel, s.added]} />}');
  inn = inn.replace(/<ScheduleV v={v} deps={\[s\.schedDay, s\.schedFilter, s\.saved, s\.narrow\]} \/>/, '{s.lazy.schedule && <ScheduleV v={v} deps={[s.schedDay, s.schedFilter, s.saved, s.narrow]} />}');
  inn = inn.replace(/<MenuOverlay v={v} \/>/, '{s.lazy.menu && <MenuOverlay v={v} />}');
  inn = inn.replace(/<AuthOverlay v={v} \/>/, '{s.lazy.auth && <AuthOverlay v={v} />}');
  inn = inn.replace(/<BagPanel v={v} \/>/, '{s.lazy.bag && <BagPanel v={v} />}');

  inn = inn.replace(/register: this.register, hover: this.hover, beep: this.beep,/, 'register: this.register, hover: this.hover, beep: this.beep, prefetchAuth: () => {},');
  fs.writeFileSync('src/components/innovision/Innovision.tsx', inn);
  console.log('Fixed Innovision.tsx');
} catch {
  console.error(e);
}
