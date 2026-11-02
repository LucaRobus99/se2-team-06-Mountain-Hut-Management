import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import EdelweissBrand from '../components/EdelweissBrand.jsx';
import interiorBackground from '../assets/edelweiss-login-interior.png';

const EMPTY_FORM = {
  name: '', email: '', phone: '', password: '', confirmPassword: '',
  notes: '', emergencyContact: '',
};
const FIELDS = Object.keys(EMPTY_FORM);

// These checks mirror the registration API. They are a usability aid: the
// server remains responsible for validation, authorization and uniqueness.
function validate(form) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const phone = form.phone.trim();
  if (!name) errors.name = 'Enter your full name.';
  else if (name.length > 100) errors.name = 'Use 100 characters or fewer.';
  if (!email) errors.email = 'Enter your email address.';
  else if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (!phone) errors.phone = 'Enter your mobile number.';
  else if (phone.length > 30 || !/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 6) {
    errors.phone = 'Enter a valid number with at least 6 digits.';
  }
  if (!form.password) errors.password = 'Choose a password.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (form.password.length > 128) errors.password = 'Use 128 characters or fewer.';
  if (!form.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  if (form.notes.trim().length > 1000) errors.notes = 'Use 1000 characters or fewer.';
  if (form.emergencyContact.trim().length > 200) errors.emergencyContact = 'Use 200 characters or fewer.';
  return errors;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loadingAuth, signUp } = useAuth();
  const destination = location.state?.from === '/book' ? '/book' : '/';
  const bookingDraft = location.state?.bookingDraft;
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const fieldErrors = validate(form);
  const disabled = loading || loadingAuth;

  useEffect(() => {
    if (!loadingAuth && user) {
      navigate(destination, {
        replace: true,
        state: destination === '/book' ? { bookingDraft } : null,
      });
    }
  }, [loadingAuth, user, navigate, destination, bookingDraft]);

  function update(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    setServerErrors(current => ({ ...current, [name]: '' }));
    setGeneralError('');
  }

  function fieldProps(name) {
    const visibleError = serverErrors[name] || (touched[name] ? fieldErrors[name] : '');
    return {
      id: `register-${name}`,
      name,
      value: form[name],
      onChange: update,
      onBlur: () => setTouched(current => ({ ...current, [name]: true })),
      'aria-invalid': Boolean(visibleError),
      'aria-describedby': visibleError ? `register-${name}-error` : undefined,
      disabled,
    };
  }

  function message(name) {
    const msg = serverErrors[name] || (touched[name] ? fieldErrors[name] : '');
    return msg ? <span id={`register-${name}-error`} role="alert" className="eh-field-error">{msg}</span> : null;
  }

  async function submit(event) {
    event.preventDefault();
    if (disabled) return;
    setTouched(Object.fromEntries(FIELDS.map(field => [field, true])));
    setServerErrors({});
    setGeneralError('');
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    try {
      await signUp({
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        password: form.password, notes: form.notes.trim(),
        emergencyContact: form.emergencyContact.trim(),
      });
    } catch (err) {
      if (err.code === 'EMAIL_ALREADY_REGISTERED') {
        setServerErrors({ email: 'This email is already registered. Please log in instead.' });
      } else if (err.code === 'VALIDATION_ERROR' && err.details?.length) {
        const perField = {};
        for (const detail of err.details) {
          if (FIELDS.includes(detail.field)) perField[detail.field] = detail.message;
        }
        setServerErrors(perField);
        if (!Object.keys(perField).length) setGeneralError(err.message || 'Please check your details.');
      } else {
        setGeneralError(err.message || 'Unable to create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="eh-login-scene eh-register-scene" style={{ backgroundImage: `url(${interiorBackground})` }}>
      <div className="eh-login-card eh-register-card">
        <div className="eh-login-brand"><EdelweissBrand /></div>
        <h1>Create your account.</h1>
        {location.state?.notice && <Alert variant="info" className="eh-login-alert">{location.state.notice}</Alert>}
        {generalError && <Alert variant="danger" role="alert" className="eh-login-alert">{generalError}</Alert>}
        <form className="eh-login-form" onSubmit={submit} noValidate>
          <div className="eh-register-grid">
            <div className="eh-register-field">
              <label htmlFor="register-name">Full name <span aria-hidden="true">*</span></label>
              <input {...fieldProps('name')} type="text" autoComplete="name" maxLength="100" placeholder="Your full name" required />
              {message('name')}
            </div>
            <div className="eh-register-field">
              <label htmlFor="register-phone">Mobile number <span aria-hidden="true">*</span></label>
              <input {...fieldProps('phone')} type="tel" autoComplete="tel" maxLength="30" placeholder="+39 345 123 4567" required />
              {message('phone')}
            </div>
            <div className="eh-register-field eh-register-field--full">
              <label htmlFor="register-email">Email <span aria-hidden="true">*</span></label>
              <input {...fieldProps('email')} type="email" autoComplete="email" maxLength="255" placeholder="your@email.com" required />
              {message('email')}
            </div>
            <div className="eh-register-field">
              <label htmlFor="register-password">Password <span aria-hidden="true">*</span></label>
              <div className="eh-password-input">
                <input {...fieldProps('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength="128" required />
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={disabled}>
                  <EyeIcon />
                </button>
              </div>
              {message('password') || <p className="eh-register-hint">Use at least 8 characters.</p>}
            </div>
            <div className="eh-register-field">
              <label htmlFor="register-confirmPassword">Confirm password <span aria-hidden="true">*</span></label>
              <div className="eh-password-input">
                <input {...fieldProps('confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required />
                <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} aria-pressed={showConfirmPassword} disabled={disabled}>
                  <EyeIcon />
                </button>
              </div>
              {message('confirmPassword')}
            </div>
            <div className="eh-register-field eh-register-field--full">
              <label htmlFor="register-notes">Notes <span className="eh-register-optional">(optional)</span></label>
              <textarea {...fieldProps('notes')} maxLength="1000" rows="2" placeholder="E.g. registered mountain guide" />
              {message('notes')}
            </div>
            <div className="eh-register-field eh-register-field--full">
              <label htmlFor="register-emergencyContact">Emergency contact <span className="eh-register-optional">(optional)</span></label>
              <input {...fieldProps('emergencyContact')} type="text" maxLength="200" placeholder="Name and mobile number" />
              {message('emergencyContact')}
            </div>
          </div>
          <button className="eh-button eh-button--green eh-login-submit" type="submit" disabled={disabled}>
            {disabled ? <><Spinner animation="border" size="sm" /> Creating account...</> : 'Create account'}
          </button>
        </form>
        <p className="eh-login-note">Already registered?{' '}<Link to="/login" state={location.state}>Log in</Link></p>
      </div>
    </section>
  );
}
