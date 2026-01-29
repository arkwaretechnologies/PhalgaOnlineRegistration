'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Participant {
  id: number;
  lastName: string;
  firstName: string;
  middleInit: string;
  suffix: string;
  position: string;
  lgu: string;
  barangay: string;
  tshirt: string;
}

// Default provinces list as fallback if API fails
const DEFAULT_PROVINCES = [
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
  const [contactPersonError, setContactPersonError] = useState<string>('');
  const [contactNo, setContactNo] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [lguOptions, setLguOptions] = useState<Array<{ name: string; psgc: string }>>([]);
  const [selectedLguPsgc, setSelectedLguPsgc] = useState<string>('');
  const [barangayOptions, setBarangayOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<Array<{ name: string; lvl: string | null }>>([]);
  const [participants, setParticipants] = useState<Participant[]>([{
    id: 1,
    lastName: '',
    firstName: '',
    middleInit: '',
    suffix: '',
    position: '',
    lgu: '',
    barangay: '',
    tshirt: ''
  }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [conference, setConference] = useState<{
    confcode: string;
    name: string | null;
    date_from: string | null;
    date_to: string | null;
    venue: string | null;
    psgc: string | null;
  } | null>(null);
  const [provinces, setProvinces] = useState<string[]>([]); // Start with empty array - only show fetched provinces
  const [isProvinceLgu, setIsProvinceLgu] = useState(false);

  useEffect(() => {
    // Fetch conference information
    fetch('/api/get-conference')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setConference(data);
        } else {
          console.warn('Conference not found, using defaults');
          // Set default conference info if not found
          setConference({
            confcode: '2026-GCMIN',
            name: '18th Mindanao Geographic Conference',
            date_from: null,
            date_to: null,
            venue: null,
            psgc: null
          });
        }
      })
      .catch(err => {
        console.error('Error fetching conference:', err);
        // Set default on error
        setConference({
          confcode: '2026-GCMIN',
          name: '18th Mindanao Geographic Conference',
          date_from: null,
          date_to: null,
          venue: null,
          psgc: null
        });
      });

    // Fetch provinces filtered by conference PSGC
    // console.log('=== Fetching Provinces from API ===');
    fetch('/api/get-provinces')
      .then(res => res.json())
      .then(data => {
        // console.log('API Response:', data);
        if (data && !data.error && Array.isArray(data)) {
          // console.log(`✓ Successfully fetched ${data.length} provinces from API`);
          // console.log('Provinces list:', data);
          setProvinces(data);
        } else {
          console.warn('✗ Failed to fetch provinces from API:', data);
          // Keep empty array - only show fetched provinces, no fallback
          setProvinces([]);
        }
      })
      .catch(err => {
        console.error('✗ Error fetching provinces:', err);
        // Keep empty array - only show fetched provinces, no fallback
        setProvinces([]);
      });

    // Fetch positions from database
    // console.log('=== Fetching Positions from API ===');
    fetch('/api/get-positions')
      .then(res => res.json())
      .then(data => {
        // console.log('Positions API Response:', data);
        if (data && !data.error && Array.isArray(data)) {
          // console.log(`✓ Successfully fetched ${data.length} positions from API`);
          // console.log('Positions list:', data);
          setPositionOptions(data);
        } else {
          console.warn('✗ Failed to fetch positions from API:', data);
          setPositionOptions([]);
        }
      })
      .catch(err => {
        console.error('✗ Error fetching positions:', err);
        setPositionOptions([]);
      });

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
          // Handle both old format (array of strings) and new format (array of objects)
          if (Array.isArray(data)) {
            const formattedData = data.map(item => {
              if (typeof item === 'string') {
                // Old format: just return the string as name, PSGC will be looked up
                return { name: item, psgc: '' };
              } else {
                // New format: object with name and psgc
                return { name: item.name || item.lguname || '', psgc: item.psgc || '' };
              }
            });
            setLguOptions(formattedData);
          } else {
            setLguOptions([]);
          }
          setLgu(''); // Reset LGU when province changes
          setSelectedLguPsgc(''); // Reset PSGC
        })
        .catch(err => {
          console.error('Error fetching LGUs:', err);
          setLguOptions([]);
        });
    } else {
      setLguOptions([]);
      setLgu('');
      setSelectedLguPsgc('');
    }
  }, [province]);

  // Fetch barangays when LGU changes
  useEffect(() => {
    if (lgu && selectedLguPsgc) {
      // console.log('=== Fetching Barangays for LGU ===');
      // console.log('LGU selected:', lgu);
      // console.log('PSGC code:', selectedLguPsgc);
      // Use PSGC code for accurate lookup
      fetch(`/api/get-barangays?lgu=${encodeURIComponent(lgu)}&psgc=${encodeURIComponent(selectedLguPsgc)}`)
        .then(res => res.json())
        .then(data => {
          // console.log('Barangays API Response:', data);
          if (data && !data.error && Array.isArray(data)) {
            // console.log(`✓ Successfully fetched ${data.length} barangays for LGU: ${lgu} (PSGC: ${selectedLguPsgc})`);
            // console.log('Barangays list:', data);
            setBarangayOptions(data);
          } else {
            console.warn('✗ Failed to fetch barangays from API:', data);
            setBarangayOptions([]);
          }
        })
        .catch(err => {
          console.error('✗ Error fetching barangays:', err);
          setBarangayOptions([]);
        });
    } else if (lgu) {
      // Fallback: try without PSGC if it's not available
      // console.log('=== Fetching Barangays for LGU (fallback) ===');
      // console.log('LGU selected:', lgu);
      fetch(`/api/get-barangays?lgu=${encodeURIComponent(lgu)}`)
        .then(res => res.json())
        .then(data => {
          // console.log('Barangays API Response:', data);
          if (data && !data.error && Array.isArray(data)) {
            // console.log(`✓ Successfully fetched ${data.length} barangays for LGU: ${lgu}`);
            // console.log('Barangays list:', data);
            setBarangayOptions(data);
          } else {
            console.warn('✗ Failed to fetch barangays from API:', data);
            setBarangayOptions([]);
          }
        })
        .catch(err => {
          console.error('✗ Error fetching barangays:', err);
          setBarangayOptions([]);
        });
    } else {
      setBarangayOptions([]);
    }
  }, [lgu, selectedLguPsgc]);

  // Update all participant LGUs when header LGU changes
  useEffect(() => {
    if (lgu) {
      setParticipants(prevParticipants => 
        prevParticipants.map(p => ({
          ...p,
          lgu: lgu, // Update all participant LGUs to match header LGU
          barangay: '' // Reset barangay when LGU changes
        }))
      );
    }
  }, [lgu]);

  // Handle province LGU checkbox change
  useEffect(() => {
    if (isProvinceLgu) {
      setLgu('PROVINCE');
      setSelectedLguPsgc('');
    } else if (lgu === 'PROVINCE') {
      // If checkbox is unchecked and LGU is still "PROVINCE", clear it
      setLgu('');
      setSelectedLguPsgc('');
    }
  }, [isProvinceLgu]);

  const MAX_PARTICIPANTS = 20;

  const addParticipant = () => {
    if (participants.length >= MAX_PARTICIPANTS) {
      setErrorModalMessage(`Maximum ${MAX_PARTICIPANTS} participants allowed per registration.`);
      setShowErrorModal(true);
      return;
    }
    setParticipants([...participants, {
      id: participants.length + 1,
      lastName: '',
      firstName: '',
      middleInit: '',
      suffix: '',
      position: '',
      lgu: lgu, // Default to header LGU
      barangay: '',
      tshirt: ''
    }]);
  };

  const deleteParticipant = (id: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const insertParticipant = (id: number) => {
    // Check if limit is reached
    if (participants.length >= MAX_PARTICIPANTS) {
      setErrorModalMessage(`Maximum ${MAX_PARTICIPANTS} participants allowed per registration.`);
      setShowErrorModal(true);
      return;
    }
    // Insert new participant at the bottom of the list
    const newParticipant: Participant = {
      id: Math.max(...participants.map(p => p.id)) + 1,
      lastName: '',
      firstName: '',
      middleInit: '',
      suffix: '',
      position: '',
      lgu: lgu, // Default to header LGU
      barangay: '',
      tshirt: ''
    };
    setParticipants([...participants, newParticipant]);
  };

  // Validation helper functions
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Allow empty (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateContactPerson = (value: string): boolean => {
    if (!value || value.trim() === '') return true; // Allow empty (will be caught by required validation)
    // Check if the value contains only digits
    return !/^\d+$/.test(value.trim());
  };

  const formatContactNumber = (value: string): string => {
    // Remove all non-numeric characters
    const numbersOnly = value.replace(/\D/g, '');
    // Limit to 11 digits
    return numbersOnly.slice(0, 11);
  };

  const formatPRCNumber = (value: string): string => {
    // Remove all non-numeric characters
    return value.replace(/\D/g, '');
  };

  const updateParticipant = (id: number, field: keyof Participant, value: string) => {
    // Field-specific sanitization
    // M.I. should allow letters only (no special chars / digits), up to 2 chars
    if (field === 'middleInit') {
      value = value
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2);
    }

    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Unified handlers for Safari compatibility (work with both onChange and onInput)
  const handleProvinceChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setProvince(value);
  };

  const handleLguChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    if (!isProvinceLgu) {
      const selectedName = e.currentTarget.value;
      setLgu(selectedName);
      // Find matching LGU object and set PSGC
      const matchedLgu = lguOptions.find(l => l.name.toUpperCase() === selectedName.toUpperCase());
      setSelectedLguPsgc(matchedLgu?.psgc || '');
    }
  };

  const handleBarangayChange = (participantId: number, e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.toUpperCase();
    updateParticipant(participantId, 'barangay', value);
  };

  // Helper function to get the lvl for a position name
  const getPositionLvl = (positionName: string): string | null => {
    const position = positionOptions.find(p => p.name.toUpperCase() === positionName.toUpperCase());
    return position?.lvl || null;
  };

  // Helper function to check if Barangay should be enabled for a participant
  const isBarangayEnabled = (participant: Participant): boolean => {
    if (!participant.position) return false;
    const lvl = getPositionLvl(participant.position);
    return lvl === 'BGY';
  };

  // Helper function to get filtered positions based on LGU
  // If LGU is "PROVINCE", exclude positions with lvl = 'BGY'
  const getFilteredPositions = (effectiveLgu: string): Array<{ name: string; lvl: string | null }> => {
    if (effectiveLgu.toUpperCase().trim() === 'PROVINCE') {
      return positionOptions.filter(p => p.lvl !== 'BGY');
    }
    return positionOptions;
  };

  // Helper function to handle position change and clear barangay if needed
  const handlePositionChange = (participantId: number, newPosition: string) => {
    const newPositionUpper = newPosition.toUpperCase();
    const lvl = getPositionLvl(newPositionUpper);
    
    setParticipants(participants.map(p => {
      if (p.id === participantId) {
        // If the new position doesn't have lvl === 'BGY', clear the barangay field
        const shouldClearBarangay = lvl !== 'BGY';
        return {
          ...p,
          position: newPositionUpper,
          barangay: shouldClearBarangay ? '' : p.barangay
        };
      }
      return p;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setShowErrorModal(false);

    // Validate main contact number (must be exactly 11 digits)
    if (!contactNo || contactNo.length !== 11) {
      setErrorModalMessage('Contact number must be exactly 11 digits.');
      setShowErrorModal(true);
      return;
    }

    // Validate main email address
    if (!validateEmail(emailAddress)) {
      setErrorModalMessage('Please enter a valid email address.');
      setShowErrorModal(true);
      return;
    }

    // Validate that all participants have all required fields filled
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.lastName || p.lastName.trim() === '') {
        setErrorModalMessage(`Participant ${i + 1}: Last Name is required.`);
        setShowErrorModal(true);
        return;
      }
      if (!p.firstName || p.firstName.trim() === '') {
        setErrorModalMessage(`Participant ${i + 1}: First Name is required.`);
        setShowErrorModal(true);
        return;
      }
      if (!p.middleInit || p.middleInit.trim() === '') {
        setErrorModalMessage(`Participant ${i + 1}: Middle Initial is required.`);
        setShowErrorModal(true);
        return;
      }
      if (!p.position || p.position.trim() === '') {
        setErrorModalMessage(`Participant ${i + 1}: Position is required.`);
        setShowErrorModal(true);
        return;
      }
      // LGU validation: participant LGU can be empty if header LGU is set (it will default)
      const effectiveLgu = p.lgu && p.lgu.trim() !== '' ? p.lgu : lgu;
      if (!effectiveLgu || effectiveLgu.trim() === '') {
        setErrorModalMessage(`Participant ${i + 1}: LGU is required.`);
        setShowErrorModal(true);
        return;
      }
      // Barangay is optional - no validation needed
      if (!p.tshirt || p.tshirt.trim() === '') {
        setErrorModalMessage(`Participant ${i + 1}: T-Shirt Size is required.`);
        setShowErrorModal(true);
        return;
      }
    }

    // Validate header fields
    if (!province || province.trim() === '') {
      setErrorModalMessage('Province is required.');
      setShowErrorModal(true);
      return;
    }
    if (!lgu || lgu.trim() === '') {
      setErrorModalMessage('LGU is required.');
      setShowErrorModal(true);
      return;
    }
    if (!contactPerson || contactPerson.trim() === '') {
      setErrorModalMessage('Contact Person is required.');
      setShowErrorModal(true);
      return;
    }

    // Validate that Contact Person does not contain only numbers
    if (!validateContactPerson(contactPerson)) {
      setErrorModalMessage('Contact Person cannot contain only numbers. Please enter a name.');
      setShowErrorModal(true);
      return;
    }

    // Build form data
    const formData: any = {
      CONFERENCE: conference?.confcode || '2026-GCMIN', // Use conference code from database
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
      formData[`SUFFIX|${index}`] = p.suffix;
      formData[`DESIGNATION|${index}`] = p.position;
      formData[`LGU|${index}`] = p.lgu || lgu; // Use header LGU if participant LGU is empty
      formData[`BRGY|${index}`] = p.barangay;
      formData[`TSHIRTSIZE|${index}`] = p.tshirt;
    });

    // Store form data and show confirmation
    setPendingFormData(formData);
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return;

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      // Check registration count before submitting
      const checkResponse = await fetch('/api/check-registration');
      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        setIsSubmitting(false);
        setShowConfirmation(false); // Close confirmation modal first
        // Use setTimeout to ensure confirmation modal closes before error modal shows
        setTimeout(() => {
          setErrorModalMessage('Failed to check registration status. Please try again.');
          setShowErrorModal(true);
        }, 100);
        return;
      }

      const currentCount = checkData.count || 0;
      const limit = checkData.limit || 3;
      const participantsToAdd = parseInt(pendingFormData.DETAILCOUNT) || 0;
      const totalAfterSubmission = currentCount + participantsToAdd;
      const availableSlots = limit - currentCount;

      // Check if registration is already closed
      if (!checkData.isOpen) {
        setIsSubmitting(false);
        setShowConfirmation(false); // Close confirmation modal first
        // Use setTimeout to ensure confirmation modal closes before error modal shows
        setTimeout(() => {
          setErrorModalMessage(
            `Registration is closed. All slots are full.\n\n` +
            `Current: ${currentCount}/${limit} participants\n` +
            `Available slots: 0`
          );
          setShowErrorModal(true);
        }, 100);
        return;
      }

      // Check if adding these participants would exceed the limit
      if (totalAfterSubmission > limit) {
        setIsSubmitting(false);
        setShowConfirmation(false); // Close confirmation modal first
        // Use setTimeout to ensure confirmation modal closes before error modal shows
        setTimeout(() => {
          setErrorModalMessage(
            `Cannot submit registration. Not enough slots available.\n\n` +
            `Available slots: ${availableSlots}` 
          );
          setShowErrorModal(true);
        }, 100);
        return;
      }

      // All checks passed - proceed with submission
      setShowConfirmation(false);

      const response = await fetch('/api/submit-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingFormData),
      });

      const data = await response.json();

      if (response.ok && data.transId) {
        // Redirect to landing page with registration ID
        router.push(`/?success=true&transId=${encodeURIComponent(data.transId)}`);
      } else {
        setIsSubmitting(false);
        // Check if the error is about registration being closed
        if (data.error && data.error.includes('closed')) {
          const errorCurrentCount = data.currentCount || currentCount;
          const errorLimit = data.limit || limit;
          // Use setTimeout to ensure any modals close before error modal shows
          setTimeout(() => {
            setErrorModalMessage(
              `Registration is closed. All slots are full.`
            );
            setShowErrorModal(true);
          }, 100);
        } else {
          // Use setTimeout to ensure any modals close before error modal shows
          setTimeout(() => {
            setErrorModalMessage(data.error || 'Registration failed. Please try again.');
            setShowErrorModal(true);
          }, 100);
        }
      }
    } catch (error) {
      setIsSubmitting(false);
      setShowConfirmation(false); // Close confirmation modal if open
      // Use setTimeout to ensure confirmation modal closes before error modal shows
      setTimeout(() => {
        setErrorModalMessage('An error occurred while submitting the form. Please try again.');
        setShowErrorModal(true);
      }, 100);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirmation(false);
    setPendingFormData(null);
  };

  if (!isRegistrationOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 sm:p-10 rounded-lg shadow-lg max-w-2xl w-full text-center">
          <div className="mb-6">
            <svg className="mx-auto h-16 w-16 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-lg sm:text-xl text-gray-700 leading-relaxed">
            Thank you for your interest in joining the conference. We regret to inform you that all slots are fully taken.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 md:py-8 px-3 sm:px-4">
      <div className="max-w-[100%] sm:max-w-[95%] mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
          {/* Header with Logos */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2 mb-6 sm:mb-8">
            <div className="flex-shrink-0 hidden sm:block">
              <img
                src="/left.png"
                alt="PHALGA Logo Left"
                className="h-16 sm:h-20 md:h-24 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 text-center order-2 sm:order-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">PhALGA Registration Form</h1>
            </div>
            <div className="flex-shrink-0 hidden sm:block order-1 sm:order-2">
              <img
                src="/right.png"
                alt="PHALGA Logo Right"
                className="h-16 sm:h-20 md:h-24 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Header Section - Mobile Card Layout, Desktop Table Layout */}
          <div className="block sm:hidden mb-6 space-y-3">
            {/* Mobile Card Layout */}
            <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
              <div className="font-semibold text-sm text-gray-900 mb-1">CONFERENCE</div>
              <div className="text-sm text-gray-900">{conference?.name?.toUpperCase() || '18TH MINDANAO GEOGRAPHIC CONFERENCE'}</div>
            </div>
            <div className="border border-gray-300 rounded-lg p-3 bg-blue-50">
              <label className="block font-semibold text-sm text-gray-900 mb-2">PROVINCE *</label>
              <input
                type="text"
                list="provinces-list-mobile"
                value={province}
                onChange={handleProvinceChange}
                onInput={handleProvinceChange}
                onBlur={(e) => {
                  // Validate that the value exists in the provinces list
                  const enteredValue = e.target.value.trim().toUpperCase();
                  const isValid = provinces.some(p => p.toUpperCase() === enteredValue);
                  if (!isValid && enteredValue !== '') {
                    setProvince('');
                  }
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                required
              />
              <datalist id="provinces-list-mobile">
                {provinces.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="border border-gray-300 rounded-lg p-3 bg-blue-50">
              <label className="block font-semibold text-sm text-gray-900 mb-2">LGU *</label>
              <div className="flex items-center gap-2 sm:gap-3">
                <input
                  type="text"
                  list="lgu-list-mobile"
                  value={lgu}
                  onChange={handleLguChange}
                  onInput={handleLguChange}
                  onBlur={(e) => {
                    if (!isProvinceLgu) {
                      // Validate that the value exists in the LGU options list
                      const enteredValue = e.target.value.trim().toUpperCase();
                      const isValid = lguOptions.some(l => l.name.toUpperCase() === enteredValue);
                      if (!isValid && enteredValue !== '') {
                        setLgu('');
                        setSelectedLguPsgc('');
                      }
                    }
                  }}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={isProvinceLgu}
                  required
                />
                <label htmlFor="province-lgu-checkbox-mobile" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    id="province-lgu-checkbox-mobile"
                    checked={isProvinceLgu}
                    onChange={(e) => {
                      setIsProvinceLgu(e.target.checked);
                    }}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer m-0"
                  />
                  <span className="text-xs sm:text-sm font-medium text-gray-900 select-none whitespace-nowrap">
                    PROVINCE
                  </span>
                </label>
              </div>
              <datalist id="lgu-list-mobile">
                {lguOptions.map((l, idx) => <option key={l.psgc || idx} value={l.name} />)}
              </datalist>
            </div>
            <div className="border border-gray-300 rounded-lg p-3 bg-blue-50">
              <label className="block font-semibold text-sm text-gray-900 mb-2">CONTACT PERSON *</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => {
                  setContactPerson(e.target.value);
                  // Clear error message when user types
                  if (contactPersonError) {
                    setContactPersonError('');
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && !validateContactPerson(value)) {
                    setContactPersonError('Contact Person cannot contain only numbers.');
                  } else {
                    setContactPersonError('');
                  }
                }}
                className={`w-full px-3 py-2.5 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base ${
                  contactPersonError ? 'border-red-500' : ''
                }`}
                required
              />
              {contactPersonError && (
                <p className="text-xs text-red-600 mt-1">{contactPersonError}</p>
              )}
            </div>
            <div className="border border-gray-300 rounded-lg p-3 bg-blue-50">
              <label className="block font-semibold text-sm text-gray-900 mb-2">CONTACT NO. *</label>
              <input
                type="text"
                value={contactNo}
                onChange={(e) => setContactNo(formatContactNumber(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded text-gray-900 bg-white text-base"
                required
                maxLength={11}
                pattern="[0-9]{11}"
                title="Contact number must be exactly 11 digits"
              />
              {contactNo && contactNo.length !== 11 && (
                <p className="text-xs text-red-600 mt-1">Contact number must be exactly 11 digits</p>
              )}
            </div>
            <div className="border border-gray-300 rounded-lg p-3 bg-blue-50">
              <label className="block font-semibold text-sm text-gray-900 mb-2">EMAIL ADDRESS *</label>
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className={`w-full px-3 py-2.5 border border-gray-300 rounded text-gray-900 bg-white text-base ${
                  emailAddress && !validateEmail(emailAddress) ? 'border-red-500' : ''
                }`}
                required
              />
              {emailAddress && !validateEmail(emailAddress) && (
                <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
              )}
            </div>
          </div>

          {/* Desktop Table Layout */}
          <table className="hidden sm:table w-full border-collapse border border-gray-300 mb-6">
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">CONFERENCE</td>
                <td className="border border-gray-300 p-2 text-gray-900">{conference?.name?.toUpperCase() || '18TH MINDANAO GEOGRAPHIC CONFERENCE'}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">PROVINCE</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    list="provinces-list"
                    value={province}
                    onChange={handleProvinceChange}
                    onInput={handleProvinceChange}
                    onBlur={(e) => {
                      // Validate that the value exists in the provinces list
                      const enteredValue = e.target.value.trim().toUpperCase();
                      const isValid = provinces.some(p => p.toUpperCase() === enteredValue);
                      if (!isValid && enteredValue !== '') {
                        setProvince('');
                      }
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded uppercase text-gray-900 bg-white"
                    required
                  />
                  <datalist id="provinces-list">
                    {provinces.map(p => <option key={p} value={p} />)}
                  </datalist>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">LGU</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type="text"
                      list="lgu-list"
                      value={lgu}
                      onChange={handleLguChange}
                      onInput={handleLguChange}
                      onBlur={(e) => {
                        if (!isProvinceLgu) {
                          // Validate that the value exists in the LGU options list
                          const enteredValue = e.target.value.trim().toUpperCase();
                          const isValid = lguOptions.some(l => l.name.toUpperCase() === enteredValue);
                          if (!isValid && enteredValue !== '') {
                            setLgu('');
                            setSelectedLguPsgc('');
                          }
                        }
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded uppercase text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={isProvinceLgu}
                      required
                    />
                    <label htmlFor="province-lgu-checkbox" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        id="province-lgu-checkbox"
                        checked={isProvinceLgu}
                        onChange={(e) => {
                          setIsProvinceLgu(e.target.checked);
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer m-0"
                      />
                      <span className="text-sm font-medium text-gray-900 select-none whitespace-nowrap">
                        PROVINCE
                      </span>
                    </label>
                  </div>
                  <datalist id="lgu-list">
                    {lguOptions.map((l, idx) => <option key={l.psgc || idx} value={l.name} />)}
                  </datalist>
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">CONTACT PERSON</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      // Clear error message when user types
                      if (contactPersonError) {
                        setContactPersonError('');
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && !validateContactPerson(value)) {
                        setContactPersonError('Contact Person cannot contain only numbers.');
                      } else {
                        setContactPersonError('');
                      }
                    }}
                    className={`w-full px-2 py-1 border border-gray-300 rounded uppercase text-gray-900 bg-white ${
                      contactPersonError ? 'border-red-500' : ''
                    }`}
                    required
                  />
                  {contactPersonError && (
                    <p className="text-xs text-red-600 mt-1">{contactPersonError}</p>
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">CONTACT NO.</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="text"
                    value={contactNo}
                    onChange={(e) => setContactNo(formatContactNumber(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white"
                    required
                    maxLength={11}
                    pattern="[0-9]{11}"
                    title="Contact number must be exactly 11 digits"
                  />
                  {contactNo && contactNo.length !== 11 && (
                    <p className="text-xs text-red-600 mt-1">Contact number must be exactly 11 digits</p>
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900">EMAIL ADDRESS</td>
                <td className="border border-gray-300 p-2 bg-blue-50">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className={`w-full px-2 py-1 border border-gray-300 rounded text-gray-900 bg-white ${
                      emailAddress && !validateEmail(emailAddress) ? 'border-red-500' : ''
                    }`}
                    required
                  />
                  {emailAddress && !validateEmail(emailAddress) && (
                    <p className="text-xs text-red-600 mt-1">Please enter a valid email address</p>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mb-4 text-xs sm:text-sm text-gray-600">
            <strong>NOTE:</strong> T-shirt size is limited to S, M, L, XL, XXL
          </p>

          {/* Participants Section - Mobile Card Layout */}
          <div className="block md:hidden mb-6">
            <div className="bg-gray-200 border border-gray-300 rounded-t-lg p-3 text-center mb-2">
              <span className="text-base font-bold text-gray-900">LIST OF PARTICIPANTS</span>
              <span className="block text-sm font-normal text-gray-700 mt-1">
                (Total: {participants.length} {participants.length === 1 ? 'participant' : 'participants'})
              </span>
            </div>
            <div className="space-y-4">
              {participants.map((participant, index) => (
                <div key={participant.id} className="border border-gray-300 rounded-lg p-4 bg-blue-50 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-gray-900">Participant #{index + 1}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => deleteParticipant(participant.id)}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 touch-target"
                        disabled={participants.length === 1}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => insertParticipant(participant.id)}
                        disabled={participants.length >= MAX_PARTICIPANTS}
                        className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed touch-target"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={participant.lastName}
                        onChange={(e) => updateParticipant(participant.id, 'lastName', e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          value={participant.firstName}
                          onChange={(e) => updateParticipant(participant.id, 'firstName', e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">M.I. *</label>
                        <input
                          type="text"
                          value={participant.middleInit}
                          onChange={(e) => updateParticipant(participant.id, 'middleInit', e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                          maxLength={2}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Suffix</label>
                        <input
                          type="text"
                          value={participant.suffix}
                          onChange={(e) => updateParticipant(participant.id, 'suffix', e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                          maxLength={12}
                          placeholder="JR, SR, II"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Position *</label>
                      <input
                        type="text"
                        list={`position-list-mobile-${participant.id}`}
                        value={participant.position}
                        onChange={(e) => handlePositionChange(participant.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                        placeholder="Enter or select position"
                        required
                      />
                      <datalist id={`position-list-mobile-${participant.id}`}>
                        {getFilteredPositions(participant.lgu || lgu).map(position => <option key={position.name} value={position.name} />)}
                      </datalist>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">LGU *</label>
                        <input
                          type="text"
                          value={participant.lgu || lgu}
                          onChange={(e) => {
                            const newValue = e.target.value.toUpperCase();
                            updateParticipant(participant.id, 'lgu', newValue === lgu ? '' : newValue);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                          placeholder={lgu || 'Enter LGU'}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Barangay</label>
                        <input
                          type="text"
                          list={`barangay-list-mobile-${participant.id}`}
                          value={participant.barangay}
                          onChange={(e) => handleBarangayChange(participant.id, e)}
                          onInput={(e) => handleBarangayChange(participant.id, e)}
                          className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                          disabled={!lgu || !isBarangayEnabled(participant)}
                        />
                        <datalist id={`barangay-list-mobile-${participant.id}`}>
                          {barangayOptions.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">T-Shirt Size *</label>
                      <select
                        value={participant.tshirt}
                        onChange={(e) => updateParticipant(participant.id, 'tshirt', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded uppercase text-gray-900 bg-white text-base"
                        required
                      >
                        <option value="">Select Size</option>
                        {TSHIRT_SIZES.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Participants Table - Desktop Layout */}
          <div className="hidden md:block overflow-x-auto mb-6">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th colSpan={9} className="border border-gray-300 p-2 bg-gray-200 text-center">
                    <span className="text-lg font-bold text-gray-900">LIST OF PARTICIPANTS</span>
                    <span className="ml-4 text-base font-normal text-gray-700">
                      (Total: {participants.length} {participants.length === 1 ? 'participant' : 'participants'})
                    </span>
                  </th>
                </tr>
                <tr>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">LAST NAME</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">FIRST NAME</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-16">M.I.</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-16">SUFFIX</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-48">POSITION</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">LGU</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">BARANGAY</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-32">T-SHIRT</th>
                  <th className="border border-gray-300 p-2 bg-gray-200 w-40 text-gray-900">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="border border-gray-300 p-1.5 md:p-2 bg-blue-50">
                      <input
                        type="text"
                        value={participant.lastName}
                        onChange={(e) => updateParticipant(participant.id, 'lastName', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 md:py-1 border-0 bg-transparent uppercase text-gray-900 text-sm"
                        required
                      />
                    </td>
                    <td className="border border-gray-300 p-1.5 md:p-2 bg-blue-50">
                      <input
                        type="text"
                        value={participant.firstName}
                        onChange={(e) => updateParticipant(participant.id, 'firstName', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 md:py-1 border-0 bg-transparent uppercase text-gray-900 text-sm"
                        required
                      />
                    </td>
                    <td className="border border-gray-300 p-1.5 md:p-2 bg-blue-50 w-16">
                      <input
                        type="text"
                        value={participant.middleInit}
                        onChange={(e) => updateParticipant(participant.id, 'middleInit', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 md:py-1 border-0 bg-transparent uppercase text-gray-900 text-sm"
                        maxLength={2}
                        required
                      />
                    </td>
                    <td className="border border-gray-300 p-1.5 md:p-2 bg-blue-50 w-16">
                      <input
                        type="text"
                        value={participant.suffix}
                        onChange={(e) => updateParticipant(participant.id, 'suffix', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 md:py-1 border-0 bg-transparent uppercase text-gray-900 text-sm"
                        maxLength={12}
                        placeholder="JR, SR, II"
                      />
                    </td>
                    <td className="border border-gray-300 p-1.5 md:p-2 bg-blue-50 w-48">
                      <input
                        type="text"
                        list={`position-list-${participant.id}`}
                        value={participant.position}
                        onChange={(e) => handlePositionChange(participant.id, e.target.value)}
                        className="w-full px-2 py-1.5 md:py-1 border-0 bg-transparent uppercase text-gray-900 text-sm"
                        placeholder="Enter position"
                        required
                      />
                      <datalist id={`position-list-${participant.id}`}>
                        {getFilteredPositions(participant.lgu || lgu).map(position => <option key={position.name} value={position.name} />)}
                      </datalist>
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
                        required
                      />
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50">
                      <input
                        type="text"
                        list={`barangay-list-${participant.id}`}
                        value={participant.barangay}
                        onChange={(e) => handleBarangayChange(participant.id, e)}
                        onInput={(e) => handleBarangayChange(participant.id, e)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                        disabled={!lgu || !isBarangayEnabled(participant)}
                        title={!lgu ? 'Please select an LGU first' : (!isBarangayEnabled(participant) ? 'Barangay is only enabled for positions with level BGY' : '')}
                      />
                      <datalist id={`barangay-list-${participant.id}`}>
                        {barangayOptions.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </td>
                    <td className="border border-gray-300 p-1 bg-blue-50 w-32">
                      <select
                        value={participant.tshirt}
                        onChange={(e) => updateParticipant(participant.id, 'tshirt', e.target.value)}
                        className="w-full px-1 py-0.5 border-0 bg-transparent uppercase text-gray-900"
                        required
                      >
                        <option value="">Select Size</option>
                        {TSHIRT_SIZES.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
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
                          disabled={participants.length >= MAX_PARTICIPANTS}
                          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center relative mt-6">
            <Link
              href="/"
              className="order-3 sm:order-1 text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center sm:justify-start gap-1 font-medium py-2 px-4 touch-target text-sm sm:text-base"
              title="Back to Home"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Back</span>
            </Link>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center flex-1 order-1 sm:order-2">
            <button
              type="button"
              onClick={addParticipant}
              disabled={participants.length >= MAX_PARTICIPANTS}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-target text-sm sm:text-base font-semibold"
            >
              Add New Row {participants.length >= MAX_PARTICIPANTS && `(Max ${MAX_PARTICIPANTS})`}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors touch-target text-sm sm:text-base font-semibold"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            </div>
          </div>

          {/* Submit Message */}
          {submitMessage && (
            <div className={`mt-4 p-4 rounded ${submitMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {submitMessage.text}
            </div>
          )}
        </form>

        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 ml-3">Unable to submit registration</h2>
                </div>
                <div className="mb-6">
                  <p className="text-gray-700 whitespace-pre-line">{errorModalMessage}</p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowErrorModal(false);
                      setErrorModalMessage('');
                    }}
                    className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && pendingFormData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-[95vw] sm:max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-3 sm:p-4 md:p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Confirm Registration Details</h2>
                <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-6">Please review all details below. Click &quot;Confirm and Submit&quot; if everything is correct.</p>
                
                {/* Header Details */}
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Header Information</h3>
                  {/* Mobile Card Layout */}
                  <div className="block sm:hidden space-y-2">
                    <div className="border border-gray-300 rounded p-2 bg-gray-100">
                      <div className="text-xs font-semibold text-gray-900 mb-1">Conference</div>
                      <div className="text-xs text-gray-900">{conference?.name?.toUpperCase() || '18TH MINDANAO GEOGRAPHIC CONFERENCE'}</div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                      <div className="text-xs font-semibold text-gray-900 mb-1">Province</div>
                      <div className="text-xs text-gray-900">{pendingFormData.PROVINCE || 'Not provided'}</div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                      <div className="text-xs font-semibold text-gray-900 mb-1">LGU</div>
                      <div className="text-xs text-gray-900">{pendingFormData.LGU || 'Not provided'}</div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                      <div className="text-xs font-semibold text-gray-900 mb-1">Contact Person</div>
                      <div className="text-xs text-gray-900">{pendingFormData.CONTACTPERSON || 'Not provided'}</div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                      <div className="text-xs font-semibold text-gray-900 mb-1">Contact Number</div>
                      <div className="text-xs text-gray-900">{pendingFormData.CONTACTNUMBER || 'Not provided'}</div>
                    </div>
                    <div className="border border-gray-300 rounded p-2">
                      <div className="text-xs font-semibold text-gray-900 mb-1">Email Address</div>
                      <div className="text-xs text-gray-900 break-words">{pendingFormData.EMAILADDRESS || 'Not provided'}</div>
                    </div>
                  </div>
                  {/* Desktop Table Layout */}
                  <table className="hidden sm:table w-full border-collapse border border-gray-300">
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2 bg-gray-100 font-semibold text-gray-900 w-1/3">Conference</td>
                        <td className="border border-gray-300 p-2 text-gray-900">{conference?.name?.toUpperCase() || '18TH MINDANAO GEOGRAPHIC CONFERENCE'}</td>
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
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Participants ({pendingFormData.DETAILCOUNT})</h3>
                  {/* Mobile Card Layout */}
                  <div className="block md:hidden space-y-3">
                    {Array.from({ length: parseInt(pendingFormData.DETAILCOUNT) }).map((_, index) => {
                      const formatDate = (dateStr: string) => {
                        if (!dateStr) return '';
                        const date = new Date(dateStr);
                        return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US');
                      };
                      return (
                        <div key={index} className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                          <div className="font-bold text-xs text-gray-900 mb-2">Participant #{index + 1}</div>
                          <div className="space-y-1.5 text-xs">
                            <div><span className="font-semibold text-gray-700">Name:</span> <span className="text-gray-900">{pendingFormData[`LASTNAME|${index}`] || '-'}, {pendingFormData[`FIRSTNAME|${index}`] || '-'} {pendingFormData[`MI|${index}`] || ''} {pendingFormData[`SUFFIX|${index}`] || ''}</span></div>
                            <div><span className="font-semibold text-gray-700">Position:</span> <span className="text-gray-900">{pendingFormData[`DESIGNATION|${index}`] || '-'}</span></div>
                            <div><span className="font-semibold text-gray-700">LGU:</span> <span className="text-gray-900">{pendingFormData[`LGU|${index}`] || '-'}</span></div>
                            <div><span className="font-semibold text-gray-700">Barangay:</span> <span className="text-gray-900">{pendingFormData[`BRGY|${index}`] || '-'}</span></div>
                            <div><span className="font-semibold text-gray-700">T-Shirt:</span> <span className="text-gray-900">{pendingFormData[`TSHIRTSIZE|${index}`] || '-'}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop/Tablet Table Layout with horizontal scroll */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm min-w-[800px]">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">#</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Last Name</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">First Name</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-16">M.I.</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-16">Suffix</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-48">Position</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">LGU</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900">Barangay</th>
                          <th className="border border-gray-300 p-2 bg-gray-200 font-semibold text-gray-900 w-32">T-Shirt</th>
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
                              <td className="border border-gray-300 p-2 text-gray-900 w-16">{pendingFormData[`MI|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900 w-16">{pendingFormData[`SUFFIX|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900 w-48">{pendingFormData[`DESIGNATION|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`LGU|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900">{pendingFormData[`BRGY|${index}`] || '-'}</td>
                              <td className="border border-gray-300 p-2 text-gray-900 w-32">{pendingFormData[`TSHIRTSIZE|${index}`] || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-4 sm:mt-6">
                  <button
                    type="button"
                    onClick={handleCancelSubmit}
                    className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors touch-target text-sm sm:text-base font-semibold"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors touch-target text-sm sm:text-base font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Confirm and Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

