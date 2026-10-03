import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../../api.js';
import { Badge, Card, Loader, Table, Tabs, useFetch } from '../../components/UI.jsx';

// Reusable list used by dashboard, "My Feedback Forms" and "Feedback History"
export function FormsTable({ assignments, limit, onlySubmitted }) {
  const [tab, setTab] = useState('All');
  const [sort, setSort] = useState('Latest');
  const base = onlySubmitted ? assignments.filter((a) => a.display_status === 'Submitted') : assignments;
  const count = useCallback((s) => base.filter((a) => a.display_status === s).length, [base]);
  const rows = useMemo(() => {
    const list = base.filter((a) => tab === 'All' || a.display_status === tab);
    list.sort((a, b) => (sort === 'Latest' ? new Date(b.start_at) - new Date(a.start_at) : new Date(a.start_at) - new Date(b.start_at)));
    return limit ? list.slice(0, limit) : list;
  }, [base, tab, sort, limit]);
  const tabs = onlySubmitted ? [['All', `All (${base.length})`]] : [['All', `All Forms (${base.length})`], ['Pending', `Pending (${count('Pending')})`], ['Submitted', `Submitted (${count('Submitted')})`], ['Closed', `Closed (${count('Closed')})`]];
  const cols = [
    { title: '#', render: (_, i) => i + 1 },
    { title: 'Form Title', render: (r) => r.title },
    { title: 'Category', render: (r) => r.category },
    { title: 'Created On', render: (r) => fmtDate(r.start_at) },
    { title: 'Status', render: (r) => <Badge status={r.display_status} /> },
    { title: 'Action', render: (r) => r.display_status === 'Pending' ? <Link className="btn solid small" to={`/student/forms/${r.assignment_id}`}>Fill Now</Link> : <Link className="btn small" to={`/student/forms/${r.assignment_id}`}>View</Link> },
  ];
  return (
    <Card title="Your Feedback Forms" action={<select className="select" value={sort} onChange={(e) => setSort(e.target.value)}><option>Latest</option><option>Oldest</option></select>}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <Table columns={cols} rows={rows.map((r) => ({ ...r, key: r.assignment_id }))} empty="No forms in this view." />
    </Card>
  );
}

const Page = ({ title, only }) => function P() {
  const { data, loading } = useFetch('/student/dashboard');
  if (loading) return <Loader />;
  return (<><h2 className="page-title">{title}</h2><FormsTable assignments={data.assignments} onlySubmitted={only} /></>);
};
export const StudentForms = Page({ title: 'My Feedback Forms' });
export const StudentHistory = Page({ title: 'Feedback History', only: true });
