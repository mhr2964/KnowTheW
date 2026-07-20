import { useEffect, useRef } from 'react';

// Manual AdSense unit. Renders nothing until a slot ID is configured via env var, so local
// dev and the pre-approval build never show an empty ad box. Requests one impression per
// mount via the pushed ref, since React 18 StrictMode double-invokes effects in dev and
// adsbygoogle.push() throws on a duplicate push for the same <ins>.
export default function AdSlot({ slotId, className, style }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!slotId || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js not loaded yet (blocked by an ad blocker, etc.) — safe to ignore.
    }
  }, [slotId]);

  if (!slotId) return null;

  return (
    <ins
      className={`adsbygoogle${className ? ` ${className}` : ''}`}
      style={style ?? { display: 'block' }}
      data-ad-client="ca-pub-7287853597361020"
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
