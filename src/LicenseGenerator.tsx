import React, { useState } from 'react';
import { withBase } from './utils/base';

const FEATURE_CODES = [
  { code: 'ck', label: 'Agentic checkout' },
  { code: 'an', label: 'Advanced analytics' },
  { code: 'xf', label: 'Full feed' },
  { code: 'au', label: 'Auto-updates' },
  { code: 'wc', label: 'Unlimited agents' },
  { code: 'li', label: 'Custom llms.txt' },
  { code: 'fc', label: 'Feed controls' },
];

export function LicenseGenerator({ onBack }: { onBack: () => void }) {
  const [plan, setPlan] = useState('pro');
  const [expires, setExpires] = useState('');
  const [all, setAll] = useState(true);
  const [feats, setFeats] = useState<Record<string, boolean>>({});
  const [count, setCount] = useState(1);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const featureStr = all ? '*' : (Object.entries(feats).filter(([, v]) => v).map(([k]) => k).join(',') || '*');

  const generate = async () => {
    setBusy(true); setErr(''); setKeys([]);
    try {
      const params = new URLSearchParams({ plan, features: featureStr, expires: expires || 'never', count: String(count) });
      if (token) params.set('token', token);
      const res = await fetch(withBase(`/api/license/generate?${params}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setKeys(data.keys.map((k: any) => k.key));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const copyAll = () => { navigator.clipboard?.writeText(keys.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const downloadCsv = () => {
    const csv = 'plan,features,expires,key\n' + keys.map(k => `${plan},${featureStr},${expires || 'never'},${k}`).join('\n');
    const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = u; a.download = 'agent-ready-licenses.csv'; a.click(); URL.revokeObjectURL(u);
  };

  const input = 'field field-sm';
  const lbl = 'label block mb-2';

  return (
    <div className="view max-w-[820px]">
      <button type="button" onClick={onBack} className="link mt-8">← Back</button>

      <p className="label label-clay mt-10 mb-4">Internal · vendor tool</p>
      <h1 className="display display-lg mb-4">License generator</h1>
      <p className="body mb-8">Keys are Ed25519-signed by the server — the plugin verifies them with the public key.</p>

      <div className="panel p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} className={input}><option value="pro">pro</option><option value="agency">agency</option></select></div>
          <div><label className={lbl}>Expires</label>
            <input type="date" value={expires} onChange={e => setExpires(e.target.value)} className={input} /></div>
          <div><label className={lbl}>Quantity</label>
            <input type="number" min={1} max={100} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className={input} /></div>
        </div>

        <div>
          <label className="flex items-center gap-2 small mb-2" style={{ color: 'var(--ink)' }}><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> All features (<code className="code">*</code>)</label>
          {!all && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-1">
              {FEATURE_CODES.map(f => (
                <label key={f.code} className="flex items-center gap-2 small"><input type="checkbox" checked={!!feats[f.code]} onChange={e => setFeats({ ...feats, [f.code]: e.target.checked })} /> <code className="code">{f.code}</code> {f.label}</label>
              ))}
            </div>
          )}
        </div>

        <div><label className={lbl}>Admin token <span className="label-dim">(required in production)</span></label>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} className={input} placeholder="ARS_ADMIN_TOKEN" /></div>

        <button type="button" onClick={generate} disabled={busy} className="btn btn-primary">
          {busy ? 'Generating…' : <>Generate {count > 1 ? `${count} keys` : 'key'}</>}
        </button>
        {err && <p role="alert" className="small m-0" style={{ color: 'var(--fail)' }}>{err}</p>}
      </div>

      {keys.length > 0 && (
        <div className="panel p-6 mt-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="label" style={{ color: 'var(--ink)' }}>{keys.length} key{keys.length > 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button type="button" onClick={copyAll} className="btn btn-sm">{copied ? 'Copied' : 'Copy all'}</button>
              <button type="button" onClick={downloadCsv} className="btn btn-sm">↓ CSV</button>
            </div>
          </div>
          <div className="codeblock space-y-1 max-h-72 overflow-y-auto">
            {keys.map((k, i) => <div key={i} className="break-all" style={{ color: 'var(--ink)' }}>{k}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
