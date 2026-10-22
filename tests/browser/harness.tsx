import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EntryPassCard from '../../src/components/innovision/EntryPassCard';
import { useDialogFocus } from '../../src/components/innovision/useDialogFocus';

function Harness() {
  const preview = new URLSearchParams(location.search).get('preview');
  const mobile = new URLSearchParams(location.search).has('mobile');
  const [open, setOpen] = useState(!!preview);
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialog, () => setOpen(false));
  return <div style={{ maxWidth: mobile ? 350 : 960, margin: '0 auto' }}>{preview && <p style={{ fontSize: 12, color: '#c9a24a', lineHeight: 1.6 }}>LOCAL DESIGN PREVIEW · Sample data only. Not a valid pass.</p>}<button onClick={() => setOpen(true)}>My pass</button>{open && <div ref={dialog} role="dialog" aria-label="Registration" tabIndex={-1}>
    <button onClick={() => setOpen(false)}>Continue to INNO</button><EntryPassCard />
  </div>}</div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness /></React.StrictMode>);
