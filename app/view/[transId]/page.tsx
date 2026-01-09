'use client';

import { useEffect, useState } from 'react';
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
              <p className="text-gray-600">17th Mindanao Geographic Conference</p>
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
            
            <p><strong>A.</strong> Fill in the details provided that the required columns/details are present.</p>
            
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
                    <strong>(1) BDO - Tarlac-Gerona</strong><br />
                    Account No. 0114-8800-2515
                  </td>
                  <td className="border border-gray-300 p-2 text-gray-900">
                    <strong>(2) Landbank - Imus, Cavite</strong><br />
                    Account No. 1422-1064-60
                  </td>
                </tr>
              </tbody>
            </table>
            
            <p><strong>C.</strong> The duly-accomplished Registration Form &quot;IN EXCEL FORMAT&quot; AND THE scanned/photographed Validated Bank Deposit Slip shall be emailed directly at <a href="mailto:visgeo@phalga.org" className="text-blue-600 hover:underline">visgeo@phalga.org</a>.</p>
            
            <p>
              An e-mail reply-confirmation would be received for successful registration. Print a copy of the confirmation and attach the validated deposit slip for reference during the conference.
            </p>
            
            <p>
              <strong>Deadline for registration is on August 29, 2025. Walk-in participants are NOT allowed.</strong>
            </p>
            
            <p>
              For other issues and concerns, please contact the VP for VISAYAS, Atty. Jose Neil D. Lumongsod at his mobile number <strong>0977-813-0510</strong>.
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
    </div>
  );
}
