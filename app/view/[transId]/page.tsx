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
        const response = await fetch(`/api/get-registration?transId=${encodeURIComponent(transId)}`);
        const data = await response.json();

        if (response.ok && data) {
          setHeader(data.header);
          setDetails(data.details);
        } else {
          setError(data.error || 'Registration not found');
        }
      } catch (err) {
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
                {new Date(header.regdate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
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
