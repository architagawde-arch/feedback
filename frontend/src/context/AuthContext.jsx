import { createContext, useContext, useReducer, useMemo, useCallback } from 'react';

// Global state (session) managed with useReducer + Context
const AuthContext = createContext(null);
const stored = () => { try { return JSON.parse(localStorage.getItem('cfms_user')); } catch { return null; } };

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN': return { user: action.user };
    case 'UPDATE': return { user: { ...state.user, ...action.patch } };
    case 'LOGOUT': return { user: null };
    default: return state;
  }
}
export const primaryRole = (roles = []) => (roles.includes('Admin') ? 'Admin' : roles.includes('Faculty') ? 'Faculty' : 'Student');
export const homePath = (user) => ({ Admin: '/admin', Faculty: '/faculty', Student: '/student' }[primaryRole(user?.roles)]);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { user: stored() });
  const login = useCallback(({ token, user }) => {
    localStorage.setItem('cfms_token', token); localStorage.setItem('cfms_user', JSON.stringify(user));
    dispatch({ type: 'LOGIN', user });
  }, []);
  const logout = useCallback(() => { localStorage.removeItem('cfms_token'); localStorage.removeItem('cfms_user'); dispatch({ type: 'LOGOUT' }); }, []);
  const update = useCallback((patch) => dispatch({ type: 'UPDATE', patch }), []);
  const value = useMemo(() => ({ user: state.user, role: state.user ? primaryRole(state.user.roles) : null, login, logout, update }), [state.user, login, logout, update]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
