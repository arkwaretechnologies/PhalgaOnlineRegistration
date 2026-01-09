'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LandingPage() {
  const [transId, setTransId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{ count: number; isOpen: boolean } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success message from registration submission
    const success = searchParams.get('success');
    const transIdParam = searchParams.get('transId');
    
    if (success === 'true' && transIdParam) {
      setSuccessMessage(`Registration successful! Your Transaction ID is: ${transIdParam}`);
      setTransId(transIdParam.toUpperCase());
      // Clear URL parameters after displaying message
      router.replace('/', { scroll: false });
    }

    const checkRegistrationStatus = async () => {
      try {
        const response = await fetch('/api/check-registration');
        const data = await response.json();
        if (response.ok) {
          console.log('Registration status:', data);
          setRegistrationStatus(data);
        } else {
          console.error('Failed to check registration status:', data);
          setError(data.error || 'Failed to check registration status');
        }
      } catch (err) {
        console.error('Failed to check registration status:', err);
        setError('Failed to check registration status. Please refresh the page.');
      } finally {
        setCheckingStatus(false);
      }
    };

    checkRegistrationStatus();
  }, [searchParams, router]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!transId.trim()) {
      setError('Please enter a transaction ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/get-registration?transId=${encodeURIComponent(transId.trim().toUpperCase())}`);
      const data = await response.json();

      if (response.ok && data) {
        router.push(`/view/${transId.trim().toUpperCase()}`);
      } else {
        setError(data.error || 'Transaction ID not found');
      }
    } catch (err) {
      setError('Failed to lookup transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRegistration = async () => {
    // Double-check registration status before navigating
    setLoading(true);
    try {
      const response = await fetch('/api/check-registration');
      const data = await response.json();

      if (response.ok && data.isOpen) {
        router.push('/register');
      } else {
        setError(`Registration is currently closed. Slots is already full.`);
        setRegistrationStatus(data);
      }
    } catch (err) {
      setError('Failed to check registration status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            PhALGA Online Registration
          </h1>
          <p className="text-gray-600">
            17th Mindanao Geographic Conference
          </p>
        </div>

        <div className="space-y-6">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border-2 border-green-200 text-green-800 px-6 py-4 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-semibold text-green-800">{successMessage}</p>
                  <p className="mt-1 text-xs text-green-700">You can use this Transaction ID to view your registration details.</p>
                </div>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="ml-4 flex-shrink-0 text-green-600 hover:text-green-800"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Transaction ID Lookup */}
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              Lookup Registration
            </h2>
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label htmlFor="transId" className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction ID
                </label>
                <input
                  type="text"
                  id="transId"
                  value={transId}
                  onChange={(e) => setTransId(e.target.value.toUpperCase())}
                  placeholder="Enter Transaction ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  maxLength={6}
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {loading ? 'Looking up...' : 'Lookup Registration'}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* New Registration Link */}
          <div>
            {checkingStatus ? (
              <div className="block w-full bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg text-center">
                Checking availability...
              </div>
            ) : registrationStatus && !registrationStatus.isOpen ? (
              <div className="space-y-2">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm text-center">
                  Thank you for your interest in joining the conference. We regret to inform you that all available slots are already filled.
                </div>
                <button
                  disabled
                  className="block w-full bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg text-center cursor-not-allowed"
                >
                  Add New Registration
                </button>
              </div>
            ) : (
              <button
                onClick={handleNewRegistration}
                className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors duration-200"
              >
                Add New Registration
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Need help? Contact the registration team.</p>
        </div>
      </div>
    </div>
  );
}
