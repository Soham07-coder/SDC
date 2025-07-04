import React, { useState , useEffect, useRef} from 'react';
import axios from 'axios';

const PG_2_B = ({ viewOnly = false, data = {} }) => {
  const [formData, setFormData] = useState({
    studentName: '',
    yearOfAdmission: '',
    feesPaid: 'No',
    department: '', // ✅ added
    projectTitle: '',
    guideName: '',
    coGuideName: '',
    conferenceDate: '',
    organization: '',
    publisher: '',
    paperLink: '',
    authors: ['', '', '', ''],
    bankDetails: {
      beneficiary: '',
      ifsc: '',
      bankName: '',
      branch: '',
      accountType: '',
      accountNumber: ''
    },
    registrationFee: '',
    previousClaim: 'No',
    claimDate: '',
    amountReceived: '',
    amountSanctioned: '',
    status: 'pending'
  });

  const [files, setFiles] = useState({
    paperCopy: null, // Will store { id, filename } object or File object
    groupLeaderSignature: null, // Will store { id, filename } object or File object
    guideSignature: null, // Will store { id, filename } object or File object
    additionalDocuments: [] // Will store array of { id, filename } objects or File objects
  });

  // Refs for file inputs to clear them after submission
  const paperCopyRef = useRef(null);
  const groupLeaderSignatureRef = useRef(null);
  const guideSignatureRef = useRef(null);
  const additionalDocumentsRef = useRef(null);


  useEffect(() => {
    if (viewOnly && data && Object.keys(data).length > 0) {
      setFormData({
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        feesPaid: data.feesPaid || 'No',
        department: data.department || '', // ✅ populate department
        projectTitle: data.projectTitle || '',
        guideName: data.guideName || '',
        coGuideName: data.coGuideName || '',
        conferenceDate: data.conferenceDate?.$date?.slice(0, 10) || data.conferenceDate?.slice(0, 10) || '', // Handle $date
        organization: data.organization || '',
        publisher: data.publisher || '',
        paperLink: data.paperLink || '',
        authors: Array.isArray(data.authors) ? data.authors.map(a => a || '') : ['', '', '', ''],
        bankDetails: {
          beneficiary: data.bankDetails?.beneficiary || '',
          ifsc: data.bankDetails?.ifsc || '',
          bankName: data.bankDetails?.bankName || '',
          branch: data.bankDetails?.branch || '',
          accountType: data.bankDetails?.accountType || '',
          accountNumber: data.bankDetails?.accountNumber || ''
        },
        registrationFee: data.registrationFee || '',
        previousClaim: data.previousClaim || 'No',
        claimDate: data.claimDate?.$date?.slice(0, 10) || data.claimDate?.slice(0, 10) || '', // Handle $date
        amountReceived: data.amountReceived || '',
        amountSanctioned: data.amountSanctioned || '',
        status: data.status || 'pending'
      });

      // Helper function to extract ID from $oid structure
      const extractFileMetadata = (fileData) => {
        if (!fileData) return null;
        return {
          id: fileData.id?.$oid || fileData.id, // Extract ID from $oid or use directly
          filename: fileData.filename,
          originalName: fileData.originalName,
          mimetype: fileData.mimetype,
          size: fileData.size
        };
      };

      // Set files for preview using the full file objects (which contain id and filename)
      setFiles({
        paperCopy: extractFileMetadata(data.paperCopy),
        groupLeaderSignature: extractFileMetadata(data.groupLeaderSignature),
        guideSignature: extractFileMetadata(data.guideSignature),
        additionalDocuments: Array.isArray(data.additionalDocuments)
          ? data.additionalDocuments.map(extractFileMetadata).filter(Boolean) // Filter out any nulls
          : []
      });
    }
  }, [data, viewOnly]);

  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [userMessage, setUserMessage] = useState({ text: '', type: '' });

  // Determine user role and if student
  const [currentUserRole, setCurrentUserRole] = useState("");
  const isStudent = currentUserRole === "student";

  // Effect to load user role from localStorage
  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (user.role) {
          setCurrentUserRole(user.role);
        }
      } catch (e) {
        console.error("Failed to parse user data from localStorage:", e);
      }
    }
  }, []);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };

  const handleAuthorChange = (index, value) => {
    const updatedAuthors = [...formData.authors];
    updatedAuthors[index] = value;
    setFormData(prev => ({ ...prev, authors: updatedAuthors }));
  };

  const handleRemoveFile = (field, index) => {
    setFiles((prev) => {
      const updated = Array.from(prev[field]);
      updated.splice(index, 1);
      return {
        ...prev,
        [field]: updated
      };
    });
  };

  const handleFileChange = (field, event) => {
    const selected = event.target.files;
  
    if (!selected || selected.length === 0) return;
  
    if (field === 'additionalDocuments') {
      const newFiles = Array.from(selected);
      const allFiles = [...(files.additionalDocuments || []), ...newFiles];
  
      // Filter by file types
      const validFiles = allFiles.filter(file =>
        ['application/pdf', 'application/zip', 'application/x-zip-compressed'].includes(file.type) ||
        file.name.endsWith('.zip') // fallback for zip mime-type
      );
  
      // Enforce limit: 5 PDFs + 2 ZIPs max
      let pdfCount = 0, zipCount = 0;
      const finalFiles = [];
  
      for (const file of validFiles) {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          if (pdfCount < 5) {
            finalFiles.push(file);
            pdfCount++;
          }
        } else if (
          file.type === 'application/zip' ||
          file.type === 'application/x-zip-compressed' ||
          file.name.endsWith('.zip')
        ) {
          if (zipCount < 2) {
            finalFiles.push(file);
            zipCount++;
          }
        }
      }
  
      setFiles((prev) => ({
        ...prev,
        additionalDocuments: finalFiles
      }));
    } else {
      // Single file fields
      setFiles((prev) => ({
        ...prev,
        [field]: selected[0]
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};

    const requiredFields = [
      "studentName", "yearOfAdmission", "projectTitle", "guideName",
      "conferenceDate", "organization", "publisher", "paperLink",
      "registrationFee"
    ];
    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = "This field is required.";
      }
    });

    // File validation only if not in viewOnly mode and it's a student submitting
    if (!viewOnly && isStudent) {
      if (!files.paperCopy) {
        newErrors.paperCopy = "Paper copy is required.";
      }
      if (!files.groupLeaderSignature) {
        newErrors.groupLeaderSignature = "Student's signature is required.";
      }
      if (!files.guideSignature) {
        newErrors.guideSignature = "Guide's signature is required.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (viewOnly) {
      setUserMessage({ text: 'Form is in view-only mode, cannot submit.', type: "error" });
      return;
    }

    // Only students can submit
    if (!isStudent) {
      setUserMessage({ text: 'Only students are allowed to submit this form.', type: "error" });
      return;
    }

    const isValid = validateForm();
    if (!isValid) {
      setUserMessage({ text: "Please fix the errors in the form before submitting.", type: "error" });
      return;
    }

    setLoading(true);

    let svvNetId = null;
    let department = null;

    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);

        if (Array.isArray(user.svvNetId)) {
          svvNetId = user.svvNetId.find(id => id && id.trim() !== '') || '';
        } else if (typeof user.svvNetId === 'string') {
          svvNetId = user.svvNetId;
        }

        if (Array.isArray(user.branch)) {
          department = user.branch.find(b => b && b.trim() !== '') || '';
        } else if (typeof user.branch === 'string') {
          department = user.branch;
        }

      } catch (e) {
        console.error("Failed to parse user data from localStorage for submission:", e);
        setUserMessage({ text: "User session corrupted. Please log in again.", type: "error" });
        setLoading(false);
        return;
      }
    }

    if (!svvNetId || !department || svvNetId.trim() === '' || department.trim() === '') {
      setUserMessage({ text: "Authentication error: User ID or department not found. Please log in.", type: "error" });
      setLoading(false);
      return;
    }

    const submissionData = new FormData();
    submissionData.append('svvNetId', svvNetId);
    submissionData.append('department', department); // ✅ append department

    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'svvNetId' || key === 'department') return;

      if (['authors', 'bankDetails'].includes(key)) {
        submissionData.append(key, JSON.stringify(value));
      } else {
        submissionData.append(key, value);
      }
    });

    // Required files - ensure these are File objects for submission
    if (files.paperCopy instanceof File) submissionData.append('paperCopy', files.paperCopy);
    if (files.groupLeaderSignature instanceof File) submissionData.append('groupLeaderSignature', files.groupLeaderSignature);
    if (files.guideSignature instanceof File) submissionData.append('guideSignature', files.guideSignature);

    // Optional additional documents
    if (Array.isArray(files.additionalDocuments)) {
      files.additionalDocuments.forEach(file => {
        if (file instanceof File) { // Only append if it's a new File object
          submissionData.append('additionalDocuments', file);
        }
      });
    }

    try {
      const response = await axios.post(
        'http://localhost:5000/api/pg2bform/submit',
        submissionData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.status === 200 || response.status === 201) {
        setUserMessage({
          text: `Form submitted successfully! Submission ID: ${response.data.id || 'N/A'}`,
          type: "success"
        });

        // Reset form
        if (!viewOnly) {
          setFormData({
            studentName: '',
            yearOfAdmission: '',
            feesPaid: 'No',
            department: '', // ✅ reset department
            projectTitle: '',
            guideName: '',
            coGuideName: '',
            conferenceDate: '',
            organization: '',
            publisher: '',
            paperLink: '',
            authors: ['', '', '', ''],
            bankDetails: {
              beneficiary: '',
              ifsc: '',
              bankName: '',
              branch: '',
              accountType: '',
              accountNumber: ''
            },
            registrationFee: '',
            previousClaim: 'No',
            claimDate: '',
            amountReceived: '',
            amountSanctioned: '',
            status: 'pending',
            svvNetId: ''
          });

          setFiles({
            paperCopy: null,
            groupLeaderSignature: null,
            guideSignature: null,
            additionalDocuments: []
          });

          setErrors({});

          // Clear refs
          if (paperCopyRef.current) paperCopyRef.current.value = null;
          if (groupLeaderSignatureRef.current) groupLeaderSignatureRef.current.value = null;
          if (guideSignatureRef.current) guideSignatureRef.current.value = null;
          if (additionalDocumentsRef.current) additionalDocumentsRef.current.value = null;
        }

      } else {
        const errorData = response.data;
        setUserMessage({
          text: `Submission failed: ${errorData.message || errorData.error || 'Unexpected server error.'}`,
          type: "error"
        });
      }

    } catch (error) {
      console.error('Error submitting form:', error.response?.data || error.message);
      let errorMessage = 'Submission failed. Please check your network and try again.';
      if (error.response?.data?.error) {
        errorMessage = `Submission failed: ${error.response.data.error}`;
      } else if (error.response?.data?.message) {
        errorMessage = `Submission failed: ${error.response.data.message}`;
      }
      setUserMessage({ text: errorMessage, type: "error" });

    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Post Graduate Form 2B - Reputed Conference</h1>
      
      {userMessage.text && (
        <div className={`p-3 mb-4 rounded text-center ${userMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {userMessage.text}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center underline">Application Form</h2>
        
        {/* Student Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name of the Student</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="studentName"
                  value={formData.studentName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.studentName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.studentName && <p className="text-red-500 text-xs mt-1">{errors.studentName}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Year of Admission</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="yearOfAdmission"
                  value={formData.yearOfAdmission}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.yearOfAdmission ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.yearOfAdmission && <p className="text-red-500 text-xs mt-1">{errors.yearOfAdmission}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Whether Paid fees for Current Academic Year</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="feesPaid"
                  value={formData.feesPaid}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Title of the Project</th>
              <td colSpan="5" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="projectTitle"
                  value={formData.projectTitle}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.projectTitle ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.projectTitle && <p className="text-red-500 text-xs mt-1">{errors.projectTitle}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Guide and Conference Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name of the Guide / Co-guide</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="guideName"
                  value={formData.guideName}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.guideName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.guideName && <p className="text-red-500 text-xs mt-1">{errors.guideName}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Date of Conference / Project Competition</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="conferenceDate"
                  value={formData.conferenceDate}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.conferenceDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.conferenceDate && <p className="text-red-500 text-xs mt-1">{errors.conferenceDate}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name and address of organization / institution</th>
              <td colSpan="3" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.organization ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.organization && <p className="text-red-500 text-xs mt-1">{errors.organization}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Publisher Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name and Address of the Publisher (For address one may give website address)</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="publisher"
                  value={formData.publisher}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.publisher ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.publisher && <p className="text-red-500 text-xs mt-1">{errors.publisher}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">If paper is available online, then state link</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="url"
                  name="paperLink"
                  value={formData.paperLink}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.paperLink ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.paperLink && <p className="text-red-500 text-xs mt-1">{errors.paperLink}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Authors */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {formData.authors.map((author, index) => (
            <div key={index}>
              <label className="block font-semibold mb-1">Author {index + 1} Name</label>
              <input
                type="text"
                value={author}
                disabled={viewOnly}
                onChange={(e) => handleAuthorChange(index, e.target.value)}
                className="w-full p-1 border border-gray-300 rounded"
              />
            </div>
          ))}
        </div>

        <p className="text-sm italic mb-6 text-gray-600">*Attach a copy of paper published / presented / proof of participation in project competition along with the Reimbursement Form</p>

        {/* Bank Details */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100" colSpan="2">Bank details for RTGS/NEFT</th>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Beneficiary name, brief address and mobile no. (Student author)</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="beneficiary"
                  value={formData.bankDetails.beneficiary}
                  disabled={viewOnly}
                  onChange={handleBankChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">IFSC Code</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="ifsc"
                  value={formData.bankDetails.ifsc}
                  disabled={viewOnly}
                  onChange={handleBankChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name of the bank</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankDetails.bankName}
                  disabled={viewOnly}
                  onChange={handleBankChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Branch</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="branch"
                  value={formData.bankDetails.branch}
                  disabled={viewOnly}
                  onChange={handleBankChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Account type</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="accountType"
                  value={formData.bankDetails.accountType}
                  disabled={viewOnly}
                  onChange={handleBankChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Account number</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.bankDetails.accountNumber}
                  disabled={viewOnly}
                  onChange={handleBankChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Payment Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Registration Fees Paid</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="registrationFee"
                  value={formData.registrationFee}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className={`w-full p-1 border rounded ${errors.registrationFee ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Rs.___________"
                />
                {errors.registrationFee && <p className="text-red-500 text-xs mt-1">{errors.registrationFee}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Have you claimed previously for any paper / project competition under this scheme:</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="previousClaim"
                  value={formData.previousClaim}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className="w-full p-1 border border-gray-300 rounded"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Date of Received Claim</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="claimDate"
                  value={formData.claimDate}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Amount Received</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="amountReceived"
                  value={formData.amountReceived}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className="w-full p-1 border border-gray-300 rounded"
                  placeholder="Rs.___________"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Amount sanctioned</th>
              <td colSpan="7" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="amountSanctioned"
                  value={formData.amountSanctioned}
                  disabled={viewOnly}
                  onChange={handleChange}
                  className="w-full p-1 border border-gray-300 rounded"
                  placeholder="Rs.___________"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mb-6 text-gray-700">The participation by the student was relevant to their Final Year project and affiliation to the institute was clearly mentioned.</p>

        {/* File Uploads / Previews Section */}
        {(!viewOnly || !isStudent) && ( // Show section if not viewOnly OR if viewOnly but not a student
          <div className="mb-6 space-y-4">
            {/* Paper Copy Upload / Preview */}
            <div>
              <label className="block font-semibold mb-2">*Attach proof documents:</label>
              {viewOnly && files.paperCopy && files.paperCopy.id ? ( // Check for file.id for preview
                <div>
                  <a href={`http://localhost:5000/api/pg2bform/file/${files.paperCopy.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View Paper Copy ({files.paperCopy.filename})
                  </a>
                </div>
              ) : (
                <div className="flex items-center">
                  <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                    Choose Paper Copy
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileChange('paperCopy', e)}
                      ref={paperCopyRef}
                    />
                  </label>
                  <span className="ml-2 text-sm">
                    {files.paperCopy ? (files.paperCopy instanceof File ? files.paperCopy.name : files.paperCopy.filename) : "No file chosen"}
                  </span>
                </div>
              )}
              {errors.paperCopy && <p className="text-red-500 text-xs mt-1">{errors.paperCopy}</p>}
            </div>

            {/* Signatures Upload / Preview */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Signature of Student (JPEG Only)</label>
                {viewOnly && files.groupLeaderSignature && files.groupLeaderSignature.id ? ( // Check for file.id for preview
                  <div>
                    <a href={`http://localhost:5000/api/pg2bform/file/${files.groupLeaderSignature.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      View Student Signature ({files.groupLeaderSignature.filename})
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                      Choose File
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg"
                        onChange={(e) => handleFileChange('groupLeaderSignature', e)}
                        ref={groupLeaderSignatureRef}
                      />
                    </label>
                    <span className="ml-2 text-sm">
                      {files.groupLeaderSignature ? (files.groupLeaderSignature instanceof File ? files.groupLeaderSignature.name : files.groupLeaderSignature.filename) : "No file chosen"}
                    </span>
                  </div>
                )}
                {errors.groupLeaderSignature && <p className="text-red-500 text-xs mt-1">{errors.groupLeaderSignature}</p>}
              </div>

              <div>
                <label className="block font-semibold mb-2">Signature of Guide (JPEG Only)</label>
                {viewOnly && files.guideSignature && files.guideSignature.id ? ( // Check for file.id for preview
                  <div>
                    <a href={`http://localhost:5000/api/pg2bform/file/${files.guideSignature.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      View Guide Signature ({files.guideSignature.filename})
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                      Choose File
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg"
                        onChange={(e) => handleFileChange('guideSignature', e)}
                        ref={guideSignatureRef}
                      />
                    </label>
                    <span className="ml-2 text-sm">
                      {files.guideSignature ? (files.guideSignature instanceof File ? files.guideSignature.name : files.guideSignature.filename) : "No file chosen"}
                    </span>
                  </div>
                )}
                {errors.guideSignature && <p className="text-red-500 text-xs mt-1">{errors.guideSignature}</p>}
              </div>
            </div>

            {/* Additional Documents Upload / Preview */}
            <div>
              <label className="block font-semibold mb-2">Additional Documents (PDF & ZIP only)</label>
              {viewOnly && files.additionalDocuments && files.additionalDocuments.length > 0 ? (
                <div className="ml-2 mt-2 text-sm space-y-1">
                  <p className="font-medium">Uploaded Additional Documents:</p>
                  <ul className="list-disc ml-5">
                    {files.additionalDocuments.map((file, index) => (
                      <li key={index}>
                        {file.id ? ( // Check if file object has an ID
                          <a href={`http://localhost:5000/api/pg2bform/file/${file.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {file.filename}
                          </a>
                        ) : (
                          // Fallback if somehow only filename is available (shouldn't happen with correct data prop)
                          <span>{file.filename || file}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="flex items-center">
                    <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                      Choose File(s)
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.zip"
                        onChange={(e) => handleFileChange('additionalDocuments', e)}
                        ref={additionalDocumentsRef}
                      />
                    </label>
                  </div>
                  {/* Show selected files with remove option */}
                  <div className="ml-2 mt-2 text-sm space-y-1">
                    {files.additionalDocuments && files.additionalDocuments.length > 0 ? (
                      Array.from(files.additionalDocuments).map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                        >
                          <span className="truncate">{typeof file === 'string' ? file : file.name}</span>
                          {!viewOnly && ( // Allow removal only if not in viewOnly mode
                            <button
                              type="button"
                              onClick={() => handleRemoveFile('additionalDocuments', index)}
                              className="text-red-600 hover:underline text-xs ml-2"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <span>No file chosen</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Form Actions */}
        <div className="flex justify-between">
          <button onClick={() => window.history.back()} className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600">
            Back
          </button>
          {!viewOnly && isStudent && (
            <button onClick={handleSubmit} className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PG_2_B;
