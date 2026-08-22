import { useState } from 'react';

// One shared toolbar every stat-type tab renders through, so Export CSV/Study/Percentile land in
// the same spot regardless of tab. Previously 3 different hand-rolled containers (.stat-table-header,
// .gl-controls, .bref-toolbar) each positioned these differently -- see the mobile/table-normalization
// plan for the full inventory. `leading` is whatever tab-specific controls that tab needs (season
// select, split-type select, page-size select, game count, etc.); the trailing cluster is always in
// the same left-to-right order so a user learns one layout, not ten.
//
// Study/Export are tucked behind a "More" toggle on mobile only (CSS-driven -- see .toolbar-more* in
// responsive.css) -- neither is something you'd reach for mid-glance at a courtside phone, and they
// were the two extra controls making the mobile toolbar read as a wall of buttons. `display:contents`
// on the wrapper at desktop widths makes it invisible to layout, so nothing changes there.
export default function TableToolbar({ leading, showPercentile, percentileChecked, percentileLoading, onPercentileToggle, showStudy, onStudy, showExport, onExport }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = showStudy || showExport;

  return (
    <div className="stat-table-header">
      <div className="toolbar-leading">{leading}</div>
      <div className="toolbar-trailing">
        {showPercentile && (
          <label className="perc-toggle">
            <input type="checkbox" checked={percentileChecked} onChange={onPercentileToggle} />
            <span className="perc-toggle-track"><span className="perc-toggle-thumb" /></span>
            <span className="perc-toggle-label">{percentileLoading ? 'Loading…' : 'Percentiles'}</span>
          </label>
        )}
        {hasMore && (
          <div className="toolbar-more">
            <button
              type="button"
              className="toolbar-more-toggle"
              aria-expanded={moreOpen}
              aria-label="More table actions"
              onClick={() => setMoreOpen(v => !v)}
            >
              More <span aria-hidden="true">⋯</span>
            </button>
            {moreOpen && <div className="toolbar-more-backdrop" onClick={() => setMoreOpen(false)} />}
            <div className={`toolbar-more-menu${moreOpen ? ' open' : ''}`}>
              {showStudy && (
                <button type="button" className="study-trigger-btn" onClick={() => { setMoreOpen(false); onStudy(); }}>
                  Study this table
                </button>
              )}
              {showExport && (
                <button type="button" className="btn-ghost bref-export-btn" onClick={() => { setMoreOpen(false); onExport(); }}>
                  Export CSV
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
