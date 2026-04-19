import { useState, useEffect, useCallback } from 'react';

function FieldToggle({ col, side, active, onToggle }) {
  return (
    <button
      type="button"
      className={`field-btn ${active ? 'active' : ''}`}
      onClick={() => onToggle(col.key, side)}
    >
      {col.label}
    </button>
  );
}

function CardSide({ card, fields, columns }) {
  return (
    <div className="card-content">
      {fields.map(key => {
        const col = columns.find(c => c.key === key);
        const val = card[key];
        if (col?.type === 'image' && val) {
          return <img key={key} src={val} alt="" className="card-img" />;
        }
        return (
          <div key={key} className="card-field">
            <span className="card-field-label">{col?.label}</span>
            <span className="card-field-value">{val || '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StudyFlow({ data, columns, deckName, onClose, onSave, initialFrontFields, initialBackFields }) {
  const [phase, setPhase] = useState('picker');
  const [frontFields, setFrontFields] = useState(initialFrontFields || []);
  const [backFields, setBackFields] = useState(initialBackFields || []);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const toggle = (key, side) => {
    const setter = side === 'front' ? setFrontFields : setBackFields;
    setter(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const startStudying = () => {
    if (!frontFields.length || !backFields.length) return;
    onSave({
      id: Date.now().toString(),
      name: deckName,
      studiedAt: Date.now(),
      data,
      columns,
      frontFields,
      backFields,
      totalCards: data.length,
    });
    setCardIndex(0);
    setFlipped(false);
    setPhase('cards');
  };

  const next = useCallback(() => {
    if (cardIndex < data.length - 1) { setCardIndex(i => i + 1); setFlipped(false); }
    else setPhase('done');
  }, [cardIndex, data.length]);

  const prev = useCallback(() => {
    if (cardIndex > 0) { setCardIndex(i => i - 1); setFlipped(false); }
  }, [cardIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (phase !== 'cards') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, next, prev, onClose]);

  if (phase === 'picker') {
    const canStart = frontFields.length > 0 && backFields.length > 0;
    return (
      <div className="study-overlay" onClick={onClose}>
        <div className="picker-modal" onClick={e => e.stopPropagation()}>
          <div className="picker-header">
            <div>
              <h2>Set up your deck</h2>
              <span className="picker-subtitle">{deckName} · {data.length} cards</span>
            </div>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="picker-body">
            <div className="picker-side">
              <h3>Front <span className="side-hint">what you see first</span></h3>
              <div className="field-buttons">
                {columns.map(col => (
                  <FieldToggle key={col.key} col={col} side="front" active={frontFields.includes(col.key)} onToggle={toggle} />
                ))}
              </div>
            </div>
            <div className="picker-arrow">→</div>
            <div className="picker-side">
              <h3>Back <span className="side-hint">what you&apos;re recalling</span></h3>
              <div className="field-buttons">
                {columns.map(col => (
                  <FieldToggle key={col.key} col={col} side="back" active={backFields.includes(col.key)} onToggle={toggle} />
                ))}
              </div>
            </div>
          </div>
          <div className="picker-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={!canStart} onClick={startStudying}>
              Start Studying
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'cards') {
    const card = data[cardIndex];
    return (
      <div className="study-overlay">
        <div className="study-fullscreen">
          <div className="study-top-bar">
            <button type="button" className="btn-ghost" onClick={onClose}>✕ Exit</button>
            <div className="study-progress-wrap">
              <div className="study-progress-bar">
                <div className="study-progress-fill" style={{ width: `${((cardIndex + 1) / data.length) * 100}%` }} />
              </div>
              <span className="study-progress-label">{cardIndex + 1} / {data.length}</span>
            </div>
            <span className="study-deck-chip">{deckName}</span>
          </div>

          <div className="card-area">
            <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
              <div className="flashcard-inner">
                <div className="flashcard-face flashcard-front">
                  <CardSide card={card} fields={frontFields} columns={columns} />
                  <span className="flip-hint">click or space to flip</span>
                </div>
                <div className="flashcard-face flashcard-back">
                  <CardSide card={card} fields={backFields} columns={columns} />
                </div>
              </div>
            </div>
          </div>

          <div className="card-nav">
            <button type="button" className="nav-btn" onClick={prev} disabled={cardIndex === 0}>← Prev</button>
            <button type="button" className="nav-btn nav-btn-next" onClick={next}>
              {cardIndex < data.length - 1 ? 'Next →' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="study-overlay">
      <div className="done-modal">
        <div className="done-check">✓</div>
        <h2>Deck complete!</h2>
        <p className="done-sub">{deckName} · {data.length} cards</p>
        <div className="done-actions">
          <button type="button" className="btn-ghost" onClick={() => { setCardIndex(0); setFlipped(false); setPhase('cards'); }}>
            Study Again
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
