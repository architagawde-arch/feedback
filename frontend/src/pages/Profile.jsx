import { useState } from 'react';
import { api, fmtDate } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, Loader, useFetch } from '../components/UI.jsx';

export default function Profile() {
  const { update } = useAuth();
  const { data, loading, reload } = useFetch('/auth/me');
  const [f, setF] = useState({ full_name: '', current_password: '', new_password: '' });
  const [msg, setMsg] = useState(null);
  if (loading) return <Loader />;
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { full_name: f.full_name || data.full_name, ...(f.new_password && { current_password: f.current_password, new_password: f.new_password }) };
      const r = await api('/auth/me', { method: 'PUT', body });
      update({ full_name: r.full_name }); localStorage.setItem('cfms_user', JSON.stringify({ ...JSON.parse(localStorage.getItem('cfms_user')), full_name: r.full_name }));
      setMsg({ ok: true, t: 'Profile saved.' }); setF({ full_name: '', current_password: '', new_password: '' }); reload();
    } catch (x) { setMsg({ ok: false, t: x.message }); }
  };
  return (
    <>
      <h2 className="page-title">My Profile</h2>
      <div className="grid-2">
        <Card title="Account details">
          <dl className="kv"><dt>Name</dt><dd>{data.full_name}</dd><dt>Email</dt><dd>{data.email}</dd><dt>Role</dt><dd>{data.roles.join(', ')}</dd>
            {data.program && <><dt>Programme</dt><dd>{data.program}</dd></>}<dt>Member since</dt><dd>{fmtDate(data.created_at)}</dd></dl>
        </Card>
        <Card title="Edit profile">
          <form className="stack" onSubmit={save}>
            {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.t}</div>}
            <label>Full name<input defaultValue={data.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
            <label>Current password<input type="password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></label>
            <label>New password<input type="password" minLength={6} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></label>
            <button className="btn primary">Save changes</button>
          </form>
        </Card>
      </div>
    </>
  );
}
