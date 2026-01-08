import { Suspense } from 'react';
import LandingPage from '@/components/LandingPage';

function LandingPageFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LandingPageFallback />}>
      <LandingPage />
    </Suspense>
  );
}

