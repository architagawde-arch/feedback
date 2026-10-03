import { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtDate } from '../../api.js';
import { Badge, Card, Loader, ErrorBox, Table, useFetch } from '../../components/UI.jsx';

// Lists forms with server-side filters (status / target / search) and publish-close-delete actions
export default function ManageForms({ base }) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const path = useMemo(() => { const p = new URLSearchParams(); if (status) p.set('status', status); if (target) p.set('target_type', target); if (q) p.set('q', q); return `/forms?${p}`; }, [status, target, q]);
  const { data, loading, error, reload } = useFetch(path);
  const [msg, setMsg] = useState('');

  const act = useCallback(async (fn) => { try { await fn(); reload(); } catch (e) { setMsg(e.message); } }, [reload]);
  const setSt = (id, st) => act(() => api(`/forms/${id}/status`, { method: 'PATCH', body: { status: st } }));
  const del = (id) => window.confirm('Delete this form and all its responses?') && act(() => api(`/forms/${id}`, { method: 'DELETE' }));
  const assign = (id) => act(async () => { const r = await api(`/forms/${id}/assign`, { method: 'POST', body: { all_students: true } }); setMsg(r.message); });

  const cols = [
    { title: '#', render: (_, i) => i + 1 }, { title: 'Form Title', render: (r) => r.title }, { title: 'Category', render: (r) => r.category },
    { title: 'Created On', render: (r) => fmtDate(r.start_at) }, { title: 'Status', render: (r) => <Badge status={r.status} /> }, { title: 'Responses', render: (r) => r.responses },
    { title: 'Action', render: (r) => (
      <div className="row tight wrap">
        <Link className="btn small" to={`${base}/responses?form=${r.form_id}`}>View</Link>
        <Link className="btn small" to={`${base}/forms/${r.form_id}/edit`}>Edit</Link>
        {r.status === 'Draft' && <button className="btn small solid" onClick={() => setSt(r.form_id, 'Published')}>Publish</button>}
        {r.status === 'Published' && <><button className="btn small" onClick={() => assign(r.form_id)}>Assign all</button><button className="btn small" onClick={() => setSt(r.form_id, 'Closed')}>Close</button></>}
        <button className="btn small danger" onClick={() => del(r.form_id)}>Delete</button>
      </div>) },
  ];
  return (
    <>
      <div className="row between"><h2 className="page-title">{base === '/admin' ? 'Feedback Forms' : 'My Feedback Forms'}</h2><Link className="btn primary" to={`${base}/create`}>+ Create form</Link></div>
      <Card>
        <div className="filters">
          <input placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Draft</option><option>Published</option><option>Closed</option></select>
          <select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">All categories</option><option>Course</option><option>Instructor</option><option>Department</option><option>College</option></select>
        </div>
        {msg && <div className="alert ok">{msg}</div>}
        {loading ? <Loader /> : error ? <ErrorBox message={error} /> : <Table columns={cols} rows={data.forms.map((f) => ({ ...f, key: f.form_id }))} empty="No forms match these filters." />}
      </Card>
    </>
  );
}
