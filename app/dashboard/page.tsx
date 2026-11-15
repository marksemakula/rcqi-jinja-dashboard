import type { Metadata } from 'next';
import Dashboard from '@/components/Dashboard';
import { landingDistricts, landingFacilities } from '@/lib/facilities';

export const metadata: Metadata = {
  title: 'CQI Dashboard | Jinja Regional Referral Hospital'
};

export default function DashboardPage() {
  return <Dashboard directory={landingFacilities()} busoga={landingDistricts()} />;
}
