import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

const STAFF_ROLES = ['employee', 'warden'];

// The backend independently enforces the same permissions on API endpoints.
export default function ProtectedRoute({ staffOnly = false, hikerOnly = false }) {
  const { user, loadingAuth } = useAuth();
  const location = useLocation();
  if (loadingAuth) return <div className="eh-route-loading" role="status">Loading…</div>;
  if (!user) {
    return <Navigate to="/login" replace state={{
      from: location.pathname,
      bookingDraft: location.state?.bookingDraft,
      notice: location.pathname === '/book' ? 'Please log in to complete your booking.' : undefined,
    }} />;
  }
  if (staffOnly && !STAFF_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  if (hikerOnly && user.role !== 'hiker') {
    return <Navigate to={STAFF_ROLES.includes(user.role) ? '/staff' : '/'} replace />;
  }
  return <Outlet />;
}
