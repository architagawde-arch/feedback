import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../api.js';
import { Card, ErrorBox, Loader, useFetch } from '../../components/UI.jsx';

const toLocal = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const blankQ = () => ({ question_text: '', question_type: 'Rating', is_required: true, options: [{ option_text: '' }, { option_text: '' }] });

export default function CreateForm({ base }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const edit = Boolean(id);
  const { data: terms } = useFetch('/forms/terms');
  const { data: offerings } = useFetch('/forms/offerings');
  const existing = useFetch(edit ? `/forms/${id}` : null);
  const [f, setF] = useState({ title: '', description: '', form_type: 'Student', target_type: 'Course', term_id: '', is_anonymous: true, status: 'Draft', start_at: toLocal(new Date()), end_at: toLocal(Date.now() + 14 * 864e5) });
  const [qs, setQs] = useState([blankQ()]);
  const [picked, setPicked] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (existing.data) { const d = existing.data; setF({ title: d.title, description: d.description || '', form_type: d.form_type, target_type: d.target_type, term_id: d.term_id || '', is_anonymous: d.is_anonymous, status: d.status, start_at: toLocal(d.start_at), end_at: toLocal(d.end_at) }); } }, [existing.data]);
  if (edit && existing.loading) return <Loader />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setQ = (i, patch) => setQs(qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));

  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const body = { ...f, term_id: f.term_id || null, start_at: new Date(f.start_at).toISOString(), end_at: new Date(f.end_at).toISOString() };
      if (edit) await api(`/forms/${id}`, { method: 'PUT', body });
      else {
        const created = await api('/forms', { method: 'POST', body: { ...body, questions: qs } });
        if (picked.length) await api(`/forms/${created.form_id}/assign`, { method: 'POST', body: { offering_ids: picked } });
      }
      navigate(`${base}/forms`);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="stack narrow" onSubmit={save}>
      <h2 className="page-title">{edit ? 'Edit form' : 'Create feedback form'}</h2>
      {err && <ErrorBox message={err} />}
      <Card title="Form details">
        <div className="form-grid">
          <label className="span2">Title<input required value={f.title} onChange={set('title')} /></label>
          <label className="span2">Description<textarea rows="2" value={f.description} onChange={set('description')} /></label>
          <label>Respondents<select value={f.form_type} onChange={set('form_type')}><option>Student</option><option>Faculty</option><option>All</option></select></label>
          <label>What is evaluated<select value={f.target_type} onChange={set('target_type')}><option>Course</option><option>Instructor</option><option>Department</option><option>College</option></select></label>
          <label>Term<select value={f.term_id} onChange={set('term_id')}><option value="">None</option>{terms?.map((t) => <option key={t.term_id} value={t.term_id}>{t.term_name}</option>)}</select></label>
          <label>Status<select value={f.status} onChange={set('status')}><option>Draft</option><option>Published</option><option>Closed</option></select></label>
          <label>Opens<input type="datetime-local" required value={f.start_at} onChange={set('start_at')} /></label>
          <label>Closes<input type="datetime-local" required value={f.end_at} onChange={set('end_at')} /></label>
          <label className="check span2"><input type="checkbox" checked={f.is_anonymous} onChange={set('is_anonymous')} /> Keep responses anonymous</label>
        </div>
      </Card>
      {!edit && (<>
        <Card title="Questions">
          {qs.map((q, i) => (
            <div className="qbuilder" key={i}>
              <input required placeholder={`Question ${i + 1}`} value={q.question_text} onChange={(e) => setQ(i, { question_text: e.target.value })} />
              <select value={q.question_type} onChange={(e) => setQ(i, { question_type: e.target.value })}><option>Rating</option><option>Text</option><option>Yes/No</option><option>Multiple Choice</option></select>
              <label className="check"><input type="checkbox" checked={q.is_required} onChange={(e) => setQ(i, { is_required: e.target.checked })} /> Required</label>
              <button type="button" className="icon-btn" aria-label="Remove question" onClick={() => setQs(qs.filter((_, k) => k !== i))} disabled={qs.length === 1}><Trash2 size={18} /></button>
              {q.question_type === 'Multiple Choice' && (
                <div className="opts">{q.options.map((o, k) => <input key={k} placeholder={`Option ${k + 1}`} value={o.option_text} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? { option_text: e.target.value } : x)) })} />)}
                  <button type="button" className="btn small" onClick={() => setQ(i, { options: [...q.options, { option_text: '' }] })}>Add option</button></div>)}
            </div>))}
          <button type="button" className="btn" onClick={() => setQs([...qs, blankQ()])}><Plus size={16} /> Add question</button>
        </Card>
        <Card title="Assign to course offerings (optional)">
          <p className="muted">Every student enrolled in a selected offering receives this form. You can also use “Assign all” from the forms list.</p>
          <div className="choices col">{offerings?.map((o) => (
            <label key={o.offering_id}><input type="checkbox" checked={picked.includes(o.offering_id)} onChange={(e) => setPicked(e.target.checked ? [...picked, o.offering_id] : picked.filter((x) => x !== o.offering_id))} />{o.label} · {o.students} students</label>))}</div>
        </Card>
      </>)}
      {edit && <p className="muted">Questions are locked after creation so existing responses stay accurate.</p>}
      <div className="row"><button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Create form'}</button></div>
    </form>
  );
}
