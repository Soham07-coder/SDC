import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios'; // Assuming axios is used for API calls

// Placeholder for user message state
const useUserMessage = () => {
  const [userMessage, setUserMessage] = useState({ text: "", type: "" }); // type: 'success' | 'error'

  useEffect(() => {
    if (userMessage.text) {
      const timer = setTimeout(() => {
        setUserMessage({ text: "", type: "" });
      }, 5000); // Message disappears after 5 seconds
      return () => clearTimeout(timer); // Cleanup timer
    }
  }, [userMessage]);

  return [userMessage, setUserMessage];
};

// Placeholder for validation logic (adapt as needed for R1 form)
const validateForm = (formData, files, viewOnly) => {
  const newErrors = {};

  // Example: Check for required fields
  const requiredFields = [
    "studentName", "yearOfAdmission", "paperTitle", "guideName",
    "sttpTitle", "organizers", "reasonForAttending",
    "numberOfDays", "dateFrom", "dateTo", "registrationFee"
  ];
  for (const field of requiredFields) {
    if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
      newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`;
    }
  }

  // File requirements (only for new submissions, not in viewOnly mode)
  if (!viewOnly) {
      if (!files.studentSignature) newErrors.studentSignature = 'Student signature is required.';
      if (!files.guideSignature) newErrors.guideSignature = 'Guide signature is required.';
      if (!files.hodSignature) newErrors.hodSignature = 'HOD signature is required.';
      // At least one proof document (proofDocument OR pdfs)
      if (!files.proofDocument && files.pdfs.length === 0) {
        newErrors.proofDocument = 'At least one proof document (single proof document or multiple PDFs) is required.';
      }
  }

  // Example: Author validation
  const nonEmptyAuthors = formData.authors.filter(author => author && author.trim() !== '');
  if (nonEmptyAuthors.length === 0) {
    newErrors.authors = 'At least one author name is required';
  }

  // Example: Bank details validation
  const { beneficiary, ifsc, bankName, branch, accountType, accountNumber } = formData.bankDetails;
  if (!beneficiary || beneficiary.trim() === '') newErrors.beneficiary = 'Beneficiary name is required';
  if (!ifsc || ifsc.trim() === '') newErrors.ifsc = 'IFSC code is required';
  if (!bankName || bankName.trim() === '') newErrors.bankName = 'Bank name is required';
  if (!branch || branch.trim() === '') newErrors.branch = 'Branch is required';
  if (!accountType || accountType.trim() === '') newErrors.accountType = 'Account type is required';
  if (!accountNumber || accountNumber.trim() === '') newErrors.accountNumber = 'Account number is required';

  // Return the errors object. The caller will check if it's empty.
  return newErrors;
};


const R1 = ({ data, viewOnly }) => { // Assuming this is your R1 form component
  // Define the base URL for fetching files from your backend's /file/:fileId route
  const baseFileUrl = 'http://localhost:5000/api/r1form/file'; // Adjust if your R1 file serving route is different
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState(() => {
    // Helper to get formatted date string for input type="date"
    const getFormattedDate = (dateString) => {
        return dateString ? new Date(dateString).toISOString().slice(0, 10) : '';
    };

    const baseFormData = {
      guideName: '',
      coGuideName: '',
      employeeCodes: [], // Initialize as an empty array as backend expects array
      studentName: '',
      yearOfAdmission: '',
      branch: '',
      rollNo: '',
      mobileNo: '',
      feesPaid: 'No',
      receivedFinance: 'No',
      financeDetails: '',
      paperTitle: '',
      paperLink: '',
      authors: ['', '', '', ''],
      sttpTitle: '',
      organizers: '',
      reasonForAttending: '',
      numberOfDays: '',
      dateFrom: '',
      dateTo: '',
      registrationFee: '',
      dateOfSubmission: '',
      remarksByHod: '',
      bankDetails: {
        beneficiary: '',
        ifsc: '',
        bankName: '',
        branch: '',
        accountType: '',
        accountNumber: ''
      },
      amountClaimed: '',
      finalAmountSanctioned: '',
      status: 'pending',
      svvNetId: '', // Initialize svvNetId
    };

    if (viewOnly && data) {
      return {
        ...baseFormData, // Start with defaults
        guideName: data.guideName || '',
        coGuideName: data.coGuideName || '',
        employeeCodes: Array.isArray(data.employeeCodes) ? data.employeeCodes : (data.employeeCodes ? [data.employeeCodes] : []),
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        branch: data.branch || '',
        rollNo: data.rollNo || '',
        mobileNo: data.mobileNo || '',
        feesPaid: data.feesPaid || 'No',
        receivedFinance: data.receivedFinance || 'No',
        financeDetails: data.financeDetails || '',
        paperTitle: data.paperTitle || '',
        paperLink: data.paperLink || '',
        authors: Array.isArray(data.authors) ? data.authors : ['', '', '', ''],
        sttpTitle: data.sttpTitle || '',
        organizers: data.organizers || '',
        reasonForAttending: data.reasonForAttending || '',
        numberOfDays: data.numberOfDays || '',
        dateFrom: getFormattedDate(data.dateFrom),
        dateTo: getFormattedDate(data.dateTo),
        registrationFee: data.registrationFee || '',
        dateOfSubmission: getFormattedDate(data.dateOfSubmission),
        remarksByHod: data.remarksByHod || '',
        bankDetails: data.bankDetails || baseFormData.bankDetails,
        amountClaimed: data.amountClaimed || '',
        finalAmountSanctioned: data.finalAmountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data?.svvNetId || '', // FIXED: Added optional chaining here
      };
    }
    return baseFormData;
  });

  const [files, setFiles] = useState(() => {
    // Helper to process a single file metadata object into a frontend-friendly format
    const processSingleFileMetadata = (fileMetadata) => {
      if (!fileMetadata || !fileMetadata.id) return null;
      return {
        file: null, // Always null for existing files; they are URLs
        name: fileMetadata.originalName || fileMetadata.filename || 'Unknown File',
        url: `${baseFileUrl}/${fileMetadata.id}`,
        id: fileMetadata.id // Keep the ID for potential future use or display
      };
    };

    // Helper to process an array of file metadata objects
    const processMultipleFilesMetadata = (filesArray) => {
      if (!Array.isArray(filesArray)) return [];
      return filesArray.map(doc => ({
        file: null, // Always null for existing files; they are URLs
        name: doc.originalName || doc.filename || 'Unknown Document',
        url: `${baseFileUrl}/${doc.id}`,
        id: doc.id
      }));
    };

    if (viewOnly && data) {
      return {
        // Access nested file metadata objects from data.proofDocumentFileId etc.
        proofDocument: processSingleFileMetadata(data.proofDocumentFileId),
        // receiptCopy is not in R1Form backend, removed it from this state for consistency
        studentSignature: processSingleFileMetadata(data.studentSignatureFileId),
        guideSignature: processSingleFileMetadata(data.guideSignatureFileId),
        hodSignature: processSingleFileMetadata(data.hodSignatureFileId),
        sdcChairpersonSignature: processSingleFileMetadata(data.sdcChairpersonSignatureFileId), // SDC Chairperson
        pdfs: processMultipleFilesMetadata(data.pdfFileIds), // Changed to 'pdfs'
        zipFile: processSingleFileMetadata(data.zipFileId), // Changed to 'zipFile'
      };
    }
    return {
      proofDocument: null,
      // receiptCopy: null, // Removed
      studentSignature: null,
      guideSignature: null,
      hodSignature: null,
      sdcChairpersonSignature: null,
      pdfs: [], // Changed to 'pdfs'
      zipFile: null, // Changed to 'zipFile'
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [userMessage, setUserMessage] = useUserMessage();

  // Refs for file inputs (needed to clear file input value after selection/removal)
  const proofDocumentRef = useRef(null);
  const studentSignatureRef = useRef(null);
  const guideSignatureRef = useRef(null);
  const hodSignatureRef = useRef(null);
  const sdcChairpersonSignatureRef = useRef(null);
  const pdfsRef = useRef(null);
  const zipFileRef = useRef(null);


  // Update form and files when data prop changes (for view/edit mode)
  useEffect(() => {
    const getFormattedDate = (dateString) => {
        return dateString ? new Date(dateString).toISOString().slice(0, 10) : '';
    };

    const processSingleFileMetadata = (fileMetadata) => {
      if (!fileMetadata || !fileMetadata.id) return null;
      return {
        file: null, // Always null for existing files; they are URLs
        name: fileMetadata.originalName || fileMetadata.filename || 'Unknown File',
        url: `${baseFileUrl}/${fileMetadata.id}`,
        id: fileMetadata.id // Keep the ID for potential future use or display
      };
    };

    const processMultipleFilesMetadata = (filesArray) => {
      if (!Array.isArray(filesArray)) return [];
      return filesArray.map(doc => ({
        file: null, // Always null for existing files; they are URLs
        name: doc.originalName || doc.filename || 'Unknown Document',
        url: `${baseFileUrl}/${doc.id}`,
        id: doc.id
      }));
    };

    if (viewOnly && data && Object.keys(data).length > 0) {
      setFormData(prevFormData => ({
        ...prevFormData,
        guideName: data.guideName || '',
        coGuideName: data.coGuideName || '',
        employeeCodes: Array.isArray(data.employeeCodes) ? data.employeeCodes : (data.employeeCodes ? [data.employeeCodes] : []),
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        branch: data.branch || '',
        rollNo: data.rollNo || '',
        mobileNo: data.mobileNo || '',
        feesPaid: data.feesPaid || 'No',
        receivedFinance: data.receivedFinance || 'No',
        financeDetails: data.financeDetails || '',
        paperTitle: data.paperTitle || '',
        paperLink: data.paperLink || '',
        authors: Array.isArray(data.authors) ? data.authors : ['', '', '', ''],
        sttpTitle: data.sttpTitle || '',
        organizers: data.organizers || '',
        reasonForAttending: data.reasonForAttending || '',
        numberOfDays: data.numberOfDays || '',
        dateFrom: getFormattedDate(data.dateFrom),
        dateTo: getFormattedDate(data.dateTo),
        registrationFee: data.registrationFee || '',
        dateOfSubmission: getFormattedDate(data.dateOfSubmission),
        remarksByHod: data.remarksByHod || '',
        bankDetails: data.bankDetails || prevFormData.bankDetails,
        amountClaimed: data.amountClaimed || '',
        finalAmountSanctioned: data.finalAmountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
      }));

      // Populate files state using the new metadata structure from the backend
      setFiles({
        proofDocument: processSingleFileMetadata(data.proofDocumentFileId),
        // receiptCopy removed from R1Form specific logic
        studentSignature: processSingleFileMetadata(data.studentSignatureFileId),
        guideSignature: processSingleFileMetadata(data.guideSignatureFileId),
        hodSignature: processSingleFileMetadata(data.hodSignatureFileId),
        sdcChairpersonSignature: processSingleFileMetadata(data.sdcChairpersonSignatureFileId),
        pdfs: processMultipleFilesMetadata(data.pdfFileIds), // Changed to 'pdfs'
        zipFile: processSingleFileMetadata(data.zipFileId), // Changed to 'zipFile'
      });

      setErrors({});
      setUserMessage({ text: "", type: "" });

    } else if (!viewOnly) {
      console.log("Resetting R1 form state for new submission.");
      setFormData({
        guideName: '', coGuideName: '', employeeCodes: [], studentName: '', yearOfAdmission: '', branch: '',
        rollNo: '', mobileNo: '', feesPaid: 'No', receivedFinance: 'No', financeDetails: '',
        paperTitle: '', paperLink: '', authors: ['', '', '', ''], sttpTitle: '', organizers: '',
        reasonForAttending: '', numberOfDays: '', dateFrom: '', dateTo: '', registrationFee: '',
        dateOfSubmission: '', remarksByHod: '',
        bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
        amountClaimed: '', finalAmountSanctioned: '', status: 'pending',
        svvNetId: '',
      });
      setFiles({
        proofDocument: null, // receiptCopy removed
        studentSignature: null, guideSignature: null,
        hodSignature: null, sdcChairpersonSignature: null, pdfs: [], zipFile: null, // Changed to 'pdfs' and 'zipFile'
      });
      setErrors({});
      setUserMessage({ text: "", type: "" });
      // Clear file input refs on reset
      if (proofDocumentRef.current) proofDocumentRef.current.value = null;
      if (studentSignatureRef.current) studentSignatureRef.current.value = null;
      if (guideSignatureRef.current) guideSignatureRef.current.value = null;
      if (hodSignatureRef.current) hodSignatureRef.current.value = null;
      if (sdcChairpersonSignatureRef.current) sdcChairpersonSignatureRef.current.value = null;
      if (pdfsRef.current) pdfsRef.current.value = null;
      if (zipFileRef.current) zipFileRef.current.value = null;
    }
  }, [data, viewOnly, baseFileUrl]); // Added baseFileUrl to dependencies

  // --- Handlers for form fields ---
  const handleChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const renderFileDisplay = (fileKey, label) => {
    const file = files[fileKey];
  
    if (fileKey === 'pdfs') {
      if (viewOnly && Array.isArray(file)) {
        return (
          <div className="flex flex-col space-y-1">
            {file.map((pdf, i) => (
              <a key={i} href={pdf.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                View {pdf.name}
              </a>
            ))}
          </div>
        );
      } else if (!viewOnly) {
        return (
          <div className="flex flex-col">
            <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
              Upload PDFs (max 5)
              <input
                type="file"
                multiple
                accept="application/pdf"
                onChange={(e) => handleFileChange('pdfs', e)}
                className="hidden"
              />
            </label>
            <span className="mt-1 text-sm text-gray-600">
              {Array.isArray(file) && file.length > 0 ? file.map(f => f.name || f).join(', ') : "No PDFs chosen"}
            </span>
          </div>
        );
      }
    }
  
    if (fileKey === 'zip') {
      if (viewOnly && file?.url) {
        return (
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            View ZIP File
          </a>
        );
      } else if (!viewOnly) {
        return (
          <div className="flex items-center">
            <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
              Upload ZIP
              <input
                type="file"
                accept=".zip"
                onChange={(e) => handleFileChange('zip', e)}
                className="hidden"
              />
            </label>
            <span className="ml-2 text-sm text-gray-600">
              {file ? file.name : "No ZIP selected"}
            </span>
          </div>
        );
      }
    }
  
    // Default for other single files
    if (viewOnly && file?.url) {
      return (
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          View {label}
        </a>
      );
    } else if (!viewOnly) {
      return (
        <div className="flex items-center">
          <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
            Choose File
            <input
              type="file"
              className="hidden"
              accept={fileKey.includes('Signature') ? 'image/*' : '*'}
              onChange={(e) => handleFileChange(fileKey, e)}
            />
          </label>
          <span className="ml-2 text-sm">
            {file ? file.name || 'File selected' : "No file chosen"}
          </span>
        </div>
      );
    }
  
    return <span className="text-sm text-gray-400">No file uploaded</span>;
  };

  const handleBankChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleAuthorChange = (index, value) => {
    if (viewOnly) return;
    const updatedAuthors = [...formData.authors];
    updatedAuthors[index] = value;
    setFormData(prev => ({ ...prev, authors: updatedAuthors }));
    setErrors(prev => ({ ...prev, authors: undefined }));
  };

  const handleEmployeeCodeChange = (e) => {
    if (viewOnly) return;
    const { value } = e.target;
    const codesArray = value.split(',').map(code => code.trim()).filter(code => code !== '');
    setFormData(prev => ({ ...prev, employeeCodes: codesArray }));
    setErrors(prev => ({ ...prev, employeeCodes: undefined }));
  };

  // --- File Handlers ---
  const handleRemoveFile = (field, fileIndex = null) => {
    if (viewOnly) return;
    setFiles((prev) => {
      if (Array.isArray(prev[field])) {
        const updated = prev[field].filter((_, idx) => idx !== fileIndex);
        return { ...prev, [field]: updated };
      } else {
        return { ...prev, [field]: null };
      }
    });
    // Reset file input value
    if (field === 'proofDocument' && proofDocumentRef.current) proofDocumentRef.current.value = null;
    if (field === 'studentSignature' && studentSignatureRef.current) studentSignatureRef.current.value = null;
    if (field === 'guideSignature' && guideSignatureRef.current) guideSignatureRef.current.value = null;
    if (field === 'hodSignature' && hodSignatureRef.current) hodSignatureRef.current.value = null;
    if (field === 'sdcChairpersonSignature' && sdcChairpersonSignatureRef.current) sdcChairpersonSignatureRef.current.value = null;
    if (field === 'pdfs' && pdfsRef.current) pdfsRef.current.value = null;
    if (field === 'zipFile' && zipFileRef.current) zipFileRef.current.value = null;

    setErrors(prev => ({ ...prev, [field]: undefined }));
  };


  const handleFileChange = (field, event) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(event.target.files);

    if (!selectedFiles || selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      if (file.size > 25 * 1024 * 1024) {
        setUserMessage({ text: `File "${file.name}" is too large. Max size is 25MB.`, type: "error" });
        if (event.target) event.target.value = null;
        return;
      }

      if (field === 'proofDocument' && file.type !== 'application/pdf') {
        setUserMessage({ text: `Proof Document "${file.name}" must be a PDF.`, type: "error" });
        if (event.target) event.target.value = null;
        return;
      }
      if (field.includes('Signature') && !file.type.startsWith('image/')) {
        setUserMessage({ text: `Signature file "${file.name}" must be an image (JPEG/PNG).`, type: "error" });
        if (event.target) event.target.value = null;
        return;
      }
      if (field === 'pdfs' && file.type !== 'application/pdf') {
        setUserMessage({ text: `PDF file "${file.name}" must be a PDF.`, type: "error" });
        if (event.target) event.target.value = null;
        return;
      }
      if (field === 'zipFile' && !['application/zip', 'application/x-zip-compressed'].includes(file.type)) {
        setUserMessage({ text: `ZIP file "${file.name}" must be a ZIP archive.`, type: "error" });
        if (event.target) event.target.value = null;
        return;
      }
    }

    if (field === 'pdfs') {
      const currentPdfs = files.pdfs.filter(f => f instanceof File); // Filter out old URL objects from view mode
      const allPdfs = [...currentPdfs, ...selectedFiles];
      if (allPdfs.length > 5) {
        setUserMessage({ text: "You can upload a maximum of 5 PDF files.", type: "error" });
        if (event.target) event.target.value = null;
        return;
      }
      setFiles(prev => ({ ...prev, pdfs: allPdfs }));
    } else { // Single file fields
      setFiles(prev => ({ ...prev, [field]: selectedFiles[0] }));
    }
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };


  // --- Form Submission Handler ---
  const handleSubmit = async () => {
    if (viewOnly) {
      setUserMessage({ text: 'Form is in view-only mode, cannot submit.', type: "error" });
      return;
    }

    const validationErrors = validateForm(formData, files, viewOnly); // Pass files to validateForm
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setUserMessage({ text: "Please fix the errors in the form before submitting.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    let svvNetId = null;
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (Array.isArray(user.svvNetId)) {
          svvNetId = user.svvNetId.find(id => id && id.trim() !== '') || '';
        } else if (typeof user.svvNetId === 'string') {
          svvNetId = user.svvNetId;
        } else {
          console.error("Unexpected type for user.svvNetId in localStorage:", typeof user.svvNetId);
        }
      } catch (e) {
        console.error("Failed to parse user data from localStorage for submission:", e);
        setUserMessage({ text: "User session corrupted. Please log in again.", type: "error" });
        setIsSubmitting(false);
        return;
      }
    }

    if (!svvNetId || svvNetId.trim() === '') {
      setUserMessage({ text: "Authentication error: User ID (svvNetId) not found or invalid. Please log in.", type: "error" });
      setIsSubmitting(false);
      return;
    }

    const submissionData = new FormData();

    // Append svvNetId
    submissionData.append('svvNetId', svvNetId);

    // Append form data fields
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'svvNetId') return; // Already appended

      if (['authors', 'bankDetails', 'employeeCodes'].includes(key)) {
        submissionData.append(key, JSON.stringify(value));
      } else {
        submissionData.append(key, value);
      }
    });

    // --- Append files to FormData based on backend's Multer configuration ---
    // Single 'proofDocument' file
    if (files.proofDocument instanceof File) {
      submissionData.append('proofDocument', files.proofDocument);
    }

    // Single signature files
    if (files.studentSignature instanceof File) submissionData.append('studentSignature', files.studentSignature);
    if (files.guideSignature instanceof File) submissionData.append('guideSignature', files.guideSignature);
    if (files.hodSignature instanceof File) submissionData.append('hodSignature', files.hodSignature);
    if (files.sdcChairpersonSignature instanceof File) submissionData.append('sdcChairpersonSignature', files.sdcChairpersonSignature);

    // Multiple PDF files (backend expects 'pdfs')
    if (Array.isArray(files.pdfs)) {
      files.pdfs.forEach(file => {
        if (file instanceof File) {
          submissionData.append('pdfs', file);
        }
      });
    }

    // Single ZIP file (backend expects 'zipFile')
    if (files.zipFile instanceof File) {
      submissionData.append('zipFile', files.zipFile);
    }
    // --- End of file appending ---

    try {
      const response = await axios.post(
        'http://localhost:5000/api/r1form/submit',
        submissionData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;
        setUserMessage({ text: `Form submitted successfully! Submission ID: ${responseData.id || 'N/A'}`, type: "success" });
        console.log('Server response:', responseData);
        // Reset form for new submission
        if (!viewOnly) {
          setFormData(prev => ({
            ...prev,
            guideName: '', coGuideName: '', employeeCodes: [], studentName: '', yearOfAdmission: '', branch: '',
            rollNo: '', mobileNo: '', feesPaid: 'No', receivedFinance: 'No', financeDetails: '',
            paperTitle: '', paperLink: '', authors: ['', '', '', ''], sttpTitle: '', organizers: '',
            reasonForAttending: '', numberOfDays: '', dateFrom: '', dateTo: '', registrationFee: '',
            dateOfSubmission: '', remarksByHod: '',
            bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
            amountClaimed: '', finalAmountSanctioned: '', status: 'pending',
            svvNetId: '',
          }));
          setFiles({
            proofDocument: null, studentSignature: null, guideSignature: null,
            hodSignature: null, sdcChairpersonSignature: null, pdfs: [], zipFile: null,
          });
          setErrors({});
          // Clear file input refs
          if (proofDocumentRef.current) proofDocumentRef.current.value = null;
          if (studentSignatureRef.current) studentSignatureRef.current.value = null;
          if (guideSignatureRef.current) guideSignatureRef.current.value = null;
          if (hodSignatureRef.current) hodSignatureRef.current.value = null;
          if (sdcChairpersonSignatureRef.current) sdcChairpersonSignatureRef.current.value = null;
          if (pdfsRef.current) pdfsRef.current.value = null;
          if (zipFileRef.current) zipFileRef.current.value = null;
        }
      } else {
        const errorData = response.data;
        console.error('Server responded with error:', response.status, errorData);
        setUserMessage({ text: `Submission failed: ${errorData.message || errorData.error || 'An unexpected error occurred.'}`, type: "error" });
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
      setIsSubmitting(false);
    }
  };

   return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Research Form R1 {viewOnly && <span className="text-blue-600">(View Only)</span>}
      </h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Application Form</h2>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMessage}
          </div>
        )}
        
        {/* Guide and Student Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name/s of the guide / co-guide (wherever applicable)</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="guideName"
                  value={formData.guideName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                  placeholder="Guide Name"
                  required
                />
                <input
                  type="text"
                  name="coGuideName"
                  value={formData.coGuideName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded mt-2 disabled:bg-gray-100"
                  placeholder="Co-guide Name"
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Employee Codes</th>
              <td className="p-2 border border-gray-300">
                {!viewOnly ? (
                <input
                  type="text"
                  name="employeeCodes"
                  value={formData.employeeCodes || ''}
                  onChange={handleChange}
                  className="w-full p-1 border border-gray-300 rounded"
                  placeholder="e.g., 35363, 12345"
                />
              ) : (
                <p className="text-gray-700">
                  {/* THIS IS THE CRITICAL LINE THAT NEEDS THE TYPE CHECK */}
                  {typeof formData.employeeCodes === 'string' && formData.employeeCodes.trim() !== ''
                    ? formData.employeeCodes // Display the string value
                    : 'N/A'}
                </p>
              )}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name of the student</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="studentName"
                  value={formData.studentName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                  placeholder="Student Name"
                  required
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Year of Admission</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="yearOfAdmission"
                  value={formData.yearOfAdmission}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Branch</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Roll No.</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="rollNo"
                  value={formData.rollNo}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                  required
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Mobile No.</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="mobileNo"
                  value={formData.mobileNo}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Whether Paid fees for Current Academic Year</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="feesPaid"
                  value={formData.feesPaid}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Whether received finance from any other agency</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="receivedFinance"
                  value={formData.receivedFinance}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
              <td colSpan="2" className="p-2 border border-gray-300">
                {formData.receivedFinance === 'Yes' && (
                  <input
                    type="text"
                    name="financeDetails"
                    value={formData.financeDetails}
                    onChange={handleChange}
                    disabled={viewOnly}
                    className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                    placeholder="Provide details"
                  />
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Journal/Paper/Poster Section */}
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h3 className="font-semibold mb-4 text-lg">For Journal/Paper/Poster Presentation</h3>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1">Title of Paper</label>
            <input
              type="text"
              name="paperTitle"
              value={formData.paperTitle}
              onChange={handleChange}
              disabled={viewOnly}
              className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
            />
          </div>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1">If paper is available online, then state link</label>
            <input
              type="url"
              name="paperLink"
              value={formData.paperLink}
              onChange={handleChange}
              disabled={viewOnly}
              className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
            />
          </div>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1">Names of Authors</label>
            <div className="grid grid-cols-2 gap-4">
              {formData.authors.map((author, index) => (
                <div key={index}>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => handleAuthorChange(index, e.target.value)}
                    disabled={viewOnly}
                    className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                    placeholder={`Author ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STTP/Workshop Section */}
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h3 className="font-semibold mb-4 text-lg">For attending STTP/Workshops</h3>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1">Title of the STTP/Workshop</label>
            <input
              type="text"
              name="sttpTitle"
              value={formData.sttpTitle}
              onChange={handleChange}
              disabled={viewOnly}
              className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
            />
          </div>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1">Name and address of organizers (give website also)</label>
            <input
              type="text"
              name="organizers"
              value={formData.organizers}
              onChange={handleChange}
              disabled={viewOnly}
              className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
            />
          </div>
          
          <div className="mb-4">
            <label className="block font-semibold mb-1">Brief reason for attending the Workshop/STTP</label>
            <textarea
              name="reasonForAttending"
              value={formData.reasonForAttending}
              onChange={handleChange}
              disabled={viewOnly}
              className="w-full p-1 border border-gray-300 rounded h-20 disabled:bg-gray-100"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold mb-1">Number of days of Workshop/STTP</label>
              <input
                type="number"
                name="numberOfDays"
                value={formData.numberOfDays}
                onChange={handleChange}
                disabled={viewOnly}
                className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">From Date</label>
              <input
                type="date"
                name="dateFrom"
                value={formData.dateFrom}
                onChange={handleChange}
                disabled={viewOnly}
                className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">To Date</label>
              <input
                type="date"
                name="dateTo"
                value={formData.dateTo}
                onChange={handleChange}
                disabled={viewOnly}
                className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        <p className="text-sm italic mb-6 text-gray-600">*Attach a copy of paper published / presented / proof of participation/registration fee receipt</p>

        {/* Bank Details */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100" colSpan="2">Bank details for RTGS/NEFT</th>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Registration fee paid: Rs.</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="registrationFee"
                  value={formData.registrationFee}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                  placeholder="Rs.___________"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Beneficiary name, brief address and mobile no.</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="beneficiary"
                  value={formData.bankDetails.beneficiary}
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
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
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
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
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
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
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
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
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
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
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* File Uploads */}
        <div className="mb-6 space-y-4">
          {/* Multiple PDFs (max 5) */}
          <div>
            <label className="block font-semibold mb-2">Attach up to 5 proof documents (PDF):</label>
            {viewOnly ? (
              Array.isArray(files.pdfs) && files.pdfs.length > 0 ? (
                files.pdfs.map((file, idx) => (
                  <div key={idx}>
                    {renderFileDisplay(`pdfs[${idx}]`, `Proof Document ${idx + 1}`)}
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No proof documents uploaded.</p>
              )
            ) : (
              <>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => {
                    const selectedFiles = Array.from(e.target.files).slice(0, 5); // limit to 5 PDFs
                    setFiles(prev => ({ ...prev, pdfs: selectedFiles }));
                  }}
                />
                {Array.isArray(files.pdfs) && files.pdfs.length > 0 && (
                  <ul className="text-sm mt-1 list-disc pl-5">
                    {files.pdfs.map((file, idx) => (
                      <li key={idx}>{file.name}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* ZIP file */}
          <div>
            <label className="block font-semibold mb-2">Attach ZIP file (optional):</label>
            {viewOnly ? (
              renderFileDisplay('zip', 'ZIP File')
            ) : (
              <>
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={(e) => {
                    const selectedFile = e.target.files[0];
                    if (selectedFile) {
                      setFiles(prev => ({ ...prev, zip: selectedFile }));
                    }
                  }}
                />
                {files.zip && <p className="text-sm mt-1">{files.zip.name}</p>}
              </>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="mb-6">
          <div className="mb-4">
            <label className="block font-semibold mb-2">Date of Submission:</label>
            <input
              type="date"
              name="dateOfSubmission"
              value={formData.dateOfSubmission}
              onChange={handleChange}
              disabled={viewOnly}
              className="w-full p-1 border border-gray-300 rounded max-w-xs disabled:bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Student Signature */}
            <div>
              <label className="block font-semibold mb-2">Signature of the student</label>
              {!viewOnly && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('studentSignature', e)}
                />
              )}
              {files.studentSignature && !viewOnly && <p className="text-sm mt-1">{files.studentSignature.name}</p>}
            </div>

            {/* Guide Signature */}
            <div>
              <label className="block font-semibold mb-2">Signature of Guide / Co-guide</label>
              {!viewOnly && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('guideSignature', e)}
                />
              )}
              {files.guideSignature && !viewOnly && <p className="text-sm mt-1">{files.guideSignature.name}</p>}
            </div>
          </div>

          {/* HOD Signature */}
          <div className="mb-4">
            <label className="block font-semibold mb-2">Remarks by HOD:</label>
              {!viewOnly ? (
                <textarea
                  name="remarksByHod"
                  value={formData.remarksByHod || ''} // Ensure value is a string, default to empty string
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded h-20"
                  placeholder="Enter remarks here..."
                ></textarea>
              ) : (
                <p className="w-full p-2 border border-gray-300 rounded h-20 bg-gray-100 whitespace-pre-wrap">
                  {formData.remarksByHod && formData.remarksByHod.trim() !== ''
                    ? formData.remarksByHod
                    : 'No remarks provided.'}
                </p>
              )}
          </div>

          <div className="mb-4">
            <label className="block font-semibold mb-2">Signature of HOD</label>
            {!viewOnly && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange('hodSignature', e)}
              />
            )}
            {files.hodSignature && !viewOnly && <p className="text-sm mt-1">{files.hodSignature.name}</p>}
          </div>
        </div>

        {/* Approval Section */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Amount claimed</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="amountClaimed"
                  value={formData.amountClaimed}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                  placeholder="Rs.___________"
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Final Amount sanctioned</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="finalAmountSanctioned"
                  value={formData.finalAmountSanctioned}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded disabled:bg-gray-100"
                  placeholder="Rs.___________"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Signature of chairperson of SDC with date:</th>
              <td colSpan="3" className="p-2 border border-gray-300">
                <div className="flex items-center">
                  {!viewOnly ? (
                    <>
                      <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                        Upload Signature
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleFileChange('sdcChairpersonSignature', e)}
                        />
                      </label>
                      <span className="ml-2 text-sm">
                        {files.sdcChairpersonSignature
                          ? files.sdcChairpersonSignature.name || 'File selected'
                          : 'No file chosen'}
                      </span>
                      <input
                        type="date"
                        name="sdcChairpersonDate"
                        value={formData.sdcChairpersonDate}
                        onChange={handleChange}
                        disabled={viewOnly}
                        className="ml-2 p-1 border border-gray-300 rounded"
                      />
                    </>
                  ) : (
                    <>
                      {renderFileDisplay('sdcChairpersonSignature', 'SDC Chairperson Signature')}
                      {formData?.sdcChairpersonDate && (
                        <span className="ml-2 text-sm text-gray-600">({formData.sdcChairpersonDate})</span>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={() => window.history.back()} 
            className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
          >
            Back
          </button>
          {!viewOnly && (
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 ${isSubmitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default R1;