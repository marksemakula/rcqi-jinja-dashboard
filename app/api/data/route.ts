import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side proxy to the CQI Apps Script data service.
 * The token stays on the server; the browser only ever sees structured, de-identified records.
 */
export async function GET() {
  const url = process.env.RCQI_API_URL;
  const token = process.env.RCQI_API_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ ok: false, configured: false, reason: 'not-configured' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token }),
      redirect: 'follow',
      // Not held in Next's data cache: a failed background refresh there kept serving a day-old payload (18 Nov 2026).
      // The CDN still caches the response below for two minutes, and the data service caches its payload for one.
      cache: 'no-store',
      signal: AbortSignal.timeout(25000)
    });
    const text = await res.text();
    let json: { ok?: boolean; error?: string } & Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, configured: true, reason: 'invalid-response' }, { status: 502 });
    }
    if (!json.ok) {
      return NextResponse.json({ ok: false, configured: true, reason: json.error || 'upstream-error' }, { status: 502 });
    }
    return NextResponse.json({ ...json, configured: true }, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' } });
  } catch {
    return NextResponse.json({ ok: false, configured: true, reason: 'unreachable' }, { status: 502 });
  }
}
