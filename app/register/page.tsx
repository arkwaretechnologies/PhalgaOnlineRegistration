'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RegistrationForm from '@/components/RegistrationForm';

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const confcode = searchParams.get('confcode');

  return <RegistrationForm confcode={confcode} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><p className="text-gray-600">Loading...</p></div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
