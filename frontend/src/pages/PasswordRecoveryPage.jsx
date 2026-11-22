import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { changeMyPassword, requestPasswordReset, resetPassword } from '../api/auth.js';
import EdelweissBrand from '../components/EdelweissBrand.jsx';
import interiorBackground from '../assets/edelweiss-login-interior.png';
import { isValidEmail } from '../utils/contactValidation.js';

export default function PasswordRecoveryPage({ mode }) {
  const { user, loadingAuth, refreshUser, signOut } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const first = mode === 'first';
  const forgot = mode === 'forgot';
  if (loadingAuth) return <div className="eh-route-loading" role="status">Loading…</div>;
  if (first && !user) return <Navigate to="/login" replace />;
  if (first && !user.passwordChangeRequired) return <Navigate to="/my-bookings" replace />;
  const title = first ? 'Choose your own password.' : forgot ? 'Forgot your password?' : 'Reset your password.';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (forgot && !isValidEmail(email.trim())) return setError('Enter a valid email address.');
    if (!forgot && (password.length < 8 || password.length > 128 || password !== confirm)) return setError('Use 8–128 characters and make sure the passwords match.');
    if (first && (!current || current === password)) return setError('Enter your temporary password and choose a different new password.');
    setBusy(true);
    try {
      if (forgot) { await requestPasswordReset(email.trim()); setSuccess(true); }
      else if (first) { await changeMyPassword({ currentPassword: current, newPassword: password }); await refreshUser(); navigate('/my-bookings', { replace: true }); }
      else { await resetPassword(token, password); setPassword(''); setConfirm(''); setSuccess(true); navigate('/login', { replace: true, state: { notice: 'Your password has been reset. Log in with your new password.' } }); }
    } catch (err) { setError(err.message || 'Unable to complete the request. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="eh-login-scene" style={{ backgroundImage: `url(${interiorBackground})` }}>
    <div className="eh-login-card">
      <div className="eh-login-brand"><EdelweissBrand /></div><h1>{title}</h1>
      <p className="eh-password-recovery-copy">{first ? 'For your security, replace the temporary password provided by the hut before accessing your bookings.' : forgot ? 'Enter the email associated with your account. We will send a reset link if the account exists.' : 'Choose a new password for your account. Your reset link is valid for 24 hours and can only be used once.'}</p>
      {success ? <p className="alert alert-success" role="status">If an account exists for this email, you will receive a password reset link. Check your inbox and spam folder.</p> : !first && !forgot && !token ? <p className="alert alert-danger" role="alert">This reset link is missing or invalid. Request a new one.</p> :
        <form className="eh-login-form" noValidate onSubmit={submit}>
          {error && <p className="alert alert-danger" role="alert">{error}</p>}
          {forgot ? <><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></> : <>
            {first && <><label htmlFor="temporary-password">Temporary password</label><input id="temporary-password" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required disabled={busy} /></>}
            <label htmlFor="recovery-new">New password</label><input id="recovery-new" type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
            <label htmlFor="recovery-confirm">Confirm new password</label><input id="recovery-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={busy} />
          </>}
          <button className="eh-button eh-button--green eh-login-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : forgot ? 'Send reset link' : 'Set new password'}</button>
        </form>}
      {first ? <p className="eh-login-note"><button className="eh-edit-cancel" type="button" disabled={busy} onClick={async () => { try { await signOut(); navigate('/login', { replace: true }); } catch (err) { setError(err.message); } }}>Sign out</button></p> : <p className="eh-login-note"><Link to="/login">Back to login</Link>{!forgot && <> · <Link to="/forgot-password">Request a new link</Link></>}</p>}
    </div>
  </section>;
}
