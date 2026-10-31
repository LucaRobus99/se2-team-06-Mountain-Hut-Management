import { Container } from 'react-bootstrap';
import { Link, Outlet, useLocation } from 'react-router';
import AppNavbar from '../components/AppNavbar.jsx';
import '../styles/edelweiss-pages.css';

const FULL_WIDTH_ROUTES = new Set(['/', '/login', '/availability', '/menu', '/about', '/find-us', '/book']);

export default function MainLayout() {
  const pathname = useLocation().pathname;
  const fullWidth = FULL_WIDTH_ROUTES.has(pathname);
  return (
    <div className="app-shell">
      <AppNavbar />
      <main className={`flex-grow-1 ${fullWidth ? 'eh-home-main' : 'py-4 py-md-5'}`}>
        {fullWidth ? <Outlet /> : <Container><Outlet /></Container>}
      </main>
      <footer className="eh-footer" aria-label="Site footer">
        <div className="eh-wide-wrap">
          <div className="eh-footer-content">
            <div className="eh-footer-group">
              <h2>Find us</h2>
              <p>Streda Mastlè 64 · Santa Cristina<br />Seceda, Val Gardena</p>
              <Link to="/find-us#getting-here" className="eh-footer-directions">Directions ↗</Link>
            </div>
            <div className="eh-footer-group">
              <h2>Opening hours</h2>
              <p>Daily · 09:00–21:00</p>
              <p className="eh-footer-small">Indicative · seasonal access and weather permitting</p>
            </div>
            <div className="eh-footer-group">
              <h2>Contact</h2>
              <a href="tel:+393663649009">+39 366 364 9009</a>
              <a href="mailto:info@edelweisshut.example">info@edelweisshut.example</a>
            </div>
          </div>
          <div className="eh-footer-bottom">
            <span>© {new Date().getFullYear()} Edelweiss Hut</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
