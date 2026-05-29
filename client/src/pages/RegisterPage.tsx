import { useState, useActionState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post, ApiError } from '../api/client';

type PaymentStatus = 'NO' | 'WANTS_TO_PAY' | 'HAS_PAID';

interface FormFields {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  paymentStatus: PaymentStatus;
}

type FieldErrors = Partial<Record<keyof FormFields, string>>;

function validate(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.firstName.trim()) errors.firstName = 'First name is required';
  if (!fields.lastName.trim()) errors.lastName = 'Last name is required';
  if (!fields.username.trim()) errors.username = 'Username is required';
  if (!fields.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Please enter a valid email address';
  }
  if (!fields.password) {
    errors.password = 'Password is required';
  } else if (fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (!fields.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fields, setFields] = useState<FormFields>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    paymentStatus: 'NO',
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const [formError, submitAction, isPending] = useActionState(
    async (_prev: string | null, _formData: FormData) => {
      const errors = validate(fields);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return null;
      }

      try {
        await post('/auth/register', {
          firstName: fields.firstName.trim(),
          lastName: fields.lastName.trim(),
          username: fields.username.trim(),
          email: fields.email.trim(),
          password: fields.password,
          paymentStatus: fields.paymentStatus,
        });
        navigate('/login?registered=1');
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
      <h1>Create account</h1>
      <p className="auth-subtitle">Join SPF 2026 — World Cup predictions</p>

      <form action={submitAction} noValidate>
        <div className="form-row">
          <Field
            label="First name"
            id="firstName"
            value={fields.firstName}
            error={fieldErrors.firstName}
            onChange={(v) => updateField('firstName', v)}
          />
          <Field
            label="Last name"
            id="lastName"
            value={fields.lastName}
            error={fieldErrors.lastName}
            onChange={(v) => updateField('lastName', v)}
          />
        </div>

        <Field
          label="Username"
          id="username"
          value={fields.username}
          error={fieldErrors.username}
          onChange={(v) => updateField('username', v)}
          autoComplete="username"
        />

        <Field
          label="Email"
          id="email"
          type="email"
          value={fields.email}
          error={fieldErrors.email}
          onChange={(v) => updateField('email', v)}
          autoComplete="email"
        />

        <Field
          label="Password"
          id="password"
          type="password"
          value={fields.password}
          error={fieldErrors.password}
          onChange={(v) => updateField('password', v)}
          autoComplete="new-password"
        />

        <Field
          label="Confirm password"
          id="confirmPassword"
          type="password"
          value={fields.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChange={(v) => updateField('confirmPassword', v)}
          autoComplete="new-password"
        />

        <div className="field">
          <label>Competition entry</label>
          <div className="radio-group">
            {(
              [
                ['NO', "I'm not entering the paid competition"],
                ['WANTS_TO_PAY', "I want to join — I'll pay soon"],
              ] as [PaymentStatus, string][]
            ).map(([value, label]) => (
              <label key={value} className="radio-label">
                <input
                  type="radio"
                  name="paymentStatus"
                  value={value}
                  checked={fields.paymentStatus === value}
                  onChange={() => updateField('paymentStatus', value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}

function Field({ label, id, value, error, onChange, type = 'text', autoComplete }: FieldProps) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
