import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDate } from '../../api.js';
import { Card, Empty, ErrorBox, Loader, useFetch } from '../../components/UI.jsx';
import { BarChart } from '../../components/Charts.jsx';

function FormPicker({ children }) {
  const [params, setParams] = useSearchParams();
  const { data: forms } = useFetch('/forms?limit=100');
  const sel = params.get('form') || (forms?.forms[0]?.form_id ? String(forms.forms[0].form_id) : '');
  return (
    <>
      <div className="row"><select className="select wide" value={sel} onChange={(e) => setParams({ form: e.target.value })}>
        {forms?.forms.map((f) => <option key={f.form_id} value={f.form_id}>{f.title} ({f.responses})</option>)}</select></div>
      {sel ? children(sel) : <Empty>Create a form to see responses here.</Empty>}
    </>
  );
}

function ResponseList({ id }) {
  const { data, loading, error } = useFetch(`/forms/${id}/responses`);
  const byId = useMemo(() => Object.fromEntries((data?.form.questions || []).map((q) => [q.question_id, q])), [data]);
  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} />;
  if (!data.responses.length) return <Empty>No responses submitted yet.</Empty>;
  return data.responses.map((r) => (
    <Card key={r.submission_id} title={r.respondent} action={<small className="muted">{fmtDate(r.submitted_at)}</small>}>
      <dl className="kv">{r.answers.map((a) => (<div key={a.question_id} className="kv-row"><dt>{byId[a.question_id]?.question_text}</dt><dd>{a.rating_value ? `${a.rating_value} / 5` : a.answer_text}</dd></div>))}</dl>
    </Card>
  ));
}

function QuestionStats({ id }) {
  const { data, loading, error } = useFetch(`/forms/${id}/analytics`);
  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} />;
  return data.map((q) => (
    <Card key={q.question_id} title={q.question_text} action={q.avg_rating ? <b>{q.avg_rating} ★ avg</b> : <small className="muted">{q.answered} answers</small>}>
      {q.question_type === 'Text' ? (q.comments.length ? <ul className="comments">{q.comments.map((c, i) => <li key={i}>{c}</li>)}</ul> : <Empty>No comments yet.</Empty>)
        : q.distribution.length ? <BarChart height={180} data={q.distribution.map((d) => ({ label: d.label, value: d.count }))} /> : <Empty>No answers yet.</Empty>}
    </Card>
  ));
}

export const Responses = () => (<><h2 className="page-title">Student Responses</h2><FormPicker>{(id) => <ResponseList key={id} id={id} />}</FormPicker></>);
export const Analytics = () => (<><h2 className="page-title">Analytics</h2><FormPicker>{(id) => <QuestionStats key={id} id={id} />}</FormPicker></>);
