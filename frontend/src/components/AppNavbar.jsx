import { Container, Nav, Navbar } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppNavbar() {
  const { user, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    // Prima torna alla home: così le pagine protette non reindirizzano al login.
    navigate('/', { replace: true });
    await logout();
  }

  return (
    <Navbar bg="white" expand="lg" className="border-bottom" aria-label="Main navigation">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-semibold brand-name">
          Mountain Hut
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto">
            <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
            <Nav.Link as={NavLink} to="/availability">Check availability</Nav.Link>
            <Nav.Link as={NavLink} to="/book">Book a table</Nav.Link>
            {isStaff && <Nav.Link as={NavLink} to="/staff/slots">Manage slots</Nav.Link>}
            {user ? (
              <>
                <Navbar.Text className="ms-lg-3 me-lg-2 fw-semibold text-success">
                  {user.displayName}
                </Navbar.Text>
                <Nav.Link as="button" type="button" onClick={handleLogout}>Logout</Nav.Link>
              </>
            ) : (
              <Nav.Link as={NavLink} to="/login">Login</Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
