import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Clock, Megaphone, HelpCircle, ArrowRight, CalendarDays } from 'lucide-react';
import { fmtDate } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Greeting, greet, StatCard, Card, Loader, ErrorBox, CampusBanner, useFetch } from '../../components/UI.jsx';
import { Ring } from '../../components/Charts.jsx';
import { FormsTable } from './StudentLists.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch('/student/dashboard');
  if (loading) return <Loader />;
  if (error) return <ErrorBox message={error} />;
  const { stats, assignments, notice } = data;
  const pct = stats.total ? Math.round((stats.submitted / stats.total) * 100) : 0;
  return (
    <>
      <Greeting title={`${greet()}, ${user.full_name.split(' ')[0]}!`} emoji="👋" subtitle="“Small feedback, big changes.”" quote="“Be the change by sharing your thoughts.”" />
      <div className="stats three">
        <StatCard icon={FileText} tone="blue" value={stats.total} label="Total Forms Assigned" />
        <StatCard icon={CheckCircle2} tone="green" value={stats.submitted} label="Forms Submitted" />
        <StatCard icon={Clock} tone="orange" value={stats.pending} label="Forms Pending" />
      </div>
      <div className="cols-main-side">
        <div className="stack">
          <FormsTable assignments={assignments} limit={6} />
          <CampusBanner quote="“A great college is built on the voices of its students.”" />
        </div>
        <div className="stack">
          <Card title="Your Progress">
            <div className="progress">
              <Ring percent={pct} label="Forms Completed" />
              <div><b className="big">{stats.submitted} / {stats.total}</b><p>Forms Submitted</p><small>Keep going! Your feedback helps us improve.</small></div>
            </div>
          </Card>
          <Card title={<span className="with-icon"><Megaphone size={20} color="#f5821f" /> Important Notice</span>} action={<Link className="link" to="/notifications">View All</Link>}>
            {notice ? (
              <div className="notice"><CalendarDays size={28} color="#e5484d" /><div><b>Please submit the {notice.title} by {fmtDate(notice.end_at)}.</b><p>Your response is valuable!</p></div></div>
            ) : <p className="muted">No pending deadlines. Thank you!</p>}
          </Card>
          <Card>
            <div className="help"><HelpCircle size={34} color="#2f73e0" /><div><b>Need Help?</b><p>Facing any issues? Contact the admin or visit the help section.</p>
              <a className="btn primary small" href="mailto:admin@spes.edu">Get Help <ArrowRight size={16} /></a></div></div>
          </Card>
        </div>
      </div>
    </>
  );
}
