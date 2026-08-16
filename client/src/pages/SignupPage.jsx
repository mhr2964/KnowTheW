import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageMeta('Sign Up — KnowTheW', 'Create a KnowTheW account.', { noindex: true });
    return resetPageMeta;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { ok, data } = await signup(username, password);
    setSubmitting(false);
    if (ok) {
      navigate('/account');
    } else {
      setError(data?.error ?? 'Something went wrong — please try again.');
    }
  };

  return (
    <div className="auth-page">
      <h1>Sign Up</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          className="auth-input"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <label className="auth-label" htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          className="auth-input"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
          {submitting ? 'Signing up…' : 'Sign Up'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
