import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, LoaderCircle, QrCode, X } from 'lucide-react';
import { MOBILE_APP_URL } from '../mobileAccess.js';
import './MobileAccess.css';

const DESKTOP_QUERY = '(min-width: 1024px) and (pointer: fine)';

export default function MobileAccess() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [qr, setQr] = useState('');
  const [qrError, setQrError] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const linkRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const change = () => setDesktop(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    let current = true;
    setQr('');
    setQrError(false);
    setCopyStatus('');
    if (!desktop || !expanded || dismissed) return undefined;
    import('qrcode').then((module) => (module.default || module).toDataURL(MOBILE_APP_URL, {
      width: 192, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#183c2e', light: '#ffffff' },
    })).then((value) => { if (current) setQr(value); })
      .catch(() => { if (current) setQrError(true); });
    return () => { current = false; };
  }, [desktop, expanded, dismissed]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(MOBILE_APP_URL);
      setCopyStatus('Link copied');
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopyStatus('Select and copy the link above.');
    }
  }

  if (!desktop || dismissed) return null;
  return <aside className={`mobile-access${expanded ? ' is-expanded' : ''}`} aria-label="Open FitTrack on your phone">
    <div className="mobile-access-header">
      <button className="mobile-access-toggle" type="button" aria-expanded={expanded} aria-controls="mobile-access-content" onClick={() => setExpanded((value) => !value)}>
        <span className="mobile-access-icon"><QrCode size={19}/></span>
        <span>Open on your phone</span>
        {expanded && <ChevronDown size={15}/>}
      </button>
      <button className="mobile-access-dismiss" type="button" aria-label="Dismiss phone access" onClick={() => setDismissed(true)}><X size={14}/></button>
    </div>
    {expanded && <div className="mobile-access-content" id="mobile-access-content">
      <div className="mobile-access-qr">
        {qr ? <img src={qr} width="192" height="192" alt="Scan this QR code to open FitTrack on your phone"/>
          : <div className="mobile-access-qr-loading" role="status">{qrError ? <p>QR unavailable. Copy the link below.</p> : <LoaderCircle className="mobile-access-spinner" size={22}/>}</div>}
      </div>
      <p className="mobile-access-instruction">Scan with your phone’s camera</p>
      <div className="mobile-access-link"><input ref={linkRef} readOnly value={MOBILE_APP_URL} aria-label="Mobile app link" onFocus={(event) => event.target.select()}/><button type="button" onClick={copyLink} aria-label="Copy mobile app link">{copyStatus === 'Link copied' ? <Check size={15}/> : <Copy size={15}/>}</button></div>
      <span className="mobile-access-copy-status" role="status">{copyStatus}</span>
      <p className="mobile-access-privacy">Progress stays in each browser.</p>
    </div>}
  </aside>;
}
