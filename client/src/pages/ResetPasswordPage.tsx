import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { post, get, ApiError } from '../api/client';
import spfLogo from '../assets/spf.png';

type FieldErrors = { password?: string; confirmPassword?: string };

function validate(password: string, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setFormError('Reset token not found. Please use the link from your email.');
      setIsValidating(false);
      return;
    }

    const verifyToken = async () => {
      try {
        await get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        setTokenValid(true);
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError('Invalid or expired reset token. Please request a new one.');
        }
      } finally {
        setIsValidating(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validate(password, confirmPassword);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsPending(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const data = await post<{ message: string }>('/auth/reset-password', {
        token,
        password,
      });
      setFormSuccess(data.message);
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/login'), 3000);
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

  return (
    <div className="auth-container">
      <img src={spfLogo} alt="SPF 2026" className="auth-logo" />
      <h1>Reset password</h1>
      <p className="auth-subtitle">SPF 2026 — World Cup predictions</p>

      {isValidating && <p>Verifying reset token...</p>}

      {!isValidating && !tokenValid && !formSuccess && (
        <p style={{ color: '#cc0000' }}>{formError}</p>
      )}

      {!isValidating && tokenValid && (
        <form onSubmit={handleSubmit}>
          <div className={`field${fieldErrors.password ? ' field--error' : ''}`}>
            <label htmlFor="password">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              autoComplete="new-password"
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

          <div className={`field${fieldErrors.confirmPassword ? ' field--error' : ''}`}>
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
              aria-invalid={!!fieldErrors.confirmPassword}
            />
            {fieldErrors.confirmPassword && (
              <span id="confirm-password-error" className="field-error">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          {formError && <p className="form-error">{formError}</p>}
          {formSuccess && <p className="form-success">{formSuccess}</p>}

          <button type="submit" disabled={isPending || formSuccess !== null} className="btn-primary">
            {isPending ? 'Resetting…' : formSuccess ? 'Redirecting to login…' : 'Reset password'}
          </button>
        </form>
      )}

      <p className="auth-footer">
        Remember your password? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
