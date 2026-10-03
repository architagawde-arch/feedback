import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { api } from '../../api.js';
import { Card, Loader, ErrorBox, useFetch } from '../../components/UI.jsx';

const Stars = ({ value, onChange, disabled }) => (
  <div className="stars">{[1, 2, 3, 4, 5].map((n) => (
    <button type="button" key={n} disabled={disabled} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
      <Star size={30} fill={n <= (value || 0) ? '#f5a21f' : 'none'} color={n <= (value || 0) ? '#f5a21f' : '#9db0cc'} />
    </button>))}
  </div>
);

export default function FillForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(`/student/assignments/${id}`);
  const [ans, setAns] = useState({});
  const [msg, setMsg] = useState('');
  const [missing, setMissing] = useState([]);
  const [busy, setBusy] = useState(false);
  const firstMissing = useRef(null);

  useEffect(() => {
    if (data?.answers?.length) setAns(Object.fromEntries(data.answers.map((a) => [a.question_id, a])));
  }, [data]);
  useEffect(() => { firstMissing.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [missing]);

  const setAnswer = useCallback((qid, patch) => {
    setAns((a) => ({ ...a, [qid]: { ...a[qid], question_id: qid, ...patch } }));
    setMissing((m) => m.filter((x) => x !== qid));
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} />;
  const readOnly = data.status === 'Completed' || data.closed;
  const { form } = data;

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setBusy(true);
    try {
      await api(`/student/assignments/${id}/submit`, { method: 'POST', body: { answers: Object.values(ans) } });
      navigate('/student');
    } catch (x) { setMsg(x.message); setMissing(x.missing || []); } finally { setBusy(false); }
  };
  let flagged = false;
  return (
    <form onSubmit={submit} className="stack narrow">
      <h2 className="page-title">{form.title}</h2>
      <p className="muted">{form.description} {form.is_anonymous && <b>Your responses are anonymous.</b>}</p>
      {data.status === 'Completed' && <div className="alert ok">You submitted this form. Here is your response.</div>}
      {data.status !== 'Completed' && data.closed && <div className="alert error">This form is closed.</div>}
      {msg && <div className="alert error">{msg}</div>}
      {form.questions.map((q, i) => {
        const a = ans[q.question_id] || {};
        const bad = missing.includes(q.question_id);
        const ref = bad && !flagged ? ((flagged = true), firstMissing) : null;
        return (
          <Card key={q.question_id} className={bad ? 'invalid' : ''}>
            <div ref={ref}><p className="q"><b>{i + 1}.</b> {q.question_text} {q.is_required && <em>*</em>}</p>
              {q.question_type === 'Rating' && <Stars value={a.rating_value} disabled={readOnly} onChange={(n) => setAnswer(q.question_id, { rating_value: n })} />}
              {q.question_type === 'Text' && <textarea rows="3" disabled={readOnly} value={a.answer_text || ''} onChange={(e) => setAnswer(q.question_id, { answer_text: e.target.value })} placeholder="Type your answer…" />}
              {q.question_type === 'Yes/No' && <div className="choices">{['Yes', 'No'].map((v) => <label key={v}><input type="radio" disabled={readOnly} checked={a.answer_text === v} onChange={() => setAnswer(q.question_id, { answer_text: v })} />{v}</label>)}</div>}
              {q.question_type === 'Multiple Choice' && <div className="choices">{q.options.map((o) => <label key={o.option_id}><input type="radio" disabled={readOnly} checked={a.option_id === o.option_id} onChange={() => setAnswer(q.question_id, { option_id: o.option_id })} />{o.option_text}</label>)}</div>}
            </div>
          </Card>
        );
      })}
      <div className="row"><button type="button" className="btn" onClick={() => navigate(-1)}>Back</button>{!readOnly && <button className="btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit feedback'}</button>}</div>
    </form>
  );
}
