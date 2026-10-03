import { Link, useNavigate } from 'react-router-dom';
import { FileText, Users, Star, MessageSquare, CalendarDays, BookOpen, UsersRound, ChevronRight } from 'lucide-react';
import { fmtDate, timeAgo } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Greeting, greet, StatCard, Card, Loader, ErrorBox, Badge, Table, CampusBanner, useFetch } from '../../components/UI.jsx';
import { BarChart, LineChart } from '../../components/Charts.jsx';

const COLORS = ['#1fb5a3', '#2f8de6', '#8a8ef0', '#f6b26b'];
export default function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch('/faculty/dashboard');
  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} />;
  const { stats, ratingsByForm, trend, recentForms, recentResponses, upcoming } = data;
  const cols = [
    { title: '#', render: (_, i) => i + 1 }, { title: 'Form Title', render: (r) => r.title }, { title: 'Category', render: (r) => r.category },
    { title: 'Created On', render: (r) => fmtDate(r.start_at) }, { title: 'Status', render: (r) => <Badge status={r.status} /> }, { title: 'Responses', render: (r) => r.responses },
    { title: 'Action', render: (r) => <div className="row tight"><Link className="btn small" to={`/faculty/responses?form=${r.form_id}`}>View</Link><Link className="btn small" to={`/faculty/forms/${r.form_id}/edit`}>Edit</Link></div> },
  ];
  return (
    <>
      <Greeting title={`${greet()}, ${user.full_name}!`} emoji="☀️" subtitle="Your insights help us build a better college." quote="“Better Teachers Create Brighter Futures.”" />
      <div className="stats four">
        <StatCard icon={FileText} tone="blue" value={stats.forms} label="Forms Created" sub={`${stats.active} Active | ${stats.closed} Closed`} />
        <StatCard icon={Users} tone="green" value={stats.responses} label="Total Responses" sub={`+${stats.week} this week`} />
        <StatCard icon={Star} tone="purple" value={stats.avgRating || '-'} label="Average Rating" sub="Across your forms" />
        <StatCard icon={MessageSquare} tone="orange" value={stats.comments} label="Student Comments" sub="View & respond" />
      </div>
      <div className="cols-main-side wide-side">
        <div className="stack">
          <div className="grid-2">
            <Card title="Average Ratings for Your Forms"><BarChart decimals max={5} data={ratingsByForm.slice(0, 4).map((r) => ({ label: r.title.replace(' Feedback', ''), value: Number(r.avg_rating) }))} colors={COLORS} /></Card>
            <Card title="Response Trend" action={<span className="select static">Last 9 Months</span>}><LineChart data={trend} /></Card>
          </div>
          <div className="cols-main-side even">
            <Card title="Your Feedback Forms" action={<Link className="link" to="/faculty/forms">View All</Link>}><Table columns={cols} rows={recentForms.map((r) => ({ ...r, key: r.form_id }))} /></Card>
            <Card title="Upcoming / Pending" action={<Link className="link" to="/faculty/forms">View All</Link>}>
              <ul className="upcoming">{upcoming.map((u, i) => (
                <li key={u.form_id}><span className="ico" style={{ background: ['#f5821f', '#2f73e0', '#17a888'][i % 3] }}>{[<CalendarDays size={20} />, <BookOpen size={20} />, <UsersRound size={20} />][i % 3]}</span>
                  <div><b>{u.title}</b><small>Due: {fmtDate(u.end_at)}</small></div><Badge status="Pending" /></li>))}
                {!upcoming.length && <li className="muted">Nothing due soon.</li>}</ul>
            </Card>
          </div>
        </div>
        <div className="stack">
          <Card title="Recent Responses" action={<Link className="link" to="/faculty/responses">View All</Link>}>
            <ul className="recent">{recentResponses.map((r, i) => (
              <li key={r.submission_id} onClick={() => navigate(`/faculty/responses?form=${r.form_id}`)}><span className="av" style={{ background: ['#4a74e8', '#17a888', '#6b6fe0', '#2f8de6', '#f5821f'][i % 5] }}>{r.full_name[0]}</span>
                <div><b>{r.full_name}</b><small>{r.title}</small><small>{timeAgo(r.submitted_at)}</small></div><ChevronRight size={18} /></li>))}
              {!recentResponses.length && <li className="muted">No responses yet.</li>}</ul>
          </Card>
        </div>
      </div>
      <CampusBanner small quote="“Feedback today, a stronger tomorrow.”" />
    </>
  );
}
