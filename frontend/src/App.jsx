import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Login, Dashboard, FormsList, FillForm, Results, CreateForm, Manage } from './pages.jsx';

const AuthCtx = createContext(); export const useAuth = () => useContext(AuthCtx);
const reducer = (s, a) => a.type === 'login' ? a.user : a.type === 'logout' ? null : s;
const NAV = {
  Admin: [['/', 'Dashboard', '▦'], ['/forms', 'Feedback Forms', '▤'], ['/create', 'Create Form', '＋'], ['/manage/students', 'Students', '☺'], ['/manage/faculty', 'Faculty', '♙'], ['/manage/departments', 'Departments', '▥'], ['/manage/programmes', 'Programmes', '▧'], ['/manage/batches', 'Batches', '▨'], ['/manage/courses', 'Courses', '▩'], ['/manage/offerings', 'Course Offerings', '▣'], ['/manage/enrollments', 'Enrollments', '✓'], ['/manage/types', 'Feedback Types', '☰'], ['/manage/facilities', 'Facilities', '⌂']],
  Faculty: [['/', 'Dashboard', '▦'], ['/forms', 'My Feedback Forms', '▤']],
  Student: [['/', 'Dashboard', '▦'], ['/forms', 'My Feedback Forms', '▤']]
};

function Shell({ children }) {
  const { user, dispatch } = useAuth(); const nav = useNavigate(); const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const logout = useCallback(() => { localStorage.clear(); dispatch({ type: 'logout' }); nav('/login'); }, []);
  return (<div className="app">
    <aside className="side">
      <div className="brand"><div className="logo">📖</div><div><small>SPES's</small><b>Goa Multi Faculty College</b><small>Dharbandora - Goa</small></div></div>
      <nav>{NAV[user.role].map(([to, label, ic]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nl' + (isActive ? ' on' : '')}><span>{ic}</span>{label}</NavLink>)}
        <button className="nl" onClick={logout}><span>⎋</span>Logout</button></nav>
      <p className="quote">“Education grows brighter when we listen.”<br /><small>Teach. Learn. Improve.</small></p>
    </aside>
    <div className="main">
      <header className="top"><div><h1>College Feedback Management System</h1><p>Together for a Better Learning Experience</p></div>
        <div className="who"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><br /><small>{user.role}</small></div></div></header>
      <section className="content"><div className="date">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}<br />{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>{children}</section>
    </div></div>);
}

export default function App() {
  const [user, dispatch] = useReducer(reducer, JSON.parse(localStorage.getItem('user') || 'null'));
  const guard = (el, roles) => !user ? <Navigate to="/login" /> : roles && !roles.includes(user.role) ? <Navigate to="/" /> : <Shell>{el}</Shell>;
  return (<AuthCtx.Provider value={{ user, dispatch }}><Routes>
    <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
    <Route path="/" element={guard(<Dashboard />)} />
    <Route path="/forms" element={guard(<FormsList />)} />
    <Route path="/forms/:id/fill" element={guard(<FillForm />, ['Student', 'Faculty'])} />
    <Route path="/forms/:id/results" element={guard(<Results />, ['Admin', 'Faculty'])} />
    <Route path="/create" element={guard(<CreateForm />, ['Admin'])} />
    <Route path="/manage/:entity" element={guard(<Manage />, ['Admin'])} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes></AuthCtx.Provider>);
}
