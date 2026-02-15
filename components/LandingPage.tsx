'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatConferenceDateRange(dateFrom: string | null, dateTo: string | null): string {
  if (!dateFrom || !dateTo) return '';
  const [y1, m1, d1] = (dateFrom || '').trim().split('-').map(s => parseInt(s, 10));
  const [y2, m2, d2] = (dateTo || '').trim().split('-').map(s => parseInt(s, 10));
  const month1 = MONTH_NAMES[(m1 || 1) - 1] ?? '';
  const month2 = MONTH_NAMES[(m2 || 1) - 1] ?? '';
  const sameMonth = m1 === m2 && y1 === y2;
  if (sameMonth) return `${month1} ${d1} - ${d2}, ${y2}`;
  return `${month1} ${d1} - ${month2} ${d2}, ${y2}`;
}

export default function LandingPage() {
  const [transId, setTransId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{ count: number; limit: number; isOpen: boolean; regAlertCount?: number } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showRemainingSlotsModal, setShowRemainingSlotsModal] = useState(false);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const [showSlotsFullModal, setShowSlotsFullModal] = useState(false);
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
    const success = searchParams.get('success');
    const transIdParam = searchParams.get('transId');
    const sessionExpiredParam = searchParams.get('sessionExpired');
    const slotsFullParam = searchParams.get('slotsFull');

    if (success === 'true' && transIdParam) {
      setSuccessMessage(`Registration successful! Your Registration ID is: ${transIdParam}`);
      setTransId(transIdParam.toUpperCase());
      router.replace('/', { scroll: false });
    }

    if (sessionExpiredParam === '1') {
      setShowSessionExpiredModal(true);
      router.replace('/', { scroll: false });
    }

    if (slotsFullParam === '1') {
      setShowSlotsFullModal(true);
      router.replace('/', { scroll: false });
    }

    const fetchConference = async () => {
      try {
        const response = await fetch('/api/get-conference');
        const data = await response.json();
        if (response.ok && data && !data.error) {
          setConference(data);
        } else {
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
          setRegistrationStatus(data);
          if (data.conference) {
            setConference(prev => prev ? { ...prev, ...data.conference } : null);
          }
          if (data.count !== undefined && data.limit !== undefined && data.isOpen) {
            const remaining = data.limit - data.count;
            setRemainingSlots(remaining);
            const alertThreshold = data.regAlertCount || 100;
            if (remaining > 0 && remaining <= alertThreshold) {
              setShowRemainingSlotsModal(true);
            }
          }
        } else {
          if (response.status === 503) {
            router.replace('/maintenance');
            return;
          }
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
        if (response.status === 503) {
          router.replace('/maintenance');
          return;
        }
        setError(data.error || 'Registration ID not found');
      }
    } catch (err) {
      setError('Failed to lookup registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRegistration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/check-registration');
      const data = await response.json();
      if (response.ok && data.isOpen) {
        router.push('/register');
      } else {
        if (response.status === 503) {
          router.replace('/maintenance');
          return;
        }
        setError('Registration is currently closed. Slots are already full.');
        setRegistrationStatus(data);
      }
    } catch (err) {
      setError('Failed to check registration status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const conferenceName = conference?.name || '18th Mindanao Geographic Conference';
  const dateRangeStr = formatConferenceDateRange(conference?.date_from ?? null, conference?.date_to ?? null);
  const venueStr = conference?.venue || '';

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full min-w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: 'url(/bg.jpg)',
        backgroundColor: '#F8FBF8',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        {/* Main card */}
        <div className="rounded-2xl shadow-xl w-full p-6 sm:p-8 bg-white/100 backdrop-blur-sm">
          {/* Title with left/right images */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3">
            <div className="relative h-10 w-10 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden" >
              <Image
                src="/left.png"
                alt=""
                fill
                sizes="(max-width: 640px) 80px, 128px"
                className="object-cover"
                priority
                unoptimized
              />
            </div>
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-center" style={{ color: '#555555' }}>
              <span className="block sm:inline">PhALGA Online Registration System</span>
            </h1>
            <div className="relative h-10 w-10 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden" >
              <Image
                src="/right.png"
                alt=""
                fill
                sizes="(max-width: 640px) 80px, 128px"
                className="object-cover"
                priority
                unoptimized
              />
            </div>
          </div>

          {/* Conference name - plain text */}
          <p className="text-center text-sm sm:text-base font-semibold  tracking-wide mb-1 mt-6" style={{ color: '#555555' }}>
            {conferenceName}
          </p>

          {/* Date */}
          {dateRangeStr && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <span style={{ color: '#D4B165' }} aria-hidden>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <p className="text-sm sm:text-base" style={{ color: '#555555' }}>{dateRangeStr}</p>
            </div>
          )}

          {/* Venue */}
          {venueStr && (
            <div className="flex justify-center mb-8">
              <div className="relative inline-block max-w-full pl-5 sm:pl-7">
                <span className="absolute left-0 top-0.5" style={{ color: '#D4B165' }} aria-hidden>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <p className="text-center text-sm sm:text-base leading-snug break-words" style={{ color: '#555555' }}>
                  {venueStr}
                </p>
              </div>
            </div>
          )}

          {/* Register Now button */}
          <div className="mb-6">
            {checkingStatus ? (
              <div className="w-full rounded-xl py-3.5 px-4 text-center font-semibold text-white text-sm sm:text-base" style={{ backgroundColor: '#9e9e9e' }}>
                Checking availability...
              </div>
            ) : registrationStatus && !registrationStatus.isOpen ? (
              <div className="space-y-3">
                <div className="rounded-lg border px-4 py-3 text-center text-sm text-amber-800 bg-amber-50 border-amber-200">
                  Thank you for your interest. All slots are fully taken.
                </div>
                <button
                  disabled
                  className="w-full rounded-xl py-3.5 px-4 font-semibold text-white text-sm sm:text-base cursor-not-allowed"
                  style={{ backgroundColor: '#9e9e9e' }}
                >
                  Register Now
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNewRegistration}
                className="w-full rounded-xl py-3.5 px-4 font-semibold text-white text-sm sm:text-base shadow-md hover:opacity-95 transition-opacity"
                style={{ background: 'linear-gradient(180deg, #3d8b4d 0%, #367C46 100%)', backgroundColor: '#367C46' }}
              >
                Register Now
              </button>
            )}
          </div>

          {/* OR divider */}
          <div className="relative flex items-center justify-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-sm font-medium" style={{ color: '#AAAAAA' }}>OR</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="mb-6 bg-green-50 border-2 border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
              <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold break-words">{successMessage}</p>
                <p className="mt-1 text-xs text-green-700">You can use this Registration ID to view your registration details.</p>
              </div>
              <button type="button" onClick={() => setSuccessMessage('')} className="flex-shrink-0 text-green-600 hover:text-green-800 p-1" aria-label="Close">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Registration Verification */}
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold mb-3" style={{ color: '#555555' }}>
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 border-2"
                style={{ borderColor: '#D4B165' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} style={{ color: '#D4B165' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              Registration Verification
            </h2>
            <form onSubmit={handleLookup}>
              <div className="relative">
                <input
                  type="text"
                  id="transId"
                  value={transId}
                  onChange={(e) => setTransId(e.target.value.toUpperCase())}
                  placeholder="Enter your Registration ID to verify status"
                  className="w-full pl-4 pr-11 py-3 rounded-xl text-base border border-transparent focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none placeholder-gray-400"
                  style={{ backgroundColor: '#F0F4F0' }}
                  maxLength={10}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !transId.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-green-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  aria-label="Search registration"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
              {error && (
                <div className="mt-3 px-4 py-2.5 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Remaining Slots Modal */}
      {showRemainingSlotsModal && remainingSlots !== null && remainingSlots > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRemainingSlotsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fff9c4' }}>
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-4">Limited Slots Available!</h2>
            <div className="text-center mb-6">
              <p className="text-base sm:text-lg text-gray-700 mb-2">
                Only <span className="font-bold text-red-600 text-xl sm:text-2xl">{remainingSlots}</span> {remainingSlots === 1 ? 'slot' : 'slots'} remaining
              </p>
              <p className="text-sm text-gray-600">Register now to secure your slot for the conference.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowRemainingSlotsModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRemainingSlotsModal(false);
                  handleNewRegistration();
                }}
                className="flex-1 px-4 py-3 text-white font-semibold rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#367C46' }}
                disabled={loading || (registrationStatus !== null && !registrationStatus.isOpen)}
              >
                Register Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session expired modal */}
      {showSessionExpiredModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSessionExpiredModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-4">Session expired</h2>
            <p className="text-center text-gray-700 mb-6">
              Your registration session has expired. You can start a new registration if slots are still available.
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowSessionExpiredModal(false)}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All slots fully taken modal */}
      {showSlotsFullModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSlotsFullModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-4">All slots fully taken</h2>
            <p className="text-center text-gray-700 mb-6">
              Thank you for your interest. All registration slots for this conference are now fully taken.
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowSlotsFullModal(false)}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
