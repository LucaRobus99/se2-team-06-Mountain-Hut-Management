import { Route, Routes } from 'react-router';
import MainLayout from './layouts/MainLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import AvailabilityPage from './pages/AvailabilityPage.jsx';
import BookingPage from './pages/BookingPage.jsx';
import SlotManagementPage from './pages/SlotManagementPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="book" element={<BookingPage />} />
        <Route path="staff/slots" element={<SlotManagementPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
