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
  /** The Assisted Client Interview (ACI) form. The QR code on the page opens this address. */
  aciUrl: string;
}

export const RCSFI: RcsfiConfig = {
  short: 'RCSFI',
  fullName: null,
  dashboardUrl: '',
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
