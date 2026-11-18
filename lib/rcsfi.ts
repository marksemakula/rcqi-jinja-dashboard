/**
 * The RCSFI links shown on the RCSFI page of the dashboard. Mark supplies the two addresses and the full name; until
 * then the page says the links are still to be added and shows no QR code.
 */
export interface RcsfiConfig {
  /** The abbreviation used on the dashboard. */
  short: string;
  /** The programme's full name, shown under the title once known. */
  fullName: string | null;
  /** The RCSFI dashboard. */
  dashboardUrl: string;
  /** What the dashboard is, shown under its card title. */
  dashboardAbout: string;
  /**
   * How to sign in. The dashboard needs a login: never put the user name or password here, because this site and its
   * code are public. The secretariat shares the login privately.
   */
  signIn: string;
  /** The Assisted Client Interview (ACI) form. The QR code on the page opens this address. */
  aciUrl: string;
}

export const RCSFI: RcsfiConfig = {
  short: 'RCSFI',
  fullName: null,
  // The Ministry of Health Client Satisfaction Feedback (CSF) dashboard (Mark, 18 Nov 2026).
  dashboardUrl: 'https://odk.health.go.ug/dashboard',
  dashboardAbout: 'The Ministry of Health Client Satisfaction Feedback dashboard: client satisfaction scores and trends, concerns, comments and the action plan matrix, by region, district and facility.',
  signIn: 'Sign-in required. Ask the regional CQI secretariat (JRRH Public Health Department) for the Busoga login.',
  aciUrl: ''
};

/** Only a full https address is used as a link or put in the QR code. */
export const safeUrl = (u: string | null | undefined): string => {
  const t = (u || '').trim();
  try {
    const url = new URL(t);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};
