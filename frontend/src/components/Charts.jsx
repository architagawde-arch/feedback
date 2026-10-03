import { useMemo } from 'react';
const PALETTE = ['#2f8de6', '#1fb5a3', '#8a8ef0', '#f6b26b', '#2ec4c8', '#8ad0f0', '#7ed38a'];

const niceMax = (v) => { const steps = [5, 10, 20, 40, 50, 80, 100, 200, 400, 1000]; return steps.find((s) => s >= v) || Math.ceil(v / 100) * 100; };

export function BarChart({ data, max, colors = PALETTE, height = 210, decimals = false }) {
  const top = useMemo(() => max || niceMax(Math.max(1, ...data.map((d) => d.value))), [data, max]);
  const ticks = max ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const W = 560, L = 36, B = 40, T = 22, H = height, bw = (W - L) / data.length;
  const y = (v) => H - B - ((H - B - T) * v) / top;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Bar chart">
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#e8edf5" /><text x={L - 8} y={y(t) + 4} textAnchor="end" className="tick">{Math.round(t * 10) / 10}</text></g>))}
      {data.map((d, i) => {
        const w = Math.min(56, bw * 0.55), x = L + bw * i + (bw - w) / 2;
        return (<g key={d.label}>
          <rect x={x} y={y(d.value)} width={w} height={Math.max(0, H - B - y(d.value))} rx="3" fill={colors[i % colors.length]} />
          {decimals && <text x={x + w / 2} y={y(d.value) - 6} textAnchor="middle" className="val">{d.value}</text>}
          <text x={L + bw * i + bw / 2} y={H - B + 16} textAnchor="middle" className="tick">{d.label.length > 18 ? d.label.slice(0, 16) + '…' : d.label}</text>
        </g>);
      })}
    </svg>
  );
}

export function LineChart({ data, height = 210 }) {
  const top = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const W = 560, L = 36, B = 30, T = 14, H = height, step = (W - L - 16) / (data.length - 1 || 1);
  const x = (i) => L + step * i, y = (v) => H - B - ((H - B - T) * v) / top;
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Line chart">
      <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1fb5a3" stopOpacity=".28" /><stop offset="1" stopColor="#1fb5a3" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((i) => (<g key={i}><line x1={L} x2={W} y1={y((top / 4) * i)} y2={y((top / 4) * i)} stroke="#e8edf5" /><text x={L - 8} y={y((top / 4) * i) + 4} textAnchor="end" className="tick">{Math.round((top / 4) * i)}</text></g>))}
      <polygon points={`${x(0)},${H - B} ${pts} ${x(data.length - 1)},${H - B}`} fill="url(#lg)" />
      <polyline points={pts} fill="none" stroke="#1fb5a3" strokeWidth="2.5" />
      {data.map((d, i) => (<g key={d.label + i}><circle cx={x(i)} cy={y(d.value)} r="4" fill="#fff" stroke="#1fb5a3" strokeWidth="2.5" /><text x={x(i)} y={H - 8} textAnchor="middle" className="tick">{d.label}</text></g>))}
    </svg>
  );
}

export function Donut({ data, total, label, size = 190, colors = PALETTE }) {
  const sum = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Donut chart">
        <g transform="rotate(-90 100 100)">
          {data.map((d, i) => { const len = (d.value / sum) * C, el = <circle key={d.name} cx="100" cy="100" r={R} fill="none" stroke={colors[i % colors.length]} strokeWidth="28" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />; acc += len; return el; })}
        </g>
        <text x="100" y="102" textAnchor="middle" className="donut-n">{total ?? sum}</text>
        <text x="100" y="122" textAnchor="middle" className="tick">{label}</text>
      </svg>
      <ul className="legend">{data.map((d, i) => <li key={d.name}><i style={{ background: colors[i % colors.length] }} />{d.name}<b>{Math.round((d.value / sum) * 100)}%</b></li>)}</ul>
    </div>
  );
}

export function Ring({ percent, label }) {
  const R = 64, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label={`${percent}% completed`}>
      <circle cx="80" cy="80" r={R} fill="none" stroke="#d9e3f2" strokeWidth="16" />
      <circle cx="80" cy="80" r={R} fill="none" stroke="#17a888" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(percent / 100) * C} ${C}`} transform="rotate(-90 80 80)" />
      <text x="80" y="82" textAnchor="middle" className="ring-n">{percent}%</text>
      <text x="80" y="102" textAnchor="middle" className="tick">{label}</text>
    </svg>
  );
}
