import type { Metadata } from 'next';
import Dashboard from '@/components/Dashboard';

export const metadata: Metadata = {
  title: 'CQI Dashboard | Jinja Regional Referral Hospital'
};

export default function DashboardPage() {
  return <Dashboard />;
}
