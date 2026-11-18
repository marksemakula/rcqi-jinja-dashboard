'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { SectionTitle } from '../ui';
import type { TabProps } from './shared';
import { palette } from '@/lib/palette';
import { RCSFI, safeUrl, type RcsfiConfig } from '@/lib/rcsfi';

/** The RCSFI page: a link to the RCSFI dashboard, a link to the Assisted Client Interview (ACI) form and its QR code. */
export default function Rcsfi(_props: TabProps & { config?: RcsfiConfig }) {
  const config = _props.config || RCSFI;
  const dashboardUrl = safeUrl(config.dashboardUrl);
  const aciUrl = safeUrl(config.aciUrl);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!aciUrl) { setQr(null); return; }
    QRCode.toDataURL(aciUrl, { margin: 2, width: 720, errorCorrectionLevel: 'M', color: { dark: palette.ag900, light: palette.card } }).then(setQr).catch(() => setQr(null));
  }, [aciUrl]);
  const pending = 'The link will appear here once it has been added to the dashboard.';

  return (
    <div className="tab rcsfi-tab">
      <div className="print-hide">
        <SectionTitle title={config.short} text={`${config.fullName ? `${config.fullName}. ` : ''}The RCSFI dashboard and the Assisted Client Interview (ACI) form for health facilities across Busoga. Scan the QR code with a phone camera to open the ACI form, or print it for the facility.`} />
      </div>
      <div className="rcsfi-grid">
        <section className="card rcsfi-card print-hide" aria-label="RCSFI dashboard">
          <header className="card-head"><div><h3>RCSFI dashboard</h3><p className="card-sub">{config.dashboardAbout || 'Results from the RCSFI client interviews.'}</p></div></header>
          <div className="rcsfi-body">
            {dashboardUrl ? (
              <>
                <div className="form-actions"><a className="btn rcsfi-dashboard" href={dashboardUrl} target="_blank" rel="noopener noreferrer">Open the RCSFI dashboard</a></div>
                {config.signIn && <p className="muted rcsfi-signin">{config.signIn}</p>}
              </>
            ) : <p className="muted rcsfi-pending">{pending}</p>}
          </div>
        </section>
        <section className="card rcsfi-card rcsfi-aci" aria-label="Assisted Client Interview (ACI) form">
          <header className="card-head"><div><h3>Assisted Client Interview (ACI) form</h3><p className="card-sub">The interview form, completed with each client.</p></div></header>
          <div className="rcsfi-body">
            <div className="rcsfi-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr ? <img src={qr} alt="QR code that opens the Assisted Client Interview (ACI) form" width={240} height={240} /> : <div className="qr-placeholder">QR code</div>}
              <p className="rcsfi-qr-caption">Scan to open the ACI form</p>
            </div>
            {aciUrl ? (
              <div className="form-actions print-hide">
                <a className="btn rcsfi-aci-link" href={aciUrl} target="_blank" rel="noopener noreferrer">Open the ACI form</a>
                <button type="button" className="btn ghost" onClick={() => { navigator.clipboard?.writeText(aciUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>{copied ? 'Link copied' : 'Copy link'}</button>
                {qr && <a className="btn ghost" href={qr} download="rcsfi-aci-qr-code.png">Download QR</a>}
                {qr && <button type="button" className="btn ghost" onClick={() => window.print()}>Print QR</button>}
              </div>
            ) : <p className="muted rcsfi-pending print-hide">{pending}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
