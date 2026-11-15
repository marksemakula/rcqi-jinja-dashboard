/**
 * The DHIS2 facility directory for the landing page, read on the server so the browser only receives the fields it shows.
 */
import directory from '@/data/dhis2-busoga-facilities.json';
import type { DirectoryFacility } from '@/lib/types';

interface DirectoryEntry {
  uid: string; name: string; district: string; subcounty?: string | null; level?: string | null; ownership?: string | null; functional?: boolean;
}

const OWNERSHIP: Record<string, string> = {
  'Government (Public)': 'Government',
  'Private Not for Profit (PNFP or Faith based)': 'Private not for profit',
  'Private for Profit (PFP)': 'Private for profit'
};

export function landingFacilities(): DirectoryFacility[] {
  return (directory.facilities as DirectoryEntry[])
    .map((f) => ({
      id: f.uid,
      name: f.name.trim(),
      district: f.district,
      level: f.level || null,
      ownership: f.ownership ? OWNERSHIP[f.ownership] || f.ownership : null,
      subcounty: f.subcounty || null,
      functional: f.functional !== false
    }))
    .sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
}

export function landingDistricts(): string[] {
  return Array.from(new Set((directory.facilities as DirectoryEntry[]).map((f) => f.district))).sort((a, b) => a.localeCompare(b));
}
