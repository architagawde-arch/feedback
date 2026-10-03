import { Link } from 'react-router-dom';
import { FileText, Users, GraduationCap, Star, FilePlus2, FileX2, FileCheck2, UserPlus, FileEdit } from 'lucide-react';
import { fmtDate, timeAgo } from '../../api.js';
import { greet, Greeting, StatCard, Card, Loader, ErrorBox, Badge, Table, useFetch } from '../../components/UI.jsx';
import { BarChart, Donut } from '../../components/Charts.jsx';

const KIND = { response: [FileCheck2, '#e6edfc', '#4a74e8'], form: [FilePlus2, '#e0f7f0', '#17a888'], student: [UserPlus, '#ecedfd', '#6b6fe0'] };
export default function AdminDashboard() {
  const { data, loading, error } = useFetch('/admin/dashboard');
  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} />;
  const { stats, students, trend, byDepartment, recentForms, topRated, activity } = data;
  const cols = [
    { title: '#', render: (_, i) => i + 1 }, { title: 'Form Title', render: (r) => r.title.replace(' Feedback', ' Feedback') }, { title: 'Category', render: (r) => r.category },
    { title: 'Created On', render: (r) => fmtDate(r.start_at) }, { title: 'Status', render: (r) => <Badge status={r.status} /> }, { title: 'Responses', render: (r) => r.responses },
  ];
  return (
    <>
      <Greeting title={`${greet()}, Admin!`} emoji="👋" subtitle="Here's an overview of your feedback system." quote="“Listen. Learn. Improve.”" />
      <div className="stats four">
        <StatCard icon={FileText} tone="blue" value={stats.forms} label="Total Forms" sub={`${stats.active} Active | ${stats.closed} Closed`} />
        <StatCard icon={Users} tone="green" value={stats.responses} label="Total Responses" sub={`+${stats.week} this week`} />
        <StatCard icon={GraduationCap} tone="purple" value={students} label="Total Students" sub="Across all programs" />
        <StatCard icon={Star} tone="orange" value={stats.avgRating || '-'} label="Average Rating" sub="Overall feedback" />
      </div>
      <div className="cols-main-side wide-side">
        <div className="stack">
          <div className="cols-main-side even2">
            <Card title="Responses Overview" action={<span className="select static">Last 9 Months</span>}><BarChart data={trend} /></Card>
            <Card title="Responses by Program"><Donut data={byDepartment} total={stats.responses} label="Responses" /></Card>
          </div>
          <div className="cols-main-side even">
            <Card title="Recent Feedback Forms" action={<Link className="link" to="/admin/forms">View All</Link>}><Table columns={cols} rows={recentForms.map((r) => ({ ...r, key: r.form_id }))} /></Card>
            <Card title="Top Rated Forms" action={<Link className="link" to="/admin/analytics">View All</Link>}>
              <ol className="top">{topRated.map((t, i) => <li key={t.form_id}><span>{i + 1}</span>{t.title}<b>{t.avg_rating} <Star size={16} fill="#f5a21f" color="#f5a21f" /></b></li>)}</ol>
            </Card>
          </div>
        </div>
        <div className="stack">
          <Card title="Recent Activity" action={<Link className="link" to="/admin/responses">View All</Link>}>
            <ul className="activity">{activity.map((a, i) => { const [Icon, bg, fg] = KIND[a.kind]; return (
              <li key={i}><span className="ico" style={{ background: bg, color: fg }}><Icon size={20} /></span><div><b>{a.title}</b><small>{a.detail}</small><small>{timeAgo(a.happened_at)}</small></div></li>); })}</ul>
          </Card>
        </div>
      </div>
    </>
  );
}
