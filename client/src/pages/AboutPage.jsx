import LegalFooterNav from '../components/LegalFooterNav';

export default function AboutPage() {
  return (
    <div className="legal-page">
      <h1>About KnowTheW</h1>
      <p className="legal-updated">Last updated: July 2026</p>

      <p>
        KnowTheW is an independent WNBA stats and analytics reference. It brings together
        career and season stats, game logs, advanced metrics, and playstyle analysis for
        WNBA players and teams back to the league&apos;s founding in 1997, along with tools for
        comparing players and studying stat lines.
      </p>

      <h2>Independent project</h2>
      <p>
        KnowTheW is built and run independently. It is not affiliated with, endorsed by, or
        operated on behalf of the WNBA, any WNBA team, or ESPN. Team and player names appear
        here for factual, informational reference only. See our <a href="/data-sources">Data
        Sources &amp; Attribution</a> page for details on where the underlying stats come from.
      </p>

      <h2>AI-assisted content</h2>
      <p>
        Some player comparison grades and team history narratives on this site are generated
        with the help of AI and are labeled as such where they appear. They&apos;re meant as a
        starting point for analysis, not a substitute for verifying the underlying numbers
        yourself.
      </p>

      <h2>Feedback</h2>
      <p>
        Found a stat that looks wrong, or have a suggestion? Reach out at{' '}
        <a href="mailto:mhr2964@g.rit.edu">mhr2964@g.rit.edu</a>.
      </p>

      <LegalFooterNav current="/about" />
    </div>
  );
}
