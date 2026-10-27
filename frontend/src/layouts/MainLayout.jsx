import { Container } from 'react-bootstrap';
import { Outlet } from 'react-router';
import AppNavbar from '../components/AppNavbar.jsx';

export default function MainLayout() {
  return (
    <div className="app-shell">
      <AppNavbar />
      <main className="flex-grow-1 py-4 py-md-5">
        <Container>
          <Outlet />
        </Container>
      </main>
      <footer className="border-top py-3 text-muted small">
        <Container>Mountain Hut Management</Container>
      </footer>
    </div>
  );
}
