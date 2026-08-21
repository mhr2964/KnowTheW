// One shared toolbar every stat-type tab renders through, so Export CSV/Study/Percentile land in
// the same spot regardless of tab. Previously 3 different hand-rolled containers (.stat-table-header,
// .gl-controls, .bref-toolbar) each positioned these differently -- see the mobile/table-normalization
// plan for the full inventory. `leading` is whatever tab-specific controls that tab needs (season
// select, split-type select, page-size select, game count, etc.); the trailing cluster is always in
// the same left-to-right order so a user learns one layout, not ten.
export default function TableToolbar({ leading, showPercentile, percentileChecked, percentileLoading, onPercentileToggle, showStudy, onStudy, showExport, onExport }) {
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
        {showStudy && (
          <button type="button" className="study-trigger-btn" onClick={onStudy}>
            Study this table
          </button>
        )}
        {showExport && (
          <button type="button" className="btn-ghost bref-export-btn" onClick={onExport}>
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}
