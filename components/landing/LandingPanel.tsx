'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import FacilitySearch, { type FacilityOption } from '../FacilitySearch';
import { ALL, searchFromFilters } from '@/lib/filters';

export interface LandingFacility {
  id: string;
  name: string;
  district: string;
  level: string | null;
  ownership: string | null;
  subcounty: string | null;
  functional: boolean;
}

const districtLabel = (d: string) => (d === 'Jinja City' ? d : `${d} District`);
const plural = (n: number) => `${n} health ${n === 1 ? 'facility' : 'facilities'}`;

/** The address of the dashboard with a district and facility applied (none gives the whole region). */
export function dashboardHref(district: string, facility: LandingFacility | null): string {
  return '/dashboard' + searchFromFilters(facility ? { district: facility.district, facility: facility.name } : { district, facility: ALL });
}

/**
 * The right half of the landing page: the coat of arms, the programme title and a facility filter over every DHIS2
 * facility in Busoga. Choosing a district narrows the facilities; choosing a facility sets its district.
 */
export default function LandingPanel({ facilities, districts, pulled }: { facilities: LandingFacility[]; districts: string[]; pulled: string }) {
  const [district, setDistrict] = useState<string>(ALL);
  const [facilityId, setFacilityId] = useState<string>('');
  const facility = useMemo(() => facilities.find((f) => f.id === facilityId) || null, [facilities, facilityId]);

  const inDistrict = useMemo(() => facilities.filter((f) => district === ALL || f.district === district), [facilities, district]);
  const options: FacilityOption[] = useMemo(() => inDistrict.map((f) => ({ id: f.id, name: f.name, district: f.district, level: f.level })), [inDistrict]);

  const chooseDistrict = (d: string) => {
    setDistrict(d);
    if (facility && d !== ALL && facility.district !== d) setFacilityId('');
  };
  const chooseFacility = (_name: string, option?: FacilityOption) => {
    if (!option || !option.id) { setFacilityId(''); return; }
    const f = facilities.find((x) => x.id === option.id);
    if (!f) return;
    setFacilityId(f.id);
    setDistrict(f.district);
  };

  const href = dashboardHref(district, facility);
  const scope = facility ? `${facility.name}, ${districtLabel(facility.district)}` : district !== ALL ? districtLabel(district) : 'the whole Busoga region';
  const details = facility ? [facility.level, facility.ownership, facility.subcounty].filter(Boolean).join(', ') : '';

  return (
    <section className="landing-panel">
      <div className="landing-inner">
        <Image src="/uganda-coat-of-arms.png" alt="Coat of arms of the Republic of Uganda" width={424} height={459} priority className="landing-arms" />
        <p className="landing-ministry">MINISTRY OF HEALTH</p>
        <p className="landing-hospital">Jinja Regional Referral Hospital</p>
        <h1>Continuous Quality Improvement</h1>
        <p className="landing-lead">
          Results from the CQI tools for every health facility in Busoga: patient safety, hand hygiene, infection prevention and
          control, 5S, HFQAP and the QI Documentation Journal.
        </p>

        <div className="landing-filter" role="search" aria-label="Choose a health facility">
          <h2>Choose a health facility</h2>
          <div className="landing-fields">
            <label className="select landing-district">
              <span>District</span>
              <select value={district} onChange={(e) => chooseDistrict(e.target.value)}>
                <option value={ALL}>All districts</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <FacilitySearch
              label="Health facility"
              className="landing-search"
              value={facility ? facility.name : ALL}
              selectedId={facility ? facility.id : undefined}
              options={options}
              onChange={chooseFacility}
              allLabel="All facilities"
            />
          </div>
          <p className="landing-count">
            {district === ALL ? `${plural(inDistrict.length)} from DHIS2` : `${plural(inDistrict.length)} in ${districtLabel(district)}`}
          </p>
          <div className="landing-choice" aria-live="polite">
            <p className="landing-scope">The dashboard opens for <strong>{scope}</strong>.</p>
            {details && <p className="landing-details">{details}{facility && !facility.functional ? '. Recorded as not functional in DHIS2.' : ''}</p>}
          </div>
          <div className="landing-actions">
            <Link className="btn landing-open" href={href}>Open the dashboard</Link>
            <Link className="btn ghost" href="/dashboard">View the whole region</Link>
          </div>
        </div>

        <p className="landing-source">
          Facility list from Uganda eHMIS (DHIS2), {pulled}. <Link href="/dashboard#forms">Submit a CQI form</Link>
        </p>
      </div>
    </section>
  );
}
