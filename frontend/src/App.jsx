import { Navigate, Route, Routes, useLocation } from 'react-router';
import MainLayout from './layouts/MainLayout.jsx';
import StaffLayout from './layouts/StaffLayout.jsx';
import StaffDashboardPage from './pages/StaffDashboardPage.jsx';
import StaffReservationsPage from './pages/StaffReservationsPage.jsx';
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
import { getPendingBooking } from './utils/pendingBooking.js';

const isStaff = (user) => user?.role === 'employee' || user?.role === 'warden';

/** Staff have a distinct application, not the public homepage/navigation. */
function VisitorLayout() {
  const { user, loadingAuth } = useAuth();
  if (loadingAuth) return <div className="eh-route-loading" role="status">Loading…</div>;
  if (isStaff(user)) return <Navigate to="/staff" replace />;
  return <MainLayout />;
}

// Availability is the single search page for visitors AND authenticated hikers.
// Never redirect an authenticated hiker to /book here: /book may still contain
// a saved draft and would trap Back / Choose another time in a navigation loop.
function BookingEntry() {
  const location = useLocation();
  return (location.state?.bookingDraft || getPendingBooking()) ? <BookingPage /> : <AvailabilityPage />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<VisitorLayout />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route element={<ProtectedRoute hikerOnly />}>
          <Route path="book" element={<BookingEntry />} />
          <Route path="book/confirmation/:bookingId" element={<BookingPage />} />
        </Route>
        <Route path="find-us" element={<AboutPage />} />
        <Route path="about" element={<Navigate to="/find-us" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route element={<ProtectedRoute staffOnly />}>
        <Route path="staff" element={<StaffLayout />}>
          <Route index element={<StaffDashboardPage />} />
          <Route path="slots" element={<SlotManagementPage />} />
          <Route path="reservations" element={<StaffReservationsPage />} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
