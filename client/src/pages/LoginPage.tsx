import { useState, useActionState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { post, ApiError } from '../api/client';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    paymentStatus: string;
  };
}

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registered') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [formError, submitAction, isPending] = useActionState(
    async (_prev: string | null, _formData: FormData) => {
      const errors = validate(email, password);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return null;
      }

      try {
        const data = await post<LoginResponse>('/auth/login', { email: email.trim(), password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('firstName', data.user.firstName);
        localStorage.setItem('lastName', data.user.lastName);
        navigate('/predictions');
        return null;
      } catch (err) {
        if (err instanceof ApiError) return err.message;
        return 'Something went wrong. Please try again.';
      }
    },
    null,
  );

  return (
    <div className="auth-container">
      <h1>Sign in</h1>
      <p className="auth-subtitle">SPF 2026 — World Cup predictions</p>

      {justRegistered && (
        <p className="form-success">Account created! Sign in to continue.</p>
      )}

      <form action={submitAction} noValidate>
        <div className={`field${fieldErrors.email ? ' field--error' : ''}`}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
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
    </div>
  );
}
