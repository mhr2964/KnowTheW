import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageMeta('Log In — KnowTheW', 'Log in to your KnowTheW account.', { noindex: true });
    return resetPageMeta;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { ok, data } = await login(username, password);
    setSubmitting(false);
    if (ok) {
      navigate('/account');
    } else {
      setError(data?.error ?? 'Something went wrong — please try again.');
    }
  };

  return (
    <div className="auth-page">
      <h1>Log In</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="login-username">Username</label>
        <input
          id="login-username"
          className="auth-input"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <label className="auth-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="auth-input"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <p className="auth-switch">
        Don&apos;t have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
