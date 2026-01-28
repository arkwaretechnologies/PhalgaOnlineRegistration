'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface RegistrationHeader {
  regid: string;
  confcode: string;
  province: string;
  lgu: string;
  contactperson: string;
  contactnum: string;
  email: string;
  regdate: string;
  status?: string;
  payment_proof_url?: string;
  remarks?: string;
}

interface RegistrationDetail {
  confcode: string;
  regid: string;
  linenum: number;
  lastname: string;
  firstname: string;
  middleinit: string;
  suffix: string | null;
  designation: string;
  brgy: string;
  lgu: string;
  province: string;
  tshirtsize: string;
  contactnum: string;
  prcnum: string;
  expirydate: string | null;
  email: string;
}

interface PaymentProof {
  regid: string;
  confcode: string; // NOT NULL - part of composite primary key
  linenum: number; // NOT NULL - part of composite primary key
  payment_proof_url: string;
}

interface Bank {
  bank_name: string;
  acct_no: string;
  payee: string;
}

interface Contact {
  contact_no: string;
}

export default function ViewRegistration() {
  const params = useParams();
  const router = useRouter();
  const transId = params.transId as string;
  const [header, setHeader] = useState<RegistrationHeader | null>(null);
  const [details, setDetails] = useState<RegistrationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [currentViewingProof, setCurrentViewingProof] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [deletingProof, setDeletingProof] = useState<{ regid: string; confcode: string; linenum: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conference, setConference] = useState<{
    confcode: string;
    name: string | null;
    date_from: string | null;
    date_to: string | null;
    venue: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchRegistration = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(
          `/api/get-registration?transId=${encodeURIComponent(transId)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );
        const data = await response.json();

        // console.log('=== View Registration Fetch ===');
        // console.log('Response data:', JSON.stringify(data, null, 2));
        // console.log('Header status:', data.header?.status);

        if (response.ok && data) {
          setHeader(data.header);
          setDetails(data.details);
        } else {
          setError(data.error || 'Registration not found');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load registration');
      } finally {
        setLoading(false);
      }
    };

    const fetchPaymentProofs = async () => {
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(
          `/api/get-payment-proofs?transId=${encodeURIComponent(transId)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );
        const data = await response.json();

        if (response.ok && data.paymentProofs) {
          setPaymentProofs(data.paymentProofs || []);
        } else {
          console.error('Failed to fetch payment proofs:', data.error);
        }
      } catch (err) {
        console.error('Error fetching payment proofs:', err);
      }
    };

    if (transId) {
      fetchRegistration();
      fetchPaymentProofs();
    }
  }, [transId]);

  // Fetch banks when header (and confcode) is available
  useEffect(() => {
    const fetchBanks = async () => {
      if (!header?.confcode) return;

      try {
        const timestamp = new Date().getTime();
        const response = await fetch(
          `/api/get-banks?confcode=${encodeURIComponent(header.confcode)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );
        const data = await response.json();

        if (response.ok && Array.isArray(data)) {
          setBanks(data);
        } else {
          console.error('Failed to fetch banks:', data.error);
        }
      } catch (err) {
        console.error('Error fetching banks:', err);
      }
    };

    fetchBanks();
  }, [header?.confcode]);

  // Fetch contacts when header (and confcode) is available
  useEffect(() => {
    const fetchContacts = async () => {
      if (!header?.confcode) return;

      try {
        const timestamp = new Date().getTime();
        const response = await fetch(
          `/api/get-contacts?confcode=${encodeURIComponent(header.confcode)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );
        const data = await response.json();

        if (response.ok && Array.isArray(data)) {
          setContacts(data);
        } else {
          console.error('Failed to fetch contacts:', data.error);
        }
      } catch (err) {
        console.error('Error fetching contacts:', err);
      }
    };

    fetchContacts();
  }, [header?.confcode]);

  // Fetch conference information
  useEffect(() => {
    const fetchConference = async () => {
      try {
        const timestamp = new Date().getTime();
        const response = await fetch(
          `/api/get-conference?_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );
        const data = await response.json();
        if (response.ok && data && !data.error) {
          setConference(data);
        } else {
          console.warn('Conference not found, using defaults');
          setConference({
            confcode: header?.confcode || '2026-GCMIN',
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
          confcode: header?.confcode || '2026-GCMIN',
          name: '18th Mindanao Geographic Conference',
          date_from: null,
          date_to: null,
          venue: null
        });
      }
    };

    fetchConference();
  }, [header?.confcode]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDFs)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload an image (JPEG, PNG, GIF) or PDF file.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError('File size must be less than 10MB.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('transId', transId);

      const response = await fetch('/api/upload-payment-proof', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadSuccess(true);
        // Refresh payment proofs list
        const timestamp = new Date().getTime();
        const refreshResponse = await fetch(
          `/api/get-payment-proofs?transId=${encodeURIComponent(transId)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          }
        );
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok && refreshData.paymentProofs) {
          setPaymentProofs(refreshData.paymentProofs || []);
        }
        // Clear success message after 3 seconds
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        setUploadError(data.error || 'Failed to upload file. Please try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('An error occurred while uploading. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePaymentProof = async (proof: { regid: string; confcode: string; linenum: number }) => {
    if (!proof || !transId || isDeleting) return;

    setIsDeleting(true);
    setUploadError('');
    
    try {
      const response = await fetch(
        `/api/delete-payment-proof?regId=${encodeURIComponent(proof.regid)}&confcode=${encodeURIComponent(proof.confcode)}&linenum=${encodeURIComponent(proof.linenum)}`,
        {
          method: 'DELETE',
          cache: 'no-store'
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh payment proofs list
        const timestamp = new Date().getTime();
        const refreshResponse = await fetch(
          `/api/get-payment-proofs?transId=${encodeURIComponent(transId)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          }
        );
        const refreshData = await refreshResponse.json();
        if (refreshResponse.ok && refreshData.paymentProofs) {
          setPaymentProofs(refreshData.paymentProofs || []);
        }
        // If we deleted the proof currently being viewed, close the modal
        const proofToDelete = paymentProofs.find(p => 
          p.regid === proof.regid && 
          p.confcode === proof.confcode && 
          p.linenum === proof.linenum
        );
        if (proofToDelete && currentViewingProof === proofToDelete.payment_proof_url) {
          setShowPaymentModal(false);
          setCurrentViewingProof(null);
        }
        setShowDeleteConfirm(false);
        setDeletingProof(null);
      } else {
        setUploadError(data.error || 'Failed to delete payment proof. Please try again.');
        setShowDeleteConfirm(false);
        setDeletingProof(null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      setUploadError('An error occurred while deleting. Please try again.');
      setShowDeleteConfirm(false);
      setDeletingProof(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading registration...</p>
        </div>
      </div>
    );
  }

  if (error || !header) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The transaction ID you entered does not exist.'}</p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">
                Registration Details
              </h1>
              <p className="text-sm sm:text-base text-gray-600">{conference?.name || '18th Mindanao Geographic Conference'}</p>
              {conference?.date_from && conference?.date_to && (() => {
                const dateFrom = new Date(conference.date_from);
                const dateTo = new Date(conference.date_to);
                const sameMonth = dateFrom.getMonth() === dateTo.getMonth() && dateFrom.getFullYear() === dateTo.getFullYear();
                
                const dateFromStr = dateFrom.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                const dateToDay = dateTo.toLocaleDateString('en-US', { day: 'numeric' });
                const dateToMonth = dateTo.toLocaleDateString('en-US', { month: 'long' });
                const dateToYear = dateTo.toLocaleDateString('en-US', { year: 'numeric' });
                
                return (
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {sameMonth 
                      ? `${dateFromStr} - ${dateToDay}, ${dateToYear}`
                      : `${dateFromStr} - ${dateToMonth} ${dateToDay}, ${dateToYear}`
                    }
                  </p>
                );
              })()}
              {conference?.venue && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {conference.venue}
                </p>
              )}
            </div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium touch-target text-sm sm:text-base flex items-center gap-1 self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Registration ID</span>
              <p className="text-base sm:text-lg font-semibold text-gray-800 break-all">{header.regid}</p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Status</span>
              <p className="text-gray-800">
                {(() => {
                  // Handle both lowercase and uppercase field names from Supabase
                  const statusValue = (header.status || (header as any).STATUS || 'PENDING').toString().toUpperCase().trim();
                  
                  // Use template literals to ensure Tailwind classes are properly recognized
                  const baseClasses = 'inline-block px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold';
                  
                  if (statusValue === 'PENDING') {
                    return (
                      <span className={`${baseClasses} bg-orange-500 text-white`}>
                        {statusValue}
                      </span>
                    );
                  } else if (statusValue === 'APPROVED') {
                    return (
                      <span className={`${baseClasses} bg-green-100 text-green-800`}>
                        {statusValue}
                      </span>
                    );
                  } else if (statusValue === 'REJECTED') {
                    return (
                      <span className={`${baseClasses} bg-red-100 text-red-800`}>
                        {statusValue}
                      </span>
                    );
                  } else {
                    return (
                      <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
                        {statusValue}
                      </span>
                    );
                  }
                })()}
              </p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Province</span>
              <p className="text-sm sm:text-base text-gray-800 break-words">{header.province}</p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">LGU</span>
              <p className="text-sm sm:text-base text-gray-800 break-words">{header.lgu}</p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Contact Person</span>
              <p className="text-sm sm:text-base text-gray-800 break-words">{header.contactperson}</p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Contact Number</span>
              <p className="text-sm sm:text-base text-gray-800">{header.contactnum}</p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Email</span>
              <p className="text-sm sm:text-base text-gray-800 break-words break-all">{header.email}</p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Registration Date</span>
              <p className="text-sm sm:text-base text-gray-800">
                {header.regdate && header.regdate.includes(' ') 
                  ? new Date(header.regdate).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Manila'
                    })
                  : new Date(header.regdate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                }
              </p>
            </div>
          </div>

          {/* Payment Proof Upload Section */}
          <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs sm:text-sm font-medium text-gray-500">
                    Proof of Payment ({paymentProofs.length} {paymentProofs.length === 1 ? 'file' : 'files'})
                  </span>
                </div>
                {paymentProofs.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {paymentProofs.map((proof, index) => {
                      const isImage = !proof.payment_proof_url.toLowerCase().endsWith('.pdf') && 
                                     !proof.payment_proof_url.includes('application/pdf');
                      const fileName = proof.payment_proof_url.split('/').pop() || `Payment Proof ${index + 1}`;
                      
                      const proofKey = `${proof.regid}-${proof.confcode}-${proof.linenum}`;
                      return (
                        <div key={proofKey} className="border border-gray-300 rounded-lg p-3 bg-gray-50 flex items-center justify-between gap-2 sm:gap-4">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            {isImage ? (
                              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded flex items-center justify-center">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded flex items-center justify-center">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">{fileName}</p>
                              <p className="text-xs text-gray-500">{isImage ? 'Image' : 'PDF'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (!proof.payment_proof_url || proof.payment_proof_url.includes('undefined')) {
                                  setUploadError('Invalid file URL. Please re-upload the file.');
                                } else {
                                  setCurrentViewingProof(proof.payment_proof_url);
                                  setShowPaymentModal(true);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 sm:py-2 rounded hover:bg-blue-50 transition-colors touch-target"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingProof({ regid: proof.regid, confcode: proof.confcode, linenum: proof.linenum });
                                setShowDeleteConfirm(true);
                              }}
                              disabled={isDeleting}
                              className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 sm:py-2 rounded hover:bg-red-50 transition-colors touch-target"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-600 mb-3">
                    Upload a scanned copy or photo of your validated bank deposit slip
                  </p>
                )}
                {uploadError && (
                  <p className="text-xs sm:text-sm text-red-600 mt-2 break-words">{uploadError}</p>
                )}
                {uploadSuccess && (
                  <p className="text-xs sm:text-sm text-green-600 mt-2">✓ File uploaded successfully!</p>
                )}
              </div>
              <div className="w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 sm:py-2 px-4 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center gap-2 touch-target"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Add Payment Proof
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          {header.remarks && (
            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-gray-200">
              <span className="text-xs sm:text-sm font-medium text-gray-500 block mb-2">
                Remarks
              </span>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-800 whitespace-pre-wrap break-words">{header.remarks}</p>
              </div>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
            Participants ({details.length})
          </h2>
          {/* Mobile Card Layout */}
          <div className="block sm:hidden space-y-3">
            {details.map((detail, index) => (
              <div key={detail.linenum} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="font-bold text-xs text-gray-900 mb-2">Participant #{index + 1}</div>
                <div className="space-y-1.5 text-xs">
                  <div><span className="font-semibold text-gray-700">Name:</span> <span className="text-gray-900">{detail.lastname}{detail.suffix ? ' ' + detail.suffix : ''}, {detail.firstname} {detail.middleinit}</span></div>
                  <div><span className="font-semibold text-gray-700">Designation:</span> <span className="text-gray-900">{detail.designation || '-'}</span></div>
                  <div><span className="font-semibold text-gray-700">Barangay:</span> <span className="text-gray-900">{detail.brgy || '-'}</span></div>
                  <div><span className="font-semibold text-gray-700">T-Shirt Size:</span> <span className="text-gray-900">{detail.tshirtsize || '-'}</span></div>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop Table Layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-semibold text-gray-700">#</th>
                  <th className="border border-gray-300 px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-semibold text-gray-700">Name</th>
                  <th className="border border-gray-300 px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-semibold text-gray-700">Designation</th>
                  <th className="border border-gray-300 px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-semibold text-gray-700">Barangay</th>
                  <th className="border border-gray-300 px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-semibold text-gray-700">T-Shirt Size</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => (
                  <tr key={detail.linenum} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700">{index + 1}</td>
                    <td className="border border-gray-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-800">
                      {detail.lastname}{detail.suffix ? ' ' + detail.suffix : ''}, {detail.firstname} {detail.middleinit}
                    </td>
                    <td className="border border-gray-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700">{detail.designation || '-'}</td>
                    <td className="border border-gray-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700">{detail.brgy || '-'}</td>
                    <td className="border border-gray-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700">{detail.tshirtsize || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes Section */}
        <div className="mt-4 sm:mt-6 md:mt-8 bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900">NOTES</h2>
          <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-900">
            <p><strong>REGISTRATION PROCEDURE:</strong></p>
            
            <p><strong>1.</strong> Deposit your Registration Fee/s to either of the following bank account:</p>
            {/* Mobile Stacked Layout */}
            {banks.length > 0 ? (
              <>
                <div className="block sm:hidden space-y-3 my-3">
                  {banks.map((bank, index) => (
                    <div key={index} className="border border-gray-300 rounded p-3">
                      <div className="font-bold text-xs mb-1">PAYEE:</div>
                      <div className="text-xs mb-2">{bank.payee || '-'}</div>
                      <div className="font-semibold text-xs">({index + 1}) {bank.bank_name || '-'}</div>
                      <div className="text-xs">Account No. {bank.acct_no || '-'}</div>
                    </div>
                  ))}
                </div>
                {/* Desktop Table Layout */}
                <table className="hidden sm:table w-full sm:w-3/4 border-collapse border border-gray-300 my-4">
                  <tbody>
                    {/* First row: Payees */}
                    <tr>
                      {banks.map((bank, index) => (
                        <td key={`payee-${index}`} className="border border-gray-300 p-2 text-gray-900 text-xs sm:text-sm">
                          <strong>PAYEE:</strong> {bank.payee || '-'}
                        </td>
                      ))}
                    </tr>
                    {/* Second row: Bank names and account numbers */}
                    <tr>
                      {banks.map((bank, index) => (
                        <td key={`bank-${index}`} className="border border-gray-300 p-2 text-gray-900 text-xs sm:text-sm">
                          <strong>({index + 1}) {bank.bank_name || '-'}</strong><br />
                          Account No. {bank.acct_no || '-'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-gray-600 my-3 italic">Bank information is being loaded...</p>
            )}

            <p>
            <strong>2.</strong> Upload the scanned/photographed Validated Bank Deposit Slip to the system.
            </p>
            
            <p>
            <strong>3.</strong> An e-mail reply-confirmation will be received for successful registration.
            </p>
            
            <p>
              For concerns, please contact registration team at mobile number{contacts.length > 1 ? 's' : ''}{' '}
              {contacts.length > 0 ? (
                <strong>
                  {contacts.map((contact, index) => (
                    <span key={index}>
                      {contact.contact_no || '-'}
                      {index < contacts.length - 1 && (
                        index === contacts.length - 2 ? ' and ' : ', '
                      )}
                    </span>
                  ))}
                </strong>
              ) : (
                <strong>Loading...</strong>
              )}
              .
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link
            href="/"
            className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 sm:py-2 px-6 rounded-lg transition-colors text-center touch-target text-sm sm:text-base"
          >
            Back to Home
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-3 sm:py-2 px-6 rounded-lg transition-colors text-center touch-target text-sm sm:text-base"
          >
            Add New Registration
          </Link>
        </div>
      </div>

      {/* Payment Proof Modal */}
      {showPaymentModal && currentViewingProof && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => {
            setShowPaymentModal(false);
            setCurrentViewingProof(null);
          }}
        >
          <div 
            className="bg-white rounded-none sm:rounded-lg shadow-xl w-full h-full sm:max-w-4xl sm:w-full sm:max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">Proof of Payment</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setCurrentViewingProof(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors touch-target no-touch-target p-1"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 bg-gray-100">
              {currentViewingProof.toLowerCase().endsWith('.pdf') || currentViewingProof.includes('application/pdf') ? (
                // PDF Viewer
                <div className="w-full h-full min-h-[400px] sm:min-h-[500px]">
                  <iframe
                    src={currentViewingProof}
                    className="w-full h-full border-0 rounded"
                    title="Proof of Payment PDF"
                  />
                </div>
              ) : (
                // Image Viewer
                <div className="flex items-center justify-center min-h-[400px] sm:min-h-[500px]">
                  <img
                    src={currentViewingProof}
                    alt="Proof of Payment"
                    className="max-w-full max-h-[75vh] sm:max-h-[70vh] object-contain rounded"
                    onError={(e) => {
                      console.error('Failed to load image:', currentViewingProof);
                      setUploadError('Failed to load payment proof image. The file may have been deleted or the URL is invalid.');
                      setShowPaymentModal(false);
                      setCurrentViewingProof(null);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
              <a
                href={currentViewingProof}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1 touch-target no-touch-target py-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setCurrentViewingProof(null);
                }}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 sm:py-2 px-4 rounded-lg transition-colors text-sm sm:text-base touch-target"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingProof && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => {
            setShowDeleteConfirm(false);
            setDeletingProof(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 ml-3">Confirm Delete</h2>
            </div>
            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to delete this payment proof? This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingProof(null);
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors duration-200 touch-target text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deletingProof && handleDeletePaymentProof(deletingProof)}
                disabled={isDeleting || !deletingProof}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 touch-target text-sm sm:text-base"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
