import { useEffect, useState } from 'react';
import { Alert, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import EdelweissBrand from './EdelweissBrand.jsx';

export default function AppNavbar() {
    const { user, loadingAuth, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [expanded, setExpanded] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const bookDestination = user?.role === 'hiker' ? '/book' : '/availability';

    // Close the mobile menu whenever the user navigates to another route.
    useEffect(() => {
        setExpanded(false);
    }, [location.pathname, location.search]);

    async function handleLogout() {
        setLogoutError('');
        setLoggingOut(true);
        try {
            await signOut();
            navigate('/', { replace: true });
        } catch (error) {
            setLogoutError(error.message || 'Could not sign out.');
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <>
            <Navbar
                expand="lg"
                expanded={expanded}
                onToggle={(next) => setExpanded(next)}
                className="eh-navbar"
                aria-label="Main navigation"
            >
                <div className="eh-nav-inner">
                    <Navbar.Brand as={Link} to="/" className="eh-navbar-logo" aria-label="Edelweiss Hut — Home">
                        <EdelweissBrand compact />
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="edelweiss-navigation" className="eh-nav-toggle" />
                    <Navbar.Collapse id="edelweiss-navigation" className="eh-nav-collapse">
                        <Nav className="eh-nav-links">
                            <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
                            <Nav.Link as={NavLink} to="/menu">Menu</Nav.Link>
                            <Nav.Link as={NavLink} to="/availability">Availability</Nav.Link>
                            <Nav.Link as={NavLink} to="/find-us">Find us</Nav.Link>
                            {(user?.role === 'employee' || user?.role === 'warden') && (
                                <Nav.Link as={NavLink} to="/staff/slots">Manage slots</Nav.Link>
                            )}
                        </Nav>

                        <div className="eh-nav-actions">
                            {!loadingAuth && (user ? (
                                <NavDropdown
                                    id="edelweiss-account"
                                    className="eh-account-menu"
                                    title={user.displayName || 'My account'}
                                    align="end"
                                >
                                    <NavDropdown.Header>My account</NavDropdown.Header>
                                    <NavDropdown.Item as={Link} to={bookDestination}>Book a table</NavDropdown.Item>
                                    <NavDropdown.Item as={Link} to="/availability">Check availability</NavDropdown.Item>
                                    <NavDropdown.Item disabled>My bookings (coming soon)</NavDropdown.Item>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item disabled={loggingOut} onClick={handleLogout}>
                                        {loggingOut ? 'Logging out…' : 'Log out'}
                                    </NavDropdown.Item>
                                </NavDropdown>
                            ) : (
                                <Nav.Link as={NavLink} to="/login" className="eh-login-link">Log in</Nav.Link>
                            ))}
                            <Link className="eh-button eh-button--green eh-header-book" to={bookDestination}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <rect x="3" y="5" width="18" height="16" rx="2" />
                                    <path d="M7 3v4M17 3v4M3 10h18" />
                                </svg>
                                Book a table
                            </Link>
                        </div>
                    </Navbar.Collapse>
                </div>
            </Navbar>
            {logoutError && <Alert variant="danger" className="m-2" role="alert">{logoutError}</Alert>}
        </>
    );
}
