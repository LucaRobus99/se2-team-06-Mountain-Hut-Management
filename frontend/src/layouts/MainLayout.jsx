import { Container } from 'react-bootstrap';
import { Outlet, useLocation } from 'react-router';
import AppNavbar from '../components/AppNavbar.jsx';
import EdelweissBrand from '../components/EdelweissBrand.jsx';
import '../styles/edelweiss-pages.css';

const FULL_WIDTH_ROUTES = new Set(['/', '/login', '/availability', '/menu', '/about', '/book']);

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
            <div className="eh-footer-identity">
              <EdelweissBrand light />
              <p>A mountain restaurant in the Dolomites.</p>
            </div>
            <div className="eh-footer-group">
              <h2>Find us</h2>
              <p>Seceda · Val Gardena<br />South Tyrol, Italy</p>
            </div>
            <div className="eh-footer-group">
              <h2>Opening hours</h2>
              <p>Daily · 09:00–21:00</p>
              <p className="eh-footer-small">Indicative hours · subject to seasonal access and weather.</p>
            </div>
            <div className="eh-footer-group">
              <h2>Contact</h2>
              <a href="tel:+393663649009">+39 366 364 9009</a>
              <a href="mailto:info@edelweisshut.example">info@edelweisshut.example</a>
              <p className="eh-footer-small">Demo email address</p>
            </div>
          </div>
          <div className="eh-footer-bottom">
            <span>© {new Date().getFullYear()} Edelweiss Hut</span>
            <span>Seceda · The Dolomites</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
