import { useEffect, useState } from 'react';
import { Alert, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import EdelweissBrand from './EdelweissBrand.jsx';
import AccountIcon from './AccountIcon.jsx';

export default function AppNavbar() {
    const { user, loadingAuth, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [expanded, setExpanded] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const bookingDestination = user?.role === 'hiker' ? '/book' : '/availability';
    const initials = user?.displayName?.split(/\s+/).slice(0, 2).map((name) => name[0]).join('').toUpperCase() || 'HI';

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
                            {!user && <Nav.Link as={NavLink} to="/availability">Availability</Nav.Link>}
                            <Nav.Link as={NavLink} to="/find-us">Find us</Nav.Link>
                            {!loadingAuth && user?.role === 'hiker' && <Nav.Link as={NavLink} to="/my-bookings">My Bookings</Nav.Link>}
                        </Nav>

                        <div className="eh-nav-actions">
                            {!loadingAuth && (user ? (
                                <NavDropdown
                                    id="edelweiss-account"
                                    className="eh-account-menu"
                                    title={<span className="eh-account-trigger"><span className="eh-account-avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}</span><span className="eh-account-trigger-name">{user.displayName || 'My account'}</span></span>}
                                    align="end"
                                >
                                    <NavDropdown.Header>
                                        <span className="eh-account-dropdown-title">{user.displayName || 'Hiker'}</span>
                                                                            </NavDropdown.Header>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item as={Link} to="/my-account"><span className="eh-account-item-icon"><AccountIcon name="user" size={17} /></span> My Account</NavDropdown.Item>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item disabled={loggingOut} className="eh-account-logout" onClick={handleLogout}>
                                        <span className="eh-account-item-icon"><AccountIcon name="logout" size={17} /></span> {loggingOut ? 'Logging out…' : 'Log out'}
                                    </NavDropdown.Item>
                                </NavDropdown>
                            ) : (
                                <div className="eh-auth-links" role="group" aria-label="Account access">
                                    <Nav.Link as={NavLink} to="/login" className="eh-auth-link">Log in</Nav.Link>
                                    <Nav.Link as={NavLink} to="/register" className="eh-auth-link eh-auth-link--register">Register</Nav.Link>
                                </div>
                            ))}
                            <Link className="eh-button eh-button--green eh-header-book" to={bookingDestination}>
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
