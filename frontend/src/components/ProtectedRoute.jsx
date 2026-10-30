import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

// Protegge le pagine riservate agli utenti autenticati.
// Con `staffOnly` l'accesso è limitato a employee e warden.
export default function ProtectedRoute({ staffOnly = false }) {
  const { user, loading, isStaff } = useAuth();
  const location = useLocation();

  if (loading) return null; // Attende il ripristino della sessione.
  if (!user) {
    // Dopo il login l'utente torna alla pagina richiesta.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (staffOnly && !isStaff) return <Navigate to="/" replace />;
  return <Outlet />;
}
