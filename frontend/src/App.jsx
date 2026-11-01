import { Navigate, Route, Routes, useLocation } from 'react-router';
import MainLayout from './layouts/MainLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import AvailabilityPage from './pages/AvailabilityPage.jsx';
import BookingPage from './pages/BookingPage.jsx';
import SlotManagementPage from './pages/SlotManagementPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './auth/AuthContext.jsx';

// Hikers use /book for the whole process; public visitors use /availability.
// Both routes reuse the same search component, so there is no duplicate form.
function AvailabilityEntry() {
  const { user, loadingAuth } = useAuth();
  const location = useLocation();
  if (!loadingAuth && user?.role === 'hiker') {
    return <Navigate to={`/book${location.search}`} replace />;
  }
  return <AvailabilityPage />;
}

function BookingEntry() {
  const location = useLocation();
  return location.state?.bookingDraft ? <BookingPage /> : <AvailabilityPage />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="availability" element={<AvailabilityEntry />} />
        <Route element={<ProtectedRoute />}>
          <Route path="book" element={<BookingEntry />} />
        </Route>
        <Route element={<ProtectedRoute staffOnly />}>
            <Route path="staff/slots" element={<SlotManagementPage />} />
        </Route>
        <Route path="find-us" element={<AboutPage />} />
        <Route path="about" element={<Navigate to="/find-us" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
