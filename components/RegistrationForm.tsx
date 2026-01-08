'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Participant {
  id: number;
  lastName: string;
  firstName: string;
  middleInit: string;
  position: string;
  lgu: string;
  barangay: string;
  tshirt: string;
  contactNo: string;
  prcNo: string;
  expiryDate: string;
  email: string;
}

const PROVINCES = [
  'ABRA', 'AGUSAN DEL NORTE', 'AGUSAN DEL SUR', 'AKLAN', 'ALBAY', 'ANTIQUE',
  'APAYAO', 'AURORA', 'BASILAN', 'BATAAN', 'BATANES', 'BATANGAS', 'BENGUET',
  'BILIRAN', 'BOHOL', 'BUKIDNON', 'BULACAN', 'CAGAYAN', 'CAMARINES NORTE',
  'CAMARINES SUR', 'CAMIGUIN', 'CAPIZ', 'CATANDUANES', 'CAVITE', 'CEBU',
  'COTABATO', 'DAVAO OCCIDENTAL', 'DAVAO ORIENTAL', 'DAVAO DE ORO',
  'DAVAO DEL NORTE', 'DAVAO DEL SUR', 'DINAGAT ISLANDS', 'EASTERN SAMAR',
  'GUIMARAS', 'IFUGAO', 'ILOCOS NORTE', 'ILOCOS SUR', 'ILOILO', 'ISABELA',
  'KALINGA', 'LA UNION', 'LAGUNA', 'LANAO DEL NORTE', 'LANAO DEL SUR', 'LEYTE',
  'MAGUINDANAO DEL NORTE', 'MAGUINDANAO DEL SUR', 'MARINDUQUE', 'MASBATE',
  'MISAMIS OCCIDENTAL', 'MISAMIS ORIENTAL', 'MOUNTAIN PROVINCE',
  'NEGROS OCCIDENTAL', 'NEGROS ORIENTAL', 'NORTHERN SAMAR', 'NUEVA ECIJA',
  'NUEVA VIZCAYA', 'OCCIDENTAL MINDORO', 'ORIENTAL MINDORO', 'PALAWAN',
  'PAMPANGA', 'PANGASINAN', 'QUEZON', 'QUIRINO', 'RIZAL', 'ROMBLON', 'SAMAR',
  'SARANGANI', 'SIQUIJOR', 'SORSOGON', 'SOUTH COTABATO', 'SOUTHERN LEYTE',
  'SULTAN KUDARAT', 'SULU', 'SURIGAO DEL NORTE', 'SURIGAO DEL SUR', 'TARLAC',
  'TAWI-TAWI', 'ZAMBALES', 'ZAMBOANGA SIBUGAY', 'ZAMBOANGA DEL NORTE',
  'ZAMBOANGA DEL SUR'
];

const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export default function RegistrationForm() {
  const router = useRouter();
  const [province, setProvince] = useState('');
  const [lgu, setLgu] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [lguOptions, setLguOptions] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([{
    id: 1,
    lastName: '',
    firstName: '',
    middleInit: '',
    position: '',
    lgu: '',
    barangay: '',
    tshirt: '',
    contactNo: '',
    prcNo: '',
    expiryDate: '',
    email: ''
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  useEffect(() => {
    // Check if registration is open
    fetch('/api/check-registration')
      .then(res => res.json())
      .then(data => {
        setIsRegistrationOpen(data.isOpen);
      })
      .catch(err => console.error('Error checking registration:', err));
  }, []);

  useEffect(() => {
    if (province) {
      fetch(`/api/get-lgus?province=${encodeURIComponent(province)}`)
        .then(res => res.json())
        .then(data => {
          setLguOptions(Array.isArray(data) ? data : []);
          setLgu(''); // Reset LGU when province changes
        })
        .catch(err => {
          console.error('Error fetching LGUs:', err);
          setLguOptions([]);
        });
    } else {
      setLguOptions([]);
      setLgu('');
    }
  }, [province]);

  // Update all participant LGUs when header LGU changes
  useEffect(() => {
    if (lgu) {
      setParticipants(prevParticipants => 
        prevParticipants.map(p => ({
          ...p,
          lgu: lgu // Update all participant LGUs to match header LGU
        }))
      );
    }
  }, [lgu]);

  const addParticipant = () => {
    setParticipants([...participants, {
      id: participants.length + 1,
      lastName: '',
      firstName: '',
      middleInit: '',
      position: '',
      lgu: lgu, // Default to header LGU
      barangay: '',
      tshirt: '',
      contactNo: '',
      prcNo: '',
      expiryDate: '',
      email: ''
    }]);
  };

  const deleteParticipant = (id: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const insertParticipant = (id: number) => {
    // Insert new participant at the bottom of the list
    const newParticipant: Participant = {
      id: Math.max(...participants.map(p => p.id)) + 1,
      lastName: '',
      firstName: '',
      middleInit: '',
      position: '',
      lgu: lgu, // Default to header LGU
      barangay: '',
      tshirt: '',
      contactNo: '',
      prcNo: '',
      expiryDate: '',
      email: ''
    };
    setParticipants([...participants, newParticipant]);
  };

  const updateParticipant = (id: number, field: keyof Participant, value: string) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);

    // Validate that at least one participant is filled out (requires both Last Name and First Name)
    const filledParticipants = participants.filter(p => 
      p.lastName && p.lastName.trim() !== '' && 
      p.firstName && p.firstName.trim() !== ''
    );

    if (filledParticipants.length === 0) {
      setSubmitMessage({ type: 'error', text: 'Please fill out at least one participant with both Last Name and First Name.' });
      return;
    }

    // Validate expiry dates
    for (const participant of participants) {
      if (participant.expiryDate) {
        const dateObj = new Date(participant.expiryDate);
        if (isNaN(dateObj.getTime())) {
          setSubmitMessage({ type: 'error', text: 'Invalid date format in expiry date field.' });
          return;
        }
      }
    }

    // Build form data
    const formData: any = {
      CONFERENCE: 'NL',
      PROVINCE: province,
      LGU: lgu,
      CONTACTPERSON: contactPerson,
      CONTACTNUMBER: contactNo,
      EMAILADDRESS: emailAddress,
      DETAILCOUNT: participants.length.toString()
    };

    participants.forEach((p, index) => {
      formData[`LASTNAME|${index}`] = p.lastName;
      formData[`FIRSTNAME|${index}`] = p.firstName;
      formData[`MI|${index}`] = p.middleInit;
      formData[`DESIGNATION|${index}`] = p.position;
      formData[`LGU|${index}`] = p.lgu || lgu; // Use header LGU if participant LGU is empty
      formData[`BRGY|${index}`] = p.barangay;
      formData[`TSHIRTSIZE|${index}`] = p.tshirt;
      formData[`CONTACTNUMBER|${index}`] = p.contactNo;
      formData[`PRCNUM|${index}`] = p.prcNo;
      formData[`EXPIRYDATE|${index}`] = p.expiryDate;
      formData[`EMAIL|${index}`] = p.email;
    });

    // Store form data and show confirmation
    setPendingFormData(formData);
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return;

    setIsSubmitting(true);
    setShowConfirmation(false);
    setSubmitMessage(null);

    try {
      const response = await fetch('/api/submit-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingFormData),
      });

      const data = await response.json();

      if (response.ok && data.transId) {
        // Redirect to landing page with transaction ID
        router.push(`/?success=true&transId=${encodeURIComponent(data.transId)}`);
      } else {
        setSubmitMessage({ type: 'error', text: data.error || 'Registration failed' });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: 'An error occurred while submitting the form.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirmation(false);
    setPendingFormData(null);
  };

  if (!isRegistrationOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Registration Closed</h1>
          <p className="text-gray-700">Registration is already closed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-[95%] mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* Header with Logos */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex-shrink-0">
              <img
                src="/left.png"
                alt="PHALGA Logo Left"
                className="h-24 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-bold text-gray-900">PHALGA Registration Form</h1>
            </div>
            <div className="flex-shrink-0">
              <img
                src="/right.png"
                alt="PHALGA Logo Right"
                className="h-24 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Header Section */}
          <table className="w-full border-collapse border border-gray-300 mb-6">
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">CONFERENCE</td>
                <td className="border border-gray-300 p-2 text-gray-900">17TH MINDANAO GEOGRAPHIC CONFERENCE</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">PROVINCE</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    list="provinces-list"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded uppercase text-gray-900 bg-white"
                    required
                  />
                  <datalist id="provinces-list">
                    {PROVINCES.map(p => <option key={p} value={p} />)}
                  </datalist>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">LGU</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    list="lgu-list"
                    value={lgu}
                    onChange={(e) => setLgu(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded uppercase text-gray-900 bg-white"
                    required
                  />
                  <datalist id="lgu-list">
                    {lguOptions.map(l => <option key={l} value={l} />)}
                  </datalist>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">CONTACT PERSON</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded uppercase text-gray-900 bg-white"
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">CONTACT NO.</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    value={contactNo}
                    onChange={(e) => setContactNo(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                  />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">EMAIL ADDRESS</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mb-4 text-sm text-gray-600">
            <strong>NOTE:</strong> T-shirt size is limited to S, M, L, XL, XXL
          </p>

          {/* Participants Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th colSpan={12} className="border border-gray-300 p-2 bg-gray-200 text-center">
                    <span className="text-lg font-bold text-gray-900">LIST OF PARTICIPANTS</span>
                    <span className="ml-4 text-base font-normal text-gray-700">
                      (Total: {participants.length} {participants.length === 1 ? 'participant' : 'participants'})
                    </span>
                  </th>
                </tr>
                <tr>
                  <th colSpan={8} className="border border-gray-300 p-2"></th>
                  <th colSpan={3} className="border border-gray-300 p-2 bg-blue-200 text-center text-gray-900">
                    FOR CPAs ONLY
                  </th>
                  <th className="border border-gray-300 p-2 w-40"></th>
                </tr>
                <tr>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">LAST NAME</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">FIRST NAME</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-12">M.I.</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-48">POSITION</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">LGU</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">BARANGAY</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-32">T-SHIRT</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">CONTACT NO.</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">PRC NO.</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">EXPIRY DATE</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">EMAIL ADDRESS</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 w-40 text-gray-900">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        value={participant.lastName}
                        onChange={(e) => updateParticipant(participant.id, 'lastName', e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        value={participant.firstName}
                        onChange={(e) => updateParticipant(participant.id, 'firstName', e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50 w-12">
                      <input
                        type="text"
                        value={participant.middleInit}
                        onChange={(e) => updateParticipant(participant.id, 'middleInit', e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                        maxLength={1}
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50 w-48">
                      <input
                        type="text"
                        value={participant.position}
                        onChange={(e) => updateParticipant(participant.id, 'position', e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        value={participant.lgu || lgu}
                        onChange={(e) => {
                          const newValue = e.target.value.toUpperCase();
                          // If user clears the field, set to empty string so it defaults to header LGU
                          updateParticipant(participant.id, 'lgu', newValue === lgu ? '' : newValue);
                        }}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                        placeholder={lgu || 'Enter LGU'}
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        value={participant.barangay}
                        onChange={(e) => updateParticipant(participant.id, 'barangay', e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50 w-32">
                      <select
                        value={participant.tshirt}
                        onChange={(e) => updateParticipant(participant.id, 'tshirt', e.target.value)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                      >
                        <option value="">Select Size</option>
                        {TSHIRT_SIZES.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        value={participant.contactNo}
                        onChange={(e) => updateParticipant(participant.id, 'contactNo', e.target.value)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        value={participant.prcNo}
                        onChange={(e) => updateParticipant(participant.id, 'prcNo', e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="date"
                        value={participant.expiryDate}
                        onChange={(e) => updateParticipant(participant.id, 'expiryDate', e.target.value)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="email"
                        value={participant.email}
                        onChange={(e) => updateParticipant(participant.id, 'email', e.target.value)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent text-gray-900"
                      />
                    </td>
                    <td className="border border-gray-300 p-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => deleteParticipant(participant.id)}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => insertParticipant(participant.id)}
                          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                        >
                          Insert
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={addParticipant}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add New Row
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>

          {/* Submit Message */}
          {submitMessage && (
            <div className={`mt-4 p-4 rounded ${submitMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {submitMessage.text}
            </div>
          )}
        </form>

        {/* Confirmation Modal */}
        {showConfirmation && pendingFormData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Confirm Registration Details</h2>
                <p className="text-gray-700 mb-6">Please review all details below. Click &quot;Confirm and Submit&quot; if everything is correct.</p>
                
                {/* Header Details */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Header Information</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900 w-1/3">Conference</td>
                        <td className="border border-gray-300 p-2 text-gray-900">17TH MINDANAO GEOGRAPHIC CONFERENCE</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">Province</td>
                        <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData.PROVINCE || 'Not provided'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">LGU</td>
                        <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData.LGU || 'Not provided'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">Contact Person</td>
                        <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData.CONTACTPERSON || 'Not provided'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">Contact Number</td>
                        <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData.CONTACTNUMBER || 'Not provided'}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">Email Address</td>
                        <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData.EMAILADDRESS || 'Not provided'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Participants Details */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Participants ({pendingFormData.DETAILCOUNT})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">#</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Last Name</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">First Name</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-12">M.I.</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-48">Position</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">LGU</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Barangay</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-32">T-Shirt</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Contact No.</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">PRC No.</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Expiry Date</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: parseInt(pendingFormData.DETAILCOUNT) }).map((_, index) => {
                          const formatDate = (dateStr: string) => {
                            if (!dateStr) return '';
                            const date = new Date(dateStr);
                            return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US');
                          };
                          return (
                            <tr key={index}>
                              <td className="border border-gray-300 p-2 text-gray-900">{index + 1}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`LASTNAME|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`FIRSTNAME|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900 w-12">{pendingFormData[`MI|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900 w-48">{pendingFormData[`DESIGNATION|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`LGU|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`BRGY|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900 w-32">{pendingFormData[`TSHIRTSIZE|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`CONTACTNUMBER|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`PRCNUM|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{formatDate(pendingFormData[`EXPIRYDATE|${index}`]) || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`EMAIL|${index}`] || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-end mt-6">
                  <button
                    type="button"
                    onClick={handleCancelSubmit}
                    className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Confirm and Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}

