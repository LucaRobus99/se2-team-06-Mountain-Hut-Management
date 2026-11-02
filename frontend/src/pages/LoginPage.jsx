import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import EdelweissBrand from '../components/EdelweissBrand.jsx';
import interiorBackground from '../assets/edelweiss-login-interior.png';

function FieldIcon({ type }) {
  if (type === 'mail') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
  if (type === 'lock') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadingAuth, signIn } = useAuth();
  const destination = (user?.role === 'employee' || user?.role === 'warden')
    ? '/staff'
    : (location.state?.from === '/book' ? '/book' : '/');
  const bookingDraft = location.state?.bookingDraft;
  const loginNotice = location.state?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loadingAuth && user) {
      navigate(destination, {
        replace: true,
        state: destination === '/book' ? { bookingDraft } : null,
      });
    }
  }, [user, loadingAuth, navigate, destination, bookingDraft]);

  function update(field, value) {
    if (field === 'email') setEmail(value);
    else setPassword(value);
    setFieldErrors(previous => ({ ...previous, [field]: '' }));
    setGeneralError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading || loadingAuth) return;
    const errors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    setGeneralError('');
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (err) {
      // Intentionally do not disclose whether the email or the password
      // is wrong: revealing which account exists would leak information.
      if (err.message === 'Incorrect email or password.' || err.code === 'INVALID_CREDENTIALS') {
        setFieldErrors({ password: 'Email or password is incorrect.' });
      } else if (err.code === 'VALIDATION_ERROR' && err.details?.length) {
        const details = {};
        for (const detail of err.details) {
          if (['email', 'password'].includes(detail.field)) details[detail.field] = detail.message;
        }
        setFieldErrors(details);
        if (!Object.keys(details).length) setGeneralError(err.message);
      } else setGeneralError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="eh-login-scene" style={{ backgroundImage: `url(${interiorBackground})` }}>
      <div className="eh-login-card">
        <div className="eh-login-brand"><EdelweissBrand /></div>
        <h1>Welcome back.</h1>
        {loginNotice && !user && <Alert variant="info" className="eh-login-alert">{loginNotice}</Alert>}
        {generalError && <Alert variant="danger" role="alert" className="eh-login-alert">{generalError}</Alert>}
        <form onSubmit={handleSubmit} className="eh-login-form" noValidate>
          <label htmlFor="login-email"><FieldIcon type="mail" />Email</label>
          <input id="login-email" type="email" placeholder="your@email.com" autoComplete="username" required value={email} onChange={e => update('email', e.target.value)} onBlur={() => { if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) setFieldErrors(prev => ({ ...prev, email: 'Enter a valid email address.' })); }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined} disabled={loading || loadingAuth} />
          {fieldErrors.email && <span id="login-email-error" className="eh-field-error" role="alert">{fieldErrors.email}</span>}
          <label htmlFor="login-password"><FieldIcon type="lock" />Password</label>
          <div className="eh-password-input">
            <input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Your password" autoComplete="current-password" required value={password} onChange={e => update('password', e.target.value)} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} disabled={loading || loadingAuth} />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><FieldIcon type="eye" /></button>
          </div>
          {fieldErrors.password && <span id="login-password-error" className="eh-field-error" role="alert">{fieldErrors.password}</span>}
          <button className="eh-button eh-button--green eh-login-submit" type="submit" disabled={loading || loadingAuth}>
            {loading || loadingAuth ? <><Spinner animation="border" size="sm" /> Signing in...</> : 'Log in'}
          </button>
        </form>
        <p className="eh-login-note">New to the hut?{' '}<Link to="/register" state={location.state}>Create an account</Link></p>
      </div>
    </section>
  );
}
