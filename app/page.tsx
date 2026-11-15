import type { Metadata } from 'next';
import LandingPanel from '@/components/landing/LandingPanel';
import WordField from '@/components/landing/WordField';
import { landingDistricts, landingFacilities } from '@/lib/facilities';

export const metadata: Metadata = {
  title: 'Continuous Quality Improvement | MoH - Busoga RCQI'
};

// Links made before the landing page existed point at the root with a section, such as /#journal/<project> in
// notification emails or /#forms. They go straight on to the same section of the dashboard, before the page paints.
const FORWARD = "if(location.hash.length>1)location.replace('/dashboard'+location.search+location.hash);";

export default function LandingPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FORWARD }} />
      <div className="landing">
        <WordField />
        <LandingPanel facilities={landingFacilities()} districts={landingDistricts()} />
      </div>
    </>
  );
}
