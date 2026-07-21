// Just the Change link now — team/jersey text was dropped per user feedback (redundant next to
// the bigger photo, and the horizontal-line section dividers it used to help anchor looked odd
// once the layout changed around it). Kept as its own component rather than inlining the button
// directly in CompareVerdict so loading/error states stay in one place.
export default function PlayerMeta({ loading, onChangeSide }) {
  if (loading) return <div className="compare-hero-meta-skeleton" aria-hidden="true" />;
  return (
    <button type="button" className="compare-change-link" onClick={onChangeSide}>Change</button>
  );
}
