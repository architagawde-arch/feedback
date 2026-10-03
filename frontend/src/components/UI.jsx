import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// useEffect-based data hook: refetches when `path` changes
export function useFetch(path) {
  const [state, set] = useState({ data: null, loading: true, error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    set((s) => ({ ...s, loading: true, error: '' }));
    api(path).then((data) => live && set({ data, loading: false, error: '' })).catch((e) => live && set({ data: null, loading: false, error: e.message }));
    return () => { live = false; };
  }, [path, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Greeting({ title, emoji, subtitle, quote }) {
  const [now, setNow] = useState(new Date());
  const timer = useRef();
  useEffect(() => { timer.current = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer.current); }, []);
  const d = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return (
    <section className="greeting">
      <div className="greeting-text"><h2>{title} <span>{emoji}</span></h2><p>{subtitle}</p></div>
      <div className="greeting-date"><b>{d}</b><br />{t}</div>
      <div className="quote-card"><p>{quote}</p><svg viewBox="0 0 60 80" width="46"><path d="M30 76C30 46 32 30 46 6 15 15 9 46 28 60" fill="#1aa585" /></svg></div>
    </section>
  );
}
export const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; };

const TONES = { blue: ['#e6f0fd', '#2f73e0'], green: ['#e4f8f1', '#17a888'], purple: ['#eceefd', '#6b6fe0'], orange: ['#fff3e0', '#f5a21f'] };
export function StatCard({ icon: Icon, tone = 'blue', value, label, sub }) {
  const [bg, fg] = TONES[tone];
  return (
    <div className="stat" style={{ background: bg }}>
      <span className="stat-icon" style={{ background: fg }}><Icon size={30} color="#fff" /></span>
      <div><b>{value}</b><p>{label}</p>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

export const Card = ({ title, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && <header><h3>{title}</h3>{action}</header>}
    {children}
  </section>
);
export const Badge = ({ status }) => <span className={`badge ${String(status).toLowerCase()}`}>{status === 'Published' ? 'Active' : status}</span>;
export const Loader = () => <div className="loader">Loading…</div>;
export const ErrorBox = ({ message }) => <div className="alert error">{message}</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function Table({ columns, rows, empty = 'Nothing to show yet.' }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.title} className={c.className}>{c.title}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.key ?? i}>{columns.map((c) => <td key={c.title} className={c.className}>{c.render(r, i)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs">{tabs.map(([k, label]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>)}</div>;
}

export const CampusBanner = ({ quote, caption, small }) => (
  <div className={`banner ${small ? 'small' : ''}`}>
    <div className="banner-text"><p>{quote}</p>{!small && <span className="rule" />}{!small && <small>Share &nbsp;•&nbsp; Suggest &nbsp;•&nbsp; Improve</small>}</div>
    <div className="banner-tag">{caption || <>SPES's Goa Multi Faculty College<br />Dharbandora - Goa</>}</div>
  </div>
);
