import OnOffTab from './OnOffTab';

export default function PlayByPlayTab({ playerId, availableSeasons }) {
  return (
    <div className="pbp-tab">
      <section className="pbp-section">
        <h3 className="pbp-section-header">On/Off Net Rating</h3>
        <OnOffTab playerId={playerId} availableSeasons={availableSeasons} />
      </section>
    </div>
  );
}
