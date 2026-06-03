import { useState, useActionState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, ApiError } from '../api/client';

interface UserSettings {
  firstName: string;
  lastName: string;
  email: string;
  paymentStatus: 'NO' | 'WANTS_TO_PAY' | 'HAS_PAID';
  canEdit?: boolean;
}

interface FormState extends UserSettings {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    paymentStatus: 'NO',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(true);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('firstName');
    localStorage.removeItem('lastName');
    localStorage.removeItem('canEdit');
    navigate('/login');
  }

  useEffect(() => {
    Promise.all([
      get<UserSettings>('/settings'),
      get<{ matches: any[]; canEdit: boolean }>('/matches'),
    ])
      .then(([settingsData, matchData]) => {
        setSettings({
          ...settingsData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setCanEdit(matchData.canEdit);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const [formError, submitAction, isPending] = useActionState(
    async (_prev: string | null, _formData: FormData) => {
      // Validate password fields if changing password
      if (settings.newPassword) {
        if (!settings.currentPassword) {
          return 'Current password is required to change password';
        }
        if (settings.newPassword.length < 8) {
          return 'New password must be at least 8 characters';
        }
        if (settings.newPassword !== settings.confirmPassword) {
          return 'Passwords do not match';
        }
      }

      try {
        const updated = await put<UserSettings>('/settings', {
          firstName: settings.firstName,
          lastName: settings.lastName,
          email: settings.email,
          paymentStatus: settings.paymentStatus,
          currentPassword: settings.currentPassword || undefined,
          newPassword: settings.newPassword || undefined,
        });
        setSettings({
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          paymentStatus: updated.paymentStatus,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        localStorage.setItem('firstName', updated.firstName);
        localStorage.setItem('lastName', updated.lastName);
        return 'Settings saved successfully!';
      } catch (err) {
        if (err instanceof ApiError) return err.message;
        return 'Failed to save settings. Please try again.';
      }
    },
    null,
  );

  if (loading) return <div className="predictions-loading">Loading…</div>;

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <h1>Settings</h1>
          <p className="predictions-subtitle">Update your account information</p>
        </div>
      </div>

      <form action={submitAction} className="settings-form">
        <div className="form-row">
          <div className="field">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              value={settings.firstName}
              onChange={(e) => setSettings({ ...settings, firstName: e.target.value })}
              disabled={isPending}
            />
          </div>
          <div className="field">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              type="text"
              value={settings.lastName}
              onChange={(e) => setSettings({ ...settings, lastName: e.target.value })}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            disabled={isPending}
          />
        </div>

        <div className="field">
          <label htmlFor="paymentStatus">Payment Status</label>
          <select
            id="paymentStatus"
            value={settings.paymentStatus}
            onChange={(e) => setSettings({ ...settings, paymentStatus: e.target.value as 'NO' | 'WANTS_TO_PAY' | 'HAS_PAID' })}
            disabled={isPending || !canEdit || settings.paymentStatus === 'HAS_PAID'}
          >
            <option value="NO">I'm not entering the paid competition</option>
            <option value="WANTS_TO_PAY">I want to join — I'll pay soon</option>
          </select>
          {!canEdit && (
            <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '8px', padding: '8px 0' }}>
              The competition has now started.
            </p>
          )}
        </div>

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--text-h)' }}>Change Password (optional)</h3>

          <div className="field">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={settings.currentPassword}
              onChange={(e) => setSettings({ ...settings, currentPassword: e.target.value })}
              disabled={isPending}
              placeholder="Leave blank if not changing password"
            />
          </div>

          <div className="field">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={settings.newPassword}
              onChange={(e) => setSettings({ ...settings, newPassword: e.target.value })}
              disabled={isPending}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={settings.confirmPassword}
              onChange={(e) => setSettings({ ...settings, confirmPassword: e.target.value })}
              disabled={isPending}
            />
          </div>
        </div>

        {formError && <p className={formError.includes('success') ? 'form-success' : 'form-error'}>{formError}</p>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Settings'}
          </button>
          <button type="button" className="btn-secondary" onClick={logout}>
            Log Out
          </button>
        </div>
      </form>
    </div>
  );
}
