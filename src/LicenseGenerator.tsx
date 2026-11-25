import React, { useState } from 'react';
import { KeyRound, Copy, Check, Download, Loader2, ArrowLeft } from 'lucide-react';

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
      const res = await fetch(`/api/license/generate?${params}`);
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

  const input = 'w-full glass-flat px-3 py-2 text-[14px] text-white focus:outline-none focus:border-[var(--violet)]';

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="text-sm text-[var(--muted)] hover:text-white flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0 mb-6"><ArrowLeft size={16} /> Back</button>

      <div className="flex items-center gap-2 mb-1"><KeyRound size={20} className="text-[var(--violet)]" /><h1 className="font-display text-2xl font-bold m-0">License generator</h1></div>
      <p className="text-[var(--muted)] mb-6">Vendor tool. Keys are Ed25519-signed by the server — the plugin verifies them with the public key.</p>

      <div className="glass p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="block text-[13px] font-medium text-white mb-1">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} className={input}><option value="pro">pro</option><option value="agency">agency</option></select></div>
          <div><label className="block text-[13px] font-medium text-white mb-1">Expires</label>
            <input type="date" value={expires} onChange={e => setExpires(e.target.value)} className={input} /></div>
          <div><label className="block text-[13px] font-medium text-white mb-1">Quantity</label>
            <input type="number" min={1} max={100} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className={input} /></div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-[14px] mb-2 text-[var(--text)]"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> All features (<code>*</code>)</label>
          {!all && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-1">
              {FEATURE_CODES.map(f => (
                <label key={f.code} className="flex items-center gap-2 text-[13px] text-[var(--muted)]"><input type="checkbox" checked={!!feats[f.code]} onChange={e => setFeats({ ...feats, [f.code]: e.target.checked })} /> <code className="text-white">{f.code}</code> {f.label}</label>
              ))}
            </div>
          )}
        </div>

        <div><label className="block text-[13px] font-medium text-white mb-1">Admin token <span className="text-[var(--faint)] font-normal">(required in production)</span></label>
          <input type="password" value={token} onChange={e => setToken(e.target.value)} className={input} placeholder="ARS_ADMIN_TOKEN" /></div>

        <button onClick={generate} disabled={busy} className="btn-grad px-5 py-2.5 flex items-center gap-2">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <>Generate {count > 1 ? `${count} keys` : 'key'}</>}
        </button>
        {err && <p className="text-[var(--rose)] text-sm m-0">{err}</p>}
      </div>

      {keys.length > 0 && (
        <div className="glass p-6 mt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-semibold text-white">{keys.length} key{keys.length > 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button onClick={copyAll} className="text-xs btn-ghost px-3 py-1.5 flex items-center gap-1">{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy all</>}</button>
              <button onClick={downloadCsv} className="text-xs btn-ghost px-3 py-1.5 flex items-center gap-1"><Download size={13} /> CSV</button>
            </div>
          </div>
          <div className="glass-flat p-3 space-y-1 max-h-72 overflow-y-auto">
            {keys.map((k, i) => <div key={i} className="font-mono text-[11px] break-all" style={{ color: 'var(--cyan)' }}>{k}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
