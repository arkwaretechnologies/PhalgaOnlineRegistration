'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface RegistrationHeader {
  regnum: number;
  transid: string;
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
  regnum: number;
  linenum: number;
  lastname: string;
  firstname: string;
  middleinit: string;
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
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

        console.log('=== View Registration Fetch ===');
        console.log('Response data:', JSON.stringify(data, null, 2));
        console.log('Header status:', data.header?.status);

        if (response.ok && data) {
          setHeader(data.header);
          setDetails(data.details);
          // Set payment proof URL if available
          if (data.header?.payment_proof_url) {
            setPaymentProofUrl(data.header.payment_proof_url);
          }
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

    if (transId) {
      fetchRegistration();
    }
  }, [transId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (images and PDFs)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload an image (JPEG, PNG, GIF) or PDF file.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setUploadError('File size must be less than 5MB.');
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
        setPaymentProofUrl(data.url);
        // Refresh registration data to get updated payment proof URL
        const timestamp = new Date().getTime();
        const refreshResponse = await fetch(
          `/api/get-registration?transId=${encodeURIComponent(transId)}&_t=${timestamp}`,
          {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          }
        );
        const refreshData = await refreshResponse.json();
        if (refreshData.header) {
          setHeader(refreshData.header);
          setPaymentProofUrl(refreshData.header.payment_proof_url || null);
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Registration Details
              </h1>
              <p className="text-gray-600">18th Mindanao Geographic Conference</p>
            </div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <span className="text-sm font-medium text-gray-500">Transaction ID</span>
              <p className="text-lg font-semibold text-gray-800">{header.transid}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Registration Number</span>
              <p className="text-lg font-semibold text-gray-800">{header.regnum.toString().padStart(4, '0')}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Status</span>
              <p className="text-gray-800">
                {(() => {
                  // Handle both lowercase and uppercase field names from Supabase
                  const statusValue = (header.status || (header as any).STATUS || 'PENDING').toString().toUpperCase().trim();
                  
                  // Use template literals to ensure Tailwind classes are properly recognized
                  const baseClasses = 'inline-block px-3 py-1  rounded-full text-sm font-semibold';
                  
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
              <span className="text-sm font-medium text-gray-500">Province</span>
              <p className="text-gray-800">{header.province}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">LGU</span>
              <p className="text-gray-800">{header.lgu}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Contact Person</span>
              <p className="text-gray-800">{header.contactperson}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Contact Number</span>
              <p className="text-gray-800">{header.contactnum}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Email</span>
              <p className="text-gray-800">{header.email}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Registration Date</span>
              <p className="text-gray-800">
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
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-500 block mb-2">
                  Proof of Payment
                </span>
                {paymentProofUrl ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!paymentProofUrl || paymentProofUrl.includes('undefined')) {
                          setUploadError('Invalid file URL. Please re-upload the file.');
                        } else {
                          setShowPaymentModal(true);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 underline text-sm inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Uploaded File
                    </button>
                    <p className="text-xs text-gray-500">Payment proof has been uploaded</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mb-2">
                    Upload a scanned copy or photo of your validated bank deposit slip
                  </p>
                )}
                {uploadError && (
                  <p className="text-sm text-red-600 mt-2">{uploadError}</p>
                )}
                {uploadSuccess && (
                  <p className="text-sm text-green-600 mt-2">✓ File uploaded successfully!</p>
                )}
              </div>
              <div>
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
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : paymentProofUrl ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Replace File
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Proof of Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          {header.remarks && (
            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-500 block mb-2">
                Remarks
              </span>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{header.remarks}</p>
              </div>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Participants ({details.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">#</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Designation</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Barangay</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">T-Shirt Size</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Contact</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">PRC Number</th>
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => (
                  <tr key={detail.linenum} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{index + 1}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-800">
                      {detail.lastname}, {detail.firstname} {detail.middleinit}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{detail.designation || '-'}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{detail.brgy || '-'}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{detail.tshirtsize || '-'}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{detail.contactnum || '-'}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{detail.prcnum || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">NOTES</h2>
          <div className="space-y-3 text-sm text-gray-900">
            <p><strong>REGISTRATION PROCEDURES:</strong></p>
            
            <p><strong>B.</strong> Deposit your Registration Fees to either of the following:</p>
            <table className="w-3/4 border-collapse border border-gray-300 my-4">
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 text-gray-900">
                    <strong>PAYEE:</strong> Philippine Association of Local Government Accountants, Inc.
                  </td>
                  <td className="border border-gray-300 p-2 text-gray-900">
                    <strong>PAYEE:</strong> Philippine Association of Local Government Accountants, Inc.
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 text-gray-900">
                    <strong>(1) BDO - CDO</strong><br />
                    Account No. 0119 4800 6438
                  </td>
                  <td className="border border-gray-300 p-2 text-gray-900">
                    <strong>(2) Landbank - Imus, Cavite</strong><br />
                    Account No. 1422 1089 19
                  </td>
                </tr>
              </tbody>
            </table>

            <p>
              Upload the scanned/photographed Validated Bank Deposit Slip to the system.
            </p>
            
            <p>
              An e-mail reply-confirmation would be received for successful registration. Print a copy of the confirmation and attach the validated deposit slip for reference during the conference.
            </p>
            
            <p>
              For other issues and concerns, please contact the VP for MINDANAO, Ritchleen Grace Jasebelle A. Buray, CPA at her mobile number <strong>09177-7189-615</strong>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 justify-center">
          <Link
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/register"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Add New Registration
          </Link>
        </div>
      </div>

      {/* Payment Proof Modal */}
      {showPaymentModal && paymentProofUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Proof of Payment</h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {paymentProofUrl.toLowerCase().endsWith('.pdf') || paymentProofUrl.includes('application/pdf') ? (
                // PDF Viewer
                <div className="w-full h-full min-h-[500px]">
                  <iframe
                    src={paymentProofUrl}
                    className="w-full h-full border-0 rounded"
                    title="Proof of Payment PDF"
                  />
                </div>
              ) : (
                // Image Viewer
                <div className="flex items-center justify-center">
                  <img
                    src={paymentProofUrl}
                    alt="Proof of Payment"
                    className="max-w-full max-h-[70vh] object-contain rounded"
                    onError={(e) => {
                      console.error('Failed to load image:', paymentProofUrl);
                      setUploadError('Failed to load payment proof image. The file may have been deleted or the URL is invalid.');
                      setShowPaymentModal(false);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <a
                href={paymentProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
