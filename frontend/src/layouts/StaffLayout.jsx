import { useState } from 'react';
import { Alert } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import EdelweissBrand from '../components/EdelweissBrand.jsx';
import '../styles/staff.css';

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  reservations: <><path d="M8 4h9a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2h1"/><path d="M9 3h6v4H9zM9 12h6M9 16h6"/></>,
  exit: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
};
function StaffIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

export default function StaffLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setError('');
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not log out.');
    } finally {
      setLoggingOut(false);
    }
  }
  const firstName = user?.displayName?.split(' ')[0] || 'Team member';
  const initials = user?.displayName?.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'ST';

  return (
    <div className="staff-shell">
      <aside className={`staff-sidebar ${menuOpen ? 'staff-sidebar--open' : ''}`} aria-label="Staff navigation">
        <div className="staff-sidebar-brand"><EdelweissBrand compact /><span className="staff-brand-caption">STAFF WORKSPACE</span></div>
        <div className="staff-navigation-label">OPERATIONS</div>
        <nav className="staff-navigation" aria-label="Operations">
          <NavLink end to="/staff" onClick={() => setMenuOpen(false)} className={({ isActive }) => `staff-navigation-link ${isActive ? 'active' : ''}`}>
            <StaffIcon name="dashboard" /> Overview
          </NavLink>
          <NavLink to="/staff/slots" onClick={() => setMenuOpen(false)} className={({ isActive }) => `staff-navigation-link ${isActive ? 'active' : ''}`}>
            <StaffIcon name="calendar" /> Manage slots
          </NavLink>
          <NavLink to="/staff/reservations" onClick={() => setMenuOpen(false)} className={({ isActive }) => `staff-navigation-link ${isActive ? 'active' : ''}`}>
            <StaffIcon name="reservations" /> Reservations
          </NavLink>
        </nav>
        <div className="staff-sidebar-bottom">
          <div className="staff-user"><span className="staff-avatar">{initials}</span><span><strong>{user?.displayName || 'Staff'}</strong><small>{user?.role === 'warden' ? 'Warden' : 'Employee'}</small></span></div>
          <button type="button" className="staff-logout" onClick={logout} disabled={loggingOut}><StaffIcon name="exit" />{loggingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
      {menuOpen && <button type="button" className="staff-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <div className="staff-main-column">
        <header className="staff-topbar">
          <button className="staff-mobile-toggle" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle staff navigation" aria-expanded={menuOpen}><StaffIcon name="menu" /></button>
          <div className="staff-topbar-greeting">Welcome, <strong>{firstName}</strong><span className="staff-topbar-avatar">{initials}</span></div>
        </header>
        {error && <Alert variant="danger" role="alert" className="m-3">{error}</Alert>}
        <main className="staff-content"><Outlet /></main>
      </div>
    </div>
  );
}
