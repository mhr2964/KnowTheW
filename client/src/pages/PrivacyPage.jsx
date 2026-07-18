import LegalFooterNav from '../components/LegalFooterNav';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: July 2026</p>

      <p>
        This policy explains what information KnowTheW collects and how it&apos;s used. KnowTheW
        does not require an account and does not collect personal information beyond what&apos;s
        described below.
      </p>

      <h2>Information we collect</h2>
      <p>
        KnowTheW does not have user accounts, logins, or forms that collect personal
        information. Standard server logs (IP address, browser type, pages visited, timestamp)
        may be recorded automatically by hosting infrastructure for security and reliability
        purposes, as is standard for any website.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        KnowTheW uses Google Analytics to understand aggregate traffic (e.g. which pages are
        visited, roughly how many people visit). Google Analytics uses cookies or similar
        identifiers in the visitor&apos;s browser to distinguish sessions and visits; no
        personal information is collected beyond what Google Analytics gathers by default.
      </p>
      <p>
        KnowTheW may also display advertising through third-party ad networks, including
        Google AdSense. Google and its partners may use cookies to serve ads based on a
        visitor&apos;s prior visits to this or other websites. Visitors can opt out of
        personalized advertising by visiting{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
          Google&apos;s Ads Settings
        </a>{' '}
        or{' '}
        <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">
          aboutads.info
        </a>.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        KnowTheW is not directed at children under 13 and does not knowingly collect
        information from them.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        This policy may be updated as the site adds features (such as accounts or premium
        subscriptions). Material changes will be reflected here with an updated date.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to{' '}
        <a href="mailto:mhr2964@g.rit.edu">mhr2964@g.rit.edu</a>.
      </p>

      <LegalFooterNav current="/privacy" />
    </div>
  );
}
