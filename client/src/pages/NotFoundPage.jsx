import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPageMeta, resetPageMeta } from '../lib/pageMeta';

export default function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    setPageMeta('Page not found — KnowTheW', 'This page doesn’t exist on KnowTheW.', { noindex: true });
    return resetPageMeta;
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <p className="status-msg">Page not found.</p>
      <button type="button" className="back-btn" onClick={() => navigate('/')}>← Go home</button>
    </div>
  );
}
