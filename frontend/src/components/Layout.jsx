import { useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate, Link, useNavigate } from 'react-router-dom';
import { Home, FileText, History, User, Bell, LogOut, PlusSquare, BarChart3, Users, GraduationCap, PieChart, MessageSquare, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';

const NAV = {
  Student: [['/student', 'Dashboard', Home, true], ['/student/forms', 'My Feedback Forms', FileText], ['/student/history', 'Feedback History', History], ['/profile', 'Profile', User], ['/notifications', 'Notifications', Bell, false, true]],
  Faculty: [['/faculty', 'Dashboard', Home, true], ['/faculty/forms', 'My Feedback Forms', FileText], ['/faculty/responses', 'Student Responses', Users], ['/faculty/analytics', 'Analytics', BarChart3], ['/profile', 'My Profile', User], ['/notifications', 'Notifications', Bell, false, true]],
  Admin: [['/admin', 'Dashboard', Home, true], ['/admin/forms', 'Feedback Forms', FileText], ['/admin/create', 'Create Form', PlusSquare], ['/admin/responses', 'Responses', MessageSquare], ['/admin/students', 'Students', GraduationCap], ['/admin/faculty', 'Faculty', Users], ['/admin/analytics', 'Analytics', PieChart], ['/profile', 'Profile', User]],
};
const SUBTITLE = { Student: 'Your Feedback Shapes a Better Tomorrow', Faculty: 'Together for a Better Learning Experience', Admin: '' };
const SIDE_QUOTE = {
  Student: ['“Your Voice Matters”', '— For a Better College Tomorrow”'],
  Faculty: ['“Education grows brighter when we listen.”', 'Teach. Learn. Improve.'],
  Admin: ['“Feedback Today, A Better Tomorrow”', ''],
};

const Leaf = () => (
  <svg viewBox="0 0 120 160" className="leaf" aria-hidden="true">
    <path d="M60 150 C60 90 62 60 90 12 C30 30 18 90 56 118" fill="rgba(120,160,220,.35)" />
    <path d="M60 150 C58 110 60 80 78 40" stroke="rgba(150,190,240,.5)" strokeWidth="3" fill="none" />
  </svg>
);
export const Logo = () => (
  <div className="brand">
    <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M24 6 L30 20 L24 16 L18 20Z" fill="#f5c04a" /><path d="M4 22 L24 30 L44 22 L44 36 L24 44 L4 36Z" fill="#fff" opacity=".95" /><path d="M24 30 V44" stroke="#14305a" strokeWidth="2" /></svg>
    <div><small>SPES's</small><b>Goa Multi Faculty College</b><span>Dharbandora - Goa</span></div>
  </div>
);

export default function Layout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => { if (user) api('/notifications').then((n) => setUnread(n.length)).catch(() => {}); }, [user]);
  if (!user) return <Navigate to="/login" replace />;

  const out = () => { logout(); navigate('/login'); };
  const [q1, q2] = SIDE_QUOTE[role];
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand"><Logo /></div>
        <div className="topbar-main">
          {role === 'Admin' ? (
            <input className="search" placeholder="Search forms, responses, students…" onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/forms?q=${encodeURIComponent(e.target.value)}`)} />
          ) : (
            <div className="topbar-title"><h1>College Feedback Management System</h1><p>{SUBTITLE[role]}</p></div>
          )}
          <div className="topbar-right">
            <Link to="/notifications" className="bell" aria-label="Notifications"><Bell size={24} />{unread > 0 && <i>{unread}</i>}</Link>
            <button className="usermenu" onClick={() => setMenu((m) => !m)}>
              <span className="avatar">{user.full_name[0]}</span>
              <span className="who"><b>{user.full_name}</b>{role !== 'Admin' && <small>{role === 'Student' ? 'Student' : 'Faculty'}</small>}</span>
              <ChevronDown size={16} />
            </button>
            {menu && <div className="dropdown"><Link to="/profile" onClick={() => setMenu(false)}>Profile</Link><button onClick={out}>Logout</button></div>}
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <nav>
          {NAV[role].map(([to, label, Icon, end, badge]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={22} /> <span>{label}</span>{badge && unread > 0 && <i className="pill">{unread}</i>}
            </NavLink>
          ))}
          <button onClick={out} className="logout"><LogOut size={22} /> <span>Logout</span></button>
        </nav>
        <Leaf />
        <div className="side-quote"><p>{q1}</p>{q2 && <small>{q2}</small>}</div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
