import { Container, Nav, Navbar } from 'react-bootstrap';
import { Link, NavLink } from 'react-router';

export default function AppNavbar() {
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
            <Nav.Link as={NavLink} to="/staff/slots">Manage slots</Nav.Link>
            <Nav.Link as={NavLink} to="/login">Login</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
