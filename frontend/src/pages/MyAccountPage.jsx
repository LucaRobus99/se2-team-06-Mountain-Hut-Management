import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { updateMyProfile, changeMyPassword } from '../api/auth.js';
import heroImage from '../assets/edelweiss-my-account.jpg';
import avatarImage from '../assets/edelweiss-terrace.jpg';
import '../styles/account-bookings.css';
import '../styles/my-account.css';

function unavailableMessage(error, operation) {
  if (error?.status === 404 || error?.status === 405) {
    return `${operation} is not available yet. The profile service still needs to be enabled.`;
  }
  if (error?.status === 401) return 'Your session has expired. Please log in again.';
  return error?.message || 'Could not save your changes.';
}

export default function MyAccountPage() {
  const { user, refreshUser } = useAuth();
  const [section, setSection] = useState('personal');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function showSection(next) {
    setSection(next);
    setError('');
    setSuccess('');
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');setSuccess('');
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || trimmedName.length > 100) { setError('Please enter a name of up to 100 characters.'); return; }
    if (trimmedPhone.length > 30) { setError('Use 30 characters or fewer for your phone number.'); return; }
    setSaving(true);
    try {
      await updateMyProfile({ name: trimmedName, phone: trimmedPhone || null });
      await refreshUser();
      setEditing(false);
      setSuccess('Your personal information was updated.');
    } catch (err) { setError(unavailableMessage(err, 'Editing personal information')); }
    finally { setSaving(false); }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError('');setSuccess('');
    if (!currentPassword) { setError('Enter your current password.'); return; }
    if (newPassword.length < 8 || newPassword.length > 128) { setError('Your new password must be between 8 and 128 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return; }
    setSaving(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');
      setSuccess('Your password was changed.');
    } catch (err) { setError(unavailableMessage(err, 'Changing the password')); }
    finally { setSaving(false); }
  }

  return (
    <div className="eh-account-page">
      <header className="eh-account-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="eh-account-hero-overlay"><div className="eh-wide-wrap">
          <p className="eh-profile-eyebrow">YOUR PROFILE</p>
          <h1>My Account</h1>
          <p>Review your details and keep your account secure.</p>
        </div></div>
      </header>
      <div className="eh-account-body eh-wide-wrap">
        <aside className="eh-account-sidebar" aria-label="Account sections">
          <h2>My Account</h2>
          <button type="button" className={`eh-account-tab ${section === 'personal' ? 'is-active' : ''}`}
            aria-pressed={section === 'personal'} onClick={() => showSection('personal')}>
            <span aria-hidden="true">♙</span> Personal Information
          </button>
          <button type="button" className={`eh-account-tab ${section === 'security' ? 'is-active' : ''}`}
            aria-pressed={section === 'security'} onClick={() => showSection('security')}>
            <span aria-hidden="true">♧</span> Security
          </button>
        </aside>
        <section className="eh-account-content">
          <h2>{section === 'personal' ? 'Personal Information' : 'Password & Security'}</h2>
          <p className="eh-account-subtitle">{section === 'personal'
            ? 'Your contact details for bookings at Edelweiss Hut.'
            : 'Update your password to help keep your account secure.'}</p>
          {error && <div className="eh-account-message eh-account-message--error" role="alert">{error}</div>}
          {success && <div className="eh-account-message eh-account-message--success" role="status">{success}</div>}
          {section === 'personal' ? (
            <div className="eh-account-card">
              <div className="eh-account-profile-top">
                <div className="eh-account-portrait" style={{ backgroundImage: `url(${avatarImage})` }} aria-hidden="true" />
                <div className="eh-account-identity">
                  <h3>{user?.displayName || 'Hiker'}</h3>
                  <span className="eh-account-role">Hiker</span>
                </div>
              </div>
              {!editing ? (
                <>
                  <dl className="eh-account-info-list">
                    <div><dt>Email</dt><dd>{user?.email || 'Not provided'}</dd></div>
                    <div><dt>Phone</dt><dd>{user?.phone || 'Not provided'}</dd></div>
                    <div><dt>Account type</dt><dd>Hiker</dd></div>
                  </dl>
                  <div className="eh-account-card-actions">
                    <button type="button" className="eh-account-action" onClick={() => { setName(user?.displayName || ''); setPhone(user?.phone || ''); setEditing(true); setError('');setSuccess(''); }}>
                      <span aria-hidden="true">✎</span><span><strong>Edit personal information</strong><small>Update your name or phone number</small></span><span aria-hidden="true">→</span>
                    </button>
                    <button type="button" className="eh-account-action eh-account-action--simple" onClick={() => showSection('security')}>
                      <span><strong>Change password</strong><small>Choose a new password for your account</small></span><span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : (
                <form className="eh-account-form" onSubmit={saveProfile}>
                  <label htmlFor="account-name">Name</label>
                  <input id="account-name" value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} autoComplete="name" />
                  <label htmlFor="account-email">Email <span className="eh-account-field-note">(read-only)</span></label>
                  <input id="account-email" value={user?.email || ''} disabled autoComplete="email" />
                  <label htmlFor="account-phone">Phone number</label>
                  <input id="account-phone" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
                  <div className="eh-account-form-actions">
                    <button type="submit" disabled={saving} className="eh-button eh-button--green">{saving ? 'Saving…' : 'Save changes'}</button>
                    <button type="button" disabled={saving} className="eh-account-cancel" onClick={() => { setEditing(false);setError(''); }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="eh-account-card eh-account-security">
              <div className="eh-account-security-head"><span aria-hidden="true">♧</span><div><h3>Change your password</h3><p>Enter your current password and choose a new one.</p></div></div>
              <form className="eh-account-form" onSubmit={savePassword}>
                <label htmlFor="current-password">Current password</label>
                <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} required onChange={(event) => setCurrentPassword(event.target.value)} />
                <label htmlFor="new-password">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <p className="eh-account-field-hint">At least 8 characters.</p>
                <label htmlFor="confirm-new-password">Confirm new password</label>
                <input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                <div className="eh-account-form-actions"><button type="submit" className="eh-button eh-button--green" disabled={saving}>{saving ? 'Updating…' : 'Change password'}</button></div>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
