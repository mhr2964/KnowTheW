import LegalFooterNav from '../components/LegalFooterNav';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated: July 2026</p>

      <p>
        By using KnowTheW, you agree to the terms below. If you don&apos;t agree, please don&apos;t use
        the site.
      </p>

      <h2>What KnowTheW is</h2>
      <p>
        KnowTheW is an informational and entertainment reference for WNBA statistics and
        analysis. It is provided &quot;as is,&quot; for personal, non-commercial use, without warranty
        of any kind. See <a href="/data-sources">Data Sources &amp; Attribution</a> for where
        the underlying stats come from.
      </p>

      <h2>Accuracy</h2>
      <p>
        We try to keep stats accurate and up to date, but KnowTheW makes no guarantee that any
        stat, ranking, comparison, or AI-generated summary is complete, current, or error-free.
        Don&apos;t rely on this site as the sole basis for any decision where accuracy matters
        (e.g. betting, fantasy scoring disputes, or reporting).
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Scrape, bulk-download, or systematically republish KnowTheW&apos;s own compiled data, analysis, or AI-generated content without permission.</li>
        <li>Attempt to disrupt, overload, or gain unauthorized access to the site or its infrastructure.</li>
        <li>Use the site in a way that violates any applicable law.</li>
      </ul>

      <h2>Third-party content and advertising</h2>
      <p>
        KnowTheW may display third-party advertising (including through Google AdSense). We
        aren&apos;t responsible for the content of third-party ads or the sites they link to. See
        our <a href="/privacy">Privacy Policy</a> for how ad networks may use cookies.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        KnowTheW and its operator aren&apos;t liable for any damages arising from your use of, or
        inability to use, the site, to the fullest extent permitted by law.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated as the site evolves. Continued use after a change means you
        accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to{' '}
        <a href="mailto:mhr2964@g.rit.edu">mhr2964@g.rit.edu</a>.
      </p>

      <LegalFooterNav current="/terms" />
    </div>
  );
}
