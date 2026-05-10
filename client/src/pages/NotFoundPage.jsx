import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <p className="status-msg">Page not found.</p>
      <button type="button" className="back-btn" onClick={() => navigate('/')}>← Go home</button>
    </div>
  );
}
