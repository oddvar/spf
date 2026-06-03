import { useState, useActionState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, ApiError } from '../api/client';

interface UserSettings {
  firstName: string;
  lastName: string;
  email: string;
  paymentStatus: 'NO' | 'WANTS_TO_PAY' | 'HAS_PAID';
  theme: 'light' | 'dark';
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
    theme: 'light',
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
        localStorage.setItem('theme', settingsData.theme);
        document.documentElement.setAttribute('data-theme', settingsData.theme);
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
        await put<UserSettings>('/settings', {
          firstName: settings.firstName,
          lastName: settings.lastName,
          email: settings.email,
          paymentStatus: settings.paymentStatus,
          theme: settings.theme,
          currentPassword: settings.currentPassword || undefined,
          newPassword: settings.newPassword || undefined,
        });
        setSettings((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
        localStorage.setItem('firstName', settings.firstName);
        localStorage.setItem('lastName', settings.lastName);
        localStorage.setItem('theme', settings.theme);
        document.documentElement.setAttribute('data-theme', settings.theme);

        // Refetch canEdit in case it changed
        try {
          const matchData = await get<{ matches: any[]; canEdit: boolean }>('/matches');
          setCanEdit(matchData.canEdit);
        } catch {}

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
          <label>Payment Status</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isPending || (!canEdit && settings.paymentStatus !== 'HAS_PAID') ? 'not-allowed' : 'pointer', opacity: isPending || (!canEdit && settings.paymentStatus !== 'HAS_PAID') ? 0.5 : 1 }}>
              <input
                type="radio"
                name="paymentStatus"
                value="NO"
                checked={settings.paymentStatus === 'NO'}
                onChange={(e) => setSettings({ ...settings, paymentStatus: e.target.value as 'NO' | 'WANTS_TO_PAY' })}
                disabled={isPending || (!canEdit && settings.paymentStatus !== 'HAS_PAID')}
              />
              <span>I'm not entering the paid competition</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isPending || !canEdit ? 'not-allowed' : 'pointer', opacity: isPending || !canEdit ? 0.5 : 1 }}>
              <input
                type="radio"
                name="paymentStatus"
                value="WANTS_TO_PAY"
                checked={settings.paymentStatus === 'WANTS_TO_PAY'}
                onChange={(e) => setSettings({ ...settings, paymentStatus: e.target.value as 'NO' | 'WANTS_TO_PAY' })}
                disabled={isPending || !canEdit}
              />
              <span>I want to join — I'll pay soon</span>
            </label>
          </div>
          {!canEdit && (
            <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '8px', padding: '8px 0' }}>
              The competition has now started.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' })}
            disabled={isPending}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
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
