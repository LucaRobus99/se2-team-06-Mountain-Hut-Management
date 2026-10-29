import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadingAuth, signIn } = useAuth();

  // Torna alla prenotazione che era in corso, quando presente.
  const destination = location.state?.from === '/book' ? '/book' : '/';
  const bookingDraft = location.state?.bookingDraft;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loadingAuth && user) {
      navigate(destination, {
        replace: true,
        state: destination === '/book' ? { bookingDraft } : null
      });
    }
  }, [user, loadingAuth, navigate, destination, bookingDraft]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading || loadingAuth) return;
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      // Il reindirizzamento e' gestito dall'useEffect quando cambia user.
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Row className="justify-content-center py-3 py-md-5">
      <Col xs={12} sm={10} md={7} lg={5}>
        <Card className="border-0 shadow-sm page-card">
          <Card.Body className="p-4 p-md-5">
            <p className="text-uppercase small fw-bold text-success mb-2">
              Mountain Hut Management
            </p>
            <h1 className="h2 fw-bold mb-2">Sign in</h1>
            <p className="text-secondary mb-4">
              Sign in to confirm your table booking.
            </p>

            {error && <Alert variant="danger" role="alert">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="login-email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email" autoComplete="username" required
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  disabled={loading || loadingAuth}
                />
              </Form.Group>
              <Form.Group className="mb-4" controlId="login-password">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password" autoComplete="current-password" required
                  value={password} onChange={(event) => setPassword(event.target.value)}
                  disabled={loading || loadingAuth}
                />
              </Form.Group>
              <Button variant="success" type="submit" className="w-100" disabled={loading || loadingAuth}>
                {loading || loadingAuth ? <><Spinner size="sm" animation="border" className="me-2" />Signing in...</> : 'Sign in'}
              </Button>
            </Form>

            <p className="text-secondary small text-center mt-4 mb-0">
              Just visiting? <Link to="/availability">Check availability without logging in</Link>
            </p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
