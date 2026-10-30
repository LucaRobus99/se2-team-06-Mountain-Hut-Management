import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

// Ruoli autorizzati alle funzioni del personale del rifugio.
const STAFF_ROLES = ['employee', 'warden'];

// Protegge le pagine riservate agli utenti autenticati.
// Con `staffOnly` l'accesso è limitato a employee e warden.
export default function ProtectedRoute({ staffOnly = false }) {
  const { user, loadingAuth } = useAuth();
  const location = useLocation();

  if (loadingAuth) return null; // Attende il ripristino della sessione.
  if (!user) {
    // Dopo il login l'utente torna alla pagina richiesta.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (staffOnly && !STAFF_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
