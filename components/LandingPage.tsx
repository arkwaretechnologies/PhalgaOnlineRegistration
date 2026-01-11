'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LandingPage() {
  const [transId, setTransId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{ count: number; limit: number; isOpen: boolean } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showRemainingSlotsModal, setShowRemainingSlotsModal] = useState(false);
  const [remainingSlots, setRemainingSlots] = useState<number | null>(null);
  const [conference, setConference] = useState<{
    confcode: string;
    name: string | null;
    date_from: string | null;
    date_to: string | null;
    venue: string | null;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success message from registration submission
    const success = searchParams.get('success');
    const transIdParam = searchParams.get('transId');
    
    if (success === 'true' && transIdParam) {
      setSuccessMessage(`Registration successful! Your Registration ID is: ${transIdParam}`);
      setTransId(transIdParam.toUpperCase());
      // Clear URL parameters after displaying message
      router.replace('/', { scroll: false });
    }

    // Fetch conference information
    const fetchConference = async () => {
      try {
        const response = await fetch('/api/get-conference');
        const data = await response.json();
        if (response.ok && data && !data.error) {
          setConference(data);
        } else {
          console.warn('Conference not found, using defaults');
          setConference({
            confcode: '2026-GCMIN',
            name: '18th Mindanao Geographic Conference',
            date_from: null,
            date_to: null,
            venue: null
          });
        }
      } catch (err) {
        console.error('Failed to fetch conference:', err);
        // Set default on error
        setConference({
          confcode: '2026-GCMIN',
          name: '18th Mindanao Geographic Conference',
          date_from: null,
          date_to: null,
          venue: null
        });
      }
    };

    const checkRegistrationStatus = async () => {
      try {
        const response = await fetch('/api/check-registration');
        const data = await response.json();
        if (response.ok) {
          console.log('Registration status:', data);
          setRegistrationStatus(data);
          // Update conference from registration status if available
          if (data.conference) {
            setConference(prev => prev ? { ...prev, ...data.conference } : null);
          }
          
          // Check if remaining slots are 100 or less (only if registration is open)
          if (data.count !== undefined && data.limit !== undefined && data.isOpen) {
            const remaining = data.limit - data.count;
            setRemainingSlots(remaining);
            if (remaining > 0 && remaining <= 100) {
              setShowRemainingSlotsModal(true);
            }
          }
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

    fetchConference();
    checkRegistrationStatus();
  }, [searchParams, router]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!transId.trim()) {
      setError('Please enter a registration ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/get-registration?transId=${encodeURIComponent(transId.trim().toUpperCase())}`);
      const data = await response.json();

      if (response.ok && data) {
        router.push(`/view/${transId.trim().toUpperCase()}`);
      } else {
        setError(data.error || 'Registration ID not found');
      }
    } catch (err) {
      setError('Failed to lookup registration. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 md:p-8 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            PhALGA Online Registration
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {conference?.name || '18th Mindanao Geographic Conference'}
          </p>
          {conference?.date_from && conference?.date_to && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {new Date(conference.date_from).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {new Date(conference.date_to).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {conference?.venue && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {conference.venue}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* New Registration Button - Moved to Top */}
          <div>
            {checkingStatus ? (
              <div className="block w-full bg-gray-400 text-white font-semibold py-3 sm:py-3 px-4 rounded-lg text-center touch-target text-sm sm:text-base">
                Checking availability...
              </div>
            ) : registrationStatus && !registrationStatus.isOpen ? (
              <div className="space-y-2 sm:space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm text-center break-words">
                  Thank you for your interest in joining the conference. We regret to inform you that all available slots are already filled.
                </div>
                <button
                  disabled
                  className="block w-full bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg text-center cursor-not-allowed touch-target text-sm sm:text-base"
                >
                  Register
                </button>
              </div>
            ) : (
              <button
                onClick={handleNewRegistration}
                className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors duration-200 touch-target text-sm sm:text-base"
              >
                Register
              </button>
            )}
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

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border-2 border-green-200 text-green-800 px-3 sm:px-4 md:px-6 py-3 sm:py-4 rounded-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-green-800 break-words">{successMessage}</p>
                  <p className="mt-1 text-xs text-green-700">You can use this Registration ID to view your registration details.</p>
                </div>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="flex-shrink-0 text-green-600 hover:text-green-800 touch-target no-touch-target p-1"
                  aria-label="Close message"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Registration ID Lookup */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-3 sm:mb-4">
              Registration Verification
            </h2>
            <form onSubmit={handleLookup} className="space-y-3 sm:space-y-4">
              <div>
                <div className="relative">
                  <input
                    type="text"
                    id="transId"
                    value={transId}
                    onChange={(e) => setTransId(e.target.value.toUpperCase())}
                    placeholder=" Enter your Registration ID to verify status"
                    className="w-full pl-3 sm:pl-4 pr-10 sm:pr-11 py-3 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base sm:text-sm"
                    maxLength={10}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !transId.trim()}
                    className="absolute right-3 sm:right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors touch-target"
                    aria-label="Search registration"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm break-words">
                  {error}
                </div>
              )}
            </form>
          </div>

        </div>

        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
          <p>Need help? Contact the registration team.</p>
        </div>
      </div>

      {/* Remaining Slots Modal */}
      {showRemainingSlotsModal && remainingSlots !== null && remainingSlots > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowRemainingSlotsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center mb-4">
              <div className="bg-yellow-100 rounded-full p-3">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-4">
              Limited Slots Available!
            </h2>
            <div className="text-center mb-6">
              <p className="text-base sm:text-lg text-gray-700 mb-2">
                Only <span className="font-bold text-red-600 text-xl sm:text-2xl">{remainingSlots}</span> {remainingSlots === 1 ? 'slot' : 'slots'} remaining
              </p>
              <p className="text-sm sm:text-base text-gray-600">
                Register now to secure your slot for the conference.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => setShowRemainingSlotsModal(false)}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors duration-200 touch-target text-sm sm:text-base"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowRemainingSlotsModal(false);
                  handleNewRegistration();
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 touch-target text-sm sm:text-base disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={loading || (registrationStatus !== null && !registrationStatus.isOpen)}
              >
                Register Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
