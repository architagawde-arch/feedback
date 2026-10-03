import { useState } from 'react';
import { api, fmtDate } from '../../api.js';
import { Badge, Card, Loader, ErrorBox, Table, useFetch } from '../../components/UI.jsx';

export default function Users({ role }) {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useFetch(`/admin/users?role=${role}&q=${encodeURIComponent(q)}`);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ full_name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');

  const toggle = async (u) => { await api(`/admin/users/${u.user_id}/status`, { method: 'PATCH', body: { status: u.status === 'Active' ? 'Inactive' : 'Active' } }); reload(); };
  const add = async (e) => {
    e.preventDefault();
    try { await api('/admin/users', { method: 'POST', body: { ...f, role } }); setF({ full_name: '', email: '', password: '' }); setAdding(false); setMsg(''); reload(); } catch (x) { setMsg(x.message); }
  };
  const cols = [
    { title: 'ID', render: (r) => (role === 'Student' ? `STU${r.user_id}` : `FAC${r.user_id}`) }, { title: 'Name', render: (r) => r.full_name }, { title: 'Email', render: (r) => r.email },
    { title: 'Joined', render: (r) => fmtDate(r.created_at) }, { title: 'Status', render: (r) => <Badge status={r.status} /> },
    { title: 'Action', render: (r) => <button className="btn small" onClick={() => toggle(r)}>{r.status === 'Active' ? 'Deactivate' : 'Activate'}</button> },
  ];
  return (
    <>
      <div className="row between"><h2 className="page-title">{role === 'Student' ? 'Students' : 'Faculty'}</h2><button className="btn primary" onClick={() => setAdding(!adding)}>+ Add {role.toLowerCase()}</button></div>
      {adding && (
        <Card title={`New ${role.toLowerCase()}`}>
          <form className="filters" onSubmit={add}>
            <input required placeholder="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
            <input required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input type="password" placeholder="Password (default: password123)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button className="btn primary">Save</button>
          </form>
          {msg && <div className="alert error">{msg}</div>}
        </Card>)}
      <Card><div className="filters"><input placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {loading ? <Loader /> : error ? <ErrorBox message={error} /> : <Table columns={cols} rows={data.map((u) => ({ ...u, key: u.user_id }))} />}
      </Card>
    </>
  );
}
