import { useState, useEffect } from 'react';

export default function PremiumBanner() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    const handler = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  return (
    <>
      <div className="premium-banner">
        <div className="premium-text">
          <span className="premium-label">PREMIUM</span>
          <h3>Advanced stats, historical data &amp; draft rankings</h3>
          <p>Everything you need to go deeper on WNBA analytics.</p>
        </div>
        <div className="premium-cta">
          <span className="premium-price">$4.99 / mo</span>
          <button type="button" className="premium-btn" onClick={() => setShowModal(true)}>
            Get Premium
          </button>
        </div>
      </div>
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>KnowTheW Premium</h3>
            <p className="premium-soon">Coming soon — checkout is not yet wired up.</p>
            <button type="button" className="modal-close" onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
