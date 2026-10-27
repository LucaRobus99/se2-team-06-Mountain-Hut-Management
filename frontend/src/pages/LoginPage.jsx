import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { login } from '../api/auth.js';

export default function LoginPage() {
  const navigate = useNavigate();

  // Form controllato: React mantiene i valori inseriti dall'utente.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault(); // Evita il ricaricamento della pagina.
    if (loading) return;

    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      // Solo richiesta HTTP: autenticazione e sessione sono gestite dal backend.
      await login({ email: email.trim(), password });
      navigate('/', { replace: true }); // Torna all'app dopo il login.
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
              Access your account to book a table or manage meal slots.
            </p>

            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="login-email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                />
              </Form.Group>

              <Form.Group className="mb-4" controlId="login-password">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                />
              </Form.Group>

              <Button variant="success" type="submit" className="w-100" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
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
