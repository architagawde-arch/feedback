import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { fmtDate } from '../api.js';
import { Card, Empty, Loader, useFetch } from '../components/UI.jsx';

export default function Notifications() {
  const { data, loading } = useFetch('/notifications');
  if (loading) return <Loader />;
  return (
    <>
      <h2 className="page-title">Notifications</h2>
      <Card>
        {!data.length ? <Empty>You are all caught up.</Empty> : (
          <ul className="notes">{data.map((n) => (
            <li key={n.id}><Bell size={20} /><div><b>{n.title}</b><p>{n.detail} · {fmtDate(n.at)}</p></div><Link className="btn small" to={n.link}>Open</Link></li>
          ))}</ul>
        )}
      </Card>
    </>
  );
}
