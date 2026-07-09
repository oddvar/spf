import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { post, ApiError } from '../api/client';
import spfLogo from '../assets/spf.png';

interface LoginResponse {
  token: string;
  canViewOthers: boolean;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    paymentStatus: string;
    canEdit: boolean;
    canViewOthers: boolean;
  };
}

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';
  return errors;
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  return undefined;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailError, setForgotEmailError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotPending, setForgotPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validate(email, password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsPending(true);
    setFormError(null);

    try {
      const data = await post<LoginResponse>('/auth/login', { email: email.trim(), password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('firstName', data.user.firstName);
      localStorage.setItem('lastName', data.user.lastName);
      localStorage.setItem('email', email.trim());
      localStorage.setItem('canEdit', String(data.user.canEdit));
      localStorage.setItem('canViewOthers', String(data.canViewOthers));
      navigate('/predictions');
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const error = validateEmail(forgotEmail);
    if (error) {
      setForgotEmailError(error);
      return;
    }

    setForgotPending(true);
    setForgotMessage('');

    try {
      await post('/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotMessage('Password reset is not yet integrated with an email service — the administrator will send you the link manually.');
      setForgotEmail('');
      setForgotEmailError('');
    } catch (err) {
      if (err instanceof ApiError) {
        setForgotMessage('Password reset is not yet integrated with an email service — the administrator will send you the link manually.');
      } else {
        setForgotMessage('Password reset is not yet integrated with an email service — the administrator will send you the link manually.');
      }
    } finally {
      setForgotPending(false);
    }
  };

  return (
    <div className="auth-container">
      <img src={spfLogo} alt="SPF 2026" className="auth-logo" />
      <h1>Sign in</h1>
      <p className="auth-subtitle">SPF 2026 — World Cup predictions</p>

      {justRegistered && (
        <p className="form-success">Account created! Sign in to continue.</p>
      )}

      <form onSubmit={handleSubmit}>
        <div className={`field${fieldErrors.email ? ' field--error' : ''}`}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <span id="email-error" className="field-error">
              {fieldErrors.email}
            </span>
          )}
        </div>

        <div className={`field${fieldErrors.password ? ' field--error' : ''}`}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            aria-invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && (
            <span id="password-error" className="field-error">
              {fieldErrors.password}
            </span>
          )}
        </div>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account? <Link to="/register">Create one</Link>
      </p>

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '0.9rem',
          }}
        >
          Forgot password?
        </button>
      </p>

      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          }}>
            <h2 style={{ marginTop: 0 }}>Reset password</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleForgotPassword}>
              {!forgotMessage && (
                <>
                  <div className={`field${forgotEmailError ? ' field--error' : ''}`}>
                    <label htmlFor="forgot-email">Email</label>
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      value={forgotEmail}
                      autoComplete="email"
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setForgotEmailError('');
                      }}
                      aria-describedby={forgotEmailError ? 'forgot-email-error' : undefined}
                      aria-invalid={!!forgotEmailError}
                    />
                    {forgotEmailError && (
                      <span id="forgot-email-error" className="field-error">
                        {forgotEmailError}
                      </span>
                    )}
                  </div>

                  <button type="submit" disabled={forgotPending} className="btn-primary" style={{ marginTop: '1rem' }}>
                    {forgotPending ? 'Sending…' : 'Send reset link'}
                  </button>
                </>
              )}

              {forgotMessage && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center' }}>
                  {forgotMessage}
                </p>
              )}

              {!forgotMessage && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotEmail('');
                    setForgotEmailError('');
                    setForgotMessage('');
                  }}
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Back
                </button>
              )}

              {forgotMessage && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotEmail('');
                    setForgotEmailError('');
                    setForgotMessage('');
                  }}
                  style={{
                    width: '100%',
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  Back to login
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
