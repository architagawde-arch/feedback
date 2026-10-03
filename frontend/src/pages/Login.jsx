import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, homePath } from '../context/AuthContext.jsx';
import { Logo } from '../components/Layout.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ full_name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const res = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: f });
      login(res); navigate(homePath(res.user));
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-side"><Logo /><h1>College Feedback Management System</h1><p>Your feedback shapes a better tomorrow.</p><blockquote>“A great college is built on the voices of its students.”</blockquote></div>
      <form className="login-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create student account'}</h2>
        {err && <div className="alert error">{err}</div>}
        {mode === 'register' && <label>Full name<input required value={f.full_name} onChange={set('full_name')} /></label>}
        <label>Email<input type="email" required value={f.email} onChange={set('email')} autoComplete="username" /></label>
        <label>Password<input type="password" required minLength={6} value={f.password} onChange={set('password')} autoComplete="current-password" /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'New student? Create an account' : 'Already registered? Sign in'}</button>
        {mode === 'login' && <small className="demo">Demo: admin@spes.edu · naik@spes.edu · archita@spes.edu (password123)</small>}
      </form>
    </div>
  );
}
