import './FitTrackLogo.css';

export default function FitTrackLogo({ className = '', markOnly = false, inverse = false }) {
  return <span className={`fittrack-logo${inverse ? ' fittrack-logo--inverse' : ''} ${className}`} role="img" aria-label="FitTrack">
    <img className="fittrack-logo__symbol" src="/fittrack-symbol.svg" width="36" height="36" alt="" aria-hidden="true" draggable="false"/>
    {!markOnly && <span className="fittrack-logo__wordmark" aria-hidden="true">fit<span>track</span></span>}
  </span>;
}
