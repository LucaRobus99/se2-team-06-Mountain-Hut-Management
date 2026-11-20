import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { updateMyProfile, changeMyPassword, uploadMyAvatar, removeMyAvatar } from '../api/auth.js';
import { prepareAvatar } from '../utils/avatar.js';
import AccountIcon from '../components/AccountIcon.jsx';
import heroImage from '../assets/edelweiss-my-account.jpg';
import avatarImage from '../assets/edelweiss-terrace.jpg';
import '../styles/account-bookings.css';
import '../styles/my-account.css';
import '../styles/account-email-fix.css';

function unavailableMessage(error, operation) {
  if (error?.status === 404 || error?.status === 405) {
    return `${operation} is not available yet. The profile service still needs to be enabled.`;
  }
  if (error?.status === 401) return 'Your session has expired. Please log in again.';
  return error?.message || 'Could not save your changes.';
}

function prettyValue(value, fallback = 'Not provided') {
  return value && String(value).trim() ? value : fallback;
}

export default function MyAccountPage() {
  const { user, refreshUser } = useAuth();
  const [section, setSection] = useState('personal');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState(user?.notes || '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');
  const photoInputRef = useRef(null);
  const photoMenuRef = useRef(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!editing) {
      setName(user?.displayName || '');
      setPhone(user?.phone || '');
      setNotes(user?.notes || '');
      setEmergencyContact(user?.emergencyContact || '');
    }
  }, [user, editing]);

  useEffect(() => {
    if (!photoMenuOpen) return undefined;
    function handlePointerDown(event) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target)) {
        setPhotoMenuOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setPhotoMenuOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [photoMenuOpen]);

  async function changePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setSuccess('');
    setPhotoSaving(true);
    setPhotoMenuOpen(false);
    try {
      const imageData = await prepareAvatar(file);
      await uploadMyAvatar(imageData);
      await refreshUser();
      setSuccess('Your profile photo was updated.');
    } catch (err) {
      setError(unavailableMessage(err, 'Uploading your photo'));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function removePhoto() {
    setError('');
    setSuccess('');
    setPhotoSaving(true);
    setPhotoMenuOpen(false);
    try {
      await removeMyAvatar();
      await refreshUser();
      setSuccess('Your profile photo was removed.');
    } catch (err) {
      setError(unavailableMessage(err, 'Removing your photo'));
    } finally {
      setPhotoSaving(false);
    }
  }

  function showSection(next) {
    setSection(next);
    setError('');
    setSuccess('');
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setError('Please enter a name of up to 100 characters.');
      return;
    }
    if (trimmedPhone.length > 30 || !/^[+\d\s().-]+$/.test(trimmedPhone) || trimmedPhone.replace(/\D/g, '').length < 6) {
      setError('Enter a valid mobile number (at least 6 digits).');
      return;
    }
    if (notes.trim().length > 1000 || emergencyContact.trim().length > 200) {
      setError('Notes must be under 1000 characters and emergency contact under 200.');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        name: trimmedName,
        phone: trimmedPhone,
        notes: notes.trim() || null,
        emergencyContact: emergencyContact.trim() || null,
      });
      await refreshUser();
      setEditing(false);
      setSuccess('Your personal information was updated.');
    } catch (err) {
      setError(unavailableMessage(err, 'Editing personal information'));
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('Your new password must be between 8 and 128 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Your password was changed.');
    } catch (err) {
      setError(unavailableMessage(err, 'Changing the password'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="eh-account-page eh-account-page--split">
      <header className="eh-account-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="eh-account-hero-overlay">
          <div className="eh-wide-wrap">
            <p className="eh-profile-eyebrow">EDELWEISS HUT <span className="eh-profile-eyebrow-rule" aria-hidden="true" /></p>
            <h1>My Account</h1>
            <p>Review your details and keep your account secure.</p>
          </div>
        </div>
      </header>

      <div className="eh-account-body">
        <aside className="eh-account-sidebar" aria-label="Account sections">
          <div className="eh-account-side-content">
            <div className="eh-account-photo-wrap" ref={photoMenuRef}>
              <input
                ref={photoInputRef}
                className="eh-account-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose profile photo"
                onChange={changePhoto}
              />
              <button
                type="button"
                className="eh-account-portrait-button"
                aria-label="Open profile photo options"
                aria-expanded={photoMenuOpen}
                aria-haspopup="menu"
                disabled={photoSaving}
                onClick={() => setPhotoMenuOpen((open) => !open)}
              >
                <span className="eh-account-portrait">
                  <img src={user?.avatarUrl || avatarImage} alt="" />
                </span>
                <span className="eh-account-photo-edit-icon" aria-hidden="true"><AccountIcon name="camera" size={22} /></span>
              </button>
              {photoMenuOpen && (
                <div className="eh-account-photo-menu" role="menu" aria-label="Profile photo options">
                  <button
                    type="button"
                    role="menuitem"
                    className="eh-account-photo-menu-button"
                    disabled={photoSaving}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <AccountIcon name="upload" size={19} />
                    {user?.avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {user?.avatarUrl && (
                    <button
                      type="button"
                      role="menuitem"
                      className="eh-account-photo-menu-button eh-account-photo-menu-button--danger"
                      disabled={photoSaving}
                      onClick={removePhoto}
                    >
                      <AccountIcon name="trash" size={19} /> Remove photo
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="eh-account-side-identity">
              <h2>{user?.displayName || 'Your account'}</h2>
              <p><AccountIcon name="mail" size={18} /><span>{user?.email || 'No email available'}</span></p>
            </div>

            <nav className="eh-account-side-nav" aria-label="Account settings">
              <button
                type="button"
                className={`eh-account-tab ${section === 'personal' ? 'is-active' : ''}`}
                aria-pressed={section === 'personal'}
                onClick={() => showSection('personal')}
              >
                <AccountIcon name="user" size={22} /> Personal Information
              </button>
              <button
                type="button"
                className={`eh-account-tab ${section === 'security' ? 'is-active' : ''}`}
                aria-pressed={section === 'security'}
                onClick={() => showSection('security')}
              >
                <AccountIcon name="lock" size={22} /> Security
              </button>
            </nav>
          </div>

          <svg className="eh-account-sidebar-art" viewBox="0 0 430 175" fill="none" aria-hidden="true" focusable="false">
            <path d="M0 126 37 92 63 113 92 72 118 103 160 54 207 103 239 78 288 123 330 91 387 130 430 113" />
            <path d="m60 112 32-40 26 31m23-18 19-31 47 49m58 1 23 19 40-32 57 39" />
            <path d="M0 151q65-34 131-5t139-7q64-25 160 7" />
            <path d="M38 152V90m0 1-19 29 19-9 19 9-19-29m0 20-23 29 23-8 23 8-23-29M367 148V78m0 2-17 24 17-6 17 6-17-24m0 17-21 26 21-7 21 7-21-26m0 14-25 29 25-7 25 7-25-29M414 154V106m0 0-14 23 14-6 14 6-14-23m0 13-17 23 17-6 16 6-16-23" />
          </svg>
        </aside>

        <section className="eh-account-content">
          <div className="eh-account-heading">
            <h2>{section === 'personal' ? 'Personal Information' : 'Password & Security'}</h2>
            <p className="eh-account-subtitle">
              {section === 'personal'
                ? 'Your contact details for bookings at Edelweiss Hut.'
                : 'Update your password to help keep your account secure.'}
            </p>
          </div>

          {error && <div className="eh-account-message eh-account-message--error" role="alert">{error}</div>}
          {success && <div className="eh-account-message eh-account-message--success" role="status"><AccountIcon name="shield" size={20} /> {success}</div>}

          {section === 'personal' ? (
            <section className="eh-account-card eh-account-card--profile" aria-label="Your profile information">
              {!editing ? (
                <>
                  <div className="eh-account-overview-grid">
                    <article className="eh-account-info-card">
                      <span className="eh-account-info-heading"><AccountIcon name="mail" size={32} /><span className="eh-account-info-label">Email</span></span>
                      <strong>{prettyValue(user?.email)}</strong>
                    </article>
                    <article className="eh-account-info-card">
                      <span className="eh-account-info-heading"><AccountIcon name="phone" size={32} /><span className="eh-account-info-label">Phone</span></span>
                      <strong>{prettyValue(user?.phone)}</strong>
                    </article>
                    <article className="eh-account-detail-card">
                      <span className="eh-account-info-heading"><AccountIcon name="note" size={32} /><span className="eh-account-info-label">Notes</span></span>
                      <p>{prettyValue(user?.notes, 'Not provided')}</p>
                    </article>
                    <article className="eh-account-detail-card">
                      <span className="eh-account-info-heading"><AccountIcon name="contact" size={32} /><span className="eh-account-info-label">Emergency contact</span></span>
                      <p>{prettyValue(user?.emergencyContact, 'Not provided')}</p>
                    </article>
                  </div>

                  <div className="eh-account-card-actions">
                    <button
                      type="button"
                      className="eh-account-action eh-account-action--primary"
                      onClick={() => {
                        setName(user?.displayName || '');
                        setPhone(user?.phone || '');
                        setNotes(user?.notes || '');
                        setEmergencyContact(user?.emergencyContact || '');
                        setEditing(true);
                        setError('');
                        setSuccess('');
                      }}
                    >
                      <AccountIcon name="edit" size={27} />
                      <span>Edit personal information</span>
                      <AccountIcon name="arrow" size={25} className="eh-account-action-arrow" />
                    </button>
                    <button
                      type="button"
                      className="eh-account-action eh-account-action--simple"
                      onClick={() => showSection('security')}
                    >
                      <AccountIcon name="lock" size={27} />
                      <span>Change password</span>
                      <AccountIcon name="arrow" size={25} className="eh-account-action-arrow" />
                    </button>
                  </div>
                </>
              ) : (
                <form className="eh-account-form" onSubmit={saveProfile}>
                  <h3>Edit personal information</h3>
                  <label htmlFor="account-name">Name</label>
                  <input id="account-name" value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} autoComplete="name" />
                  <label htmlFor="account-email">Email <span className="eh-account-field-note">(read-only)</span></label>
                  <input id="account-email" value={user?.email || ''} disabled autoComplete="email" />
                  <label htmlFor="account-phone">Phone number</label>
                  <input id="account-phone" value={phone} maxLength={30} required onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
                  <label htmlFor="account-notes">Notes <span className="eh-account-field-note">(optional)</span></label>
                  <textarea id="account-notes" value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. mountain guide, preferred contact time, helpful details for bookings" />
                  <label htmlFor="account-emergency">Emergency contact <span className="eh-account-field-note">(optional)</span></label>
                  <input id="account-emergency" value={emergencyContact} maxLength={200} onChange={(event) => setEmergencyContact(event.target.value)} placeholder="Name and phone number" />
                  <div className="eh-account-form-actions">
                    <button type="submit" disabled={saving} className="eh-button eh-button--green">{saving ? 'Saving…' : 'Save changes'}</button>
                    <button type="button" disabled={saving} className="eh-account-cancel" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
                  </div>
                </form>
              )}
            </section>
          ) : (
            <section className="eh-account-card eh-account-security" aria-label="Account security">
              <div className="eh-account-security-head">
                <span className="eh-account-security-icon"><AccountIcon name="shield" size={29} /></span>
                <div><h3>Change your password</h3><p>Enter your current password and choose a new one.</p></div>
              </div>
              <form className="eh-account-form" onSubmit={savePassword}>
                <label htmlFor="current-password">Current password</label>
                <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} required onChange={(event) => setCurrentPassword(event.target.value)} />
                <label htmlFor="new-password">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                <p className="eh-account-field-hint">At least 8 characters.</p>
                <label htmlFor="confirm-new-password">Confirm new password</label>
                <input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                <div className="eh-account-form-actions">
                  <button type="submit" className="eh-button eh-button--green" disabled={saving}>{saving ? 'Updating…' : 'Change password'}</button>
                </div>
              </form>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
