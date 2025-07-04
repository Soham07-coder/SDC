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
const validateForm = (formData, files, viewOnly, isStudent) => {
  const newErrors = {};

  // Example: Check for required fields
  const requiredFields = [
    "studentName", "yearOfAdmission", "paperTitle", "guideName",
    "sttpTitle", "organizers", "reasonForAttending",
    "numberOfDays", "dateFrom", "dateTo", "registrationFee"
  ];
  for (const field of requiredFields) {
    if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '') || formData[field] === null) {
      newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`;
    }
  }

  // File requirements (only for new submissions by students)
  if (!viewOnly && isStudent) {
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
      sdcChairpersonDate: '', // Added for SDC Chairperson date
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
        sdcChairpersonDate: getFormattedDate(data.sdcChairpersonDate), // Populate SDC Chairperson date
      };
    }
    return baseFormData;
  });

  const [files, setFiles] = useState(() => {
    // Helper to process a single file metadata object into a frontend-friendly format
    const processSingleFileMetadata = (fileMetadata) => {
      // Handle MongoDB $oid structure
      const fileId = fileMetadata?.id?.$oid || fileMetadata?.id;
      if (!fileId) return null;
      return {
        file: null, // Always null for existing files; they are URLs
        name: fileMetadata.originalName || fileMetadata.filename || 'Unknown File',
        url: `${baseFileUrl}/${fileId}`, // Use extracted ID
        id: fileId // Keep the ID for potential future use or display
      };
    };

    // Helper to process an array of file metadata objects
    const processMultipleFilesMetadata = (filesArray) => {
      if (!Array.isArray(filesArray)) return [];
      return filesArray.map(doc => {
        const fileId = doc?.id?.$oid || doc?.id; // Handle $oid nesting
        if (!fileId) return null;
        return {
          file: null, // Always null for existing files; they are URLs
          name: doc.originalName || doc.filename || 'Unknown Document',
          url: `${baseFileUrl}/${fileId}`,
          id: fileId
        };
      }).filter(Boolean); // Filter out any nulls
    };

    if (viewOnly && data) {
      return {
        // Access nested file metadata objects from data.proofDocumentFileId etc.
        proofDocument: processSingleFileMetadata(data.proofDocumentFileId),
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
      const fileId = fileMetadata?.id?.$oid || fileMetadata?.id;
      if (!fileId) return null;
      return {
        file: null, // Always null for existing files; they are URLs
        name: fileMetadata.originalName || fileMetadata.filename || 'Unknown File',
        url: `${baseFileUrl}/${fileId}`,
        id: fileId
      };
    };

    const processMultipleFilesMetadata = (filesArray) => {
      if (!Array.isArray(filesArray)) return [];
      return filesArray.map(doc => {
        const fileId = doc?.id?.$oid || doc?.id;
        if (!fileId) return null;
        return {
          file: null, // Always null for existing files; they are URLs
          name: doc.originalName || doc.filename || 'Unknown Document',
          url: `${baseFileUrl}/${fileId}`,
          id: fileId
        };
      }).filter(Boolean);
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
        sdcChairpersonDate: getFormattedDate(data.sdcChairpersonDate),
      }));

      // Populate files state using the new metadata structure from the backend
      setFiles({
        proofDocument: processSingleFileMetadata(data.proofDocumentFileId),
        studentSignature: processSingleFileMetadata(data.studentSignatureFileId),
        guideSignature: processSingleFileMetadata(data.guideSignatureFileId),
        hodSignature: processSingleFileMetadata(data.hodSignatureFileId),
        sdcChairpersonSignature: processSingleFileMetadata(data.sdcChairpersonSignatureFileId),
        pdfs: processMultipleFilesMetadata(data.pdfFileIds),
        zipFile: processSingleFileMetadata(data.zipFileId),
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
        svvNetId: '', sdcChairpersonDate: '',
      });
      setFiles({
        proofDocument: null,
        studentSignature: null, guideSignature: null,
        hodSignature: null, sdcChairpersonSignature: null, pdfs: [], zipFile: null,
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
  
    // If in viewOnly mode AND the current user is a student, do not display files.
    if (viewOnly && isStudent) {
      return null;
    }

    if (fileKey === 'pdfs') {
      if (viewOnly && Array.isArray(file) && file.length > 0) {
        return (
          <div className="flex flex-col space-y-1">
            {file.map((pdf, i) => (
              <a key={i} href={pdf.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                View {pdf.name}
              </a>
            ))}
          </div>
        );
      } else if (!viewOnly) { // Allow upload if not in viewOnly mode
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
                ref={pdfsRef}
              />
            </label>
            <span className="mt-1 text-sm text-gray-600">
              {Array.isArray(file) && file.length > 0 ? file.map(f => f.name || f).join(', ') : "No PDFs chosen"}
            </span>
          </div>
        );
      }
    }
  
    if (fileKey === 'zipFile') {
      if (viewOnly && file?.url) {
        return (
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            View ZIP File ({file.name})
          </a>
        );
      } else if (!viewOnly) { // Allow upload if not in viewOnly mode
        return (
          <div className="flex items-center">
            <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
              Upload ZIP
              <input
                type="file"
                accept=".zip"
                onChange={(e) => handleFileChange('zipFile', e)}
                className="hidden"
                ref={zipFileRef}
              />
            </label>
            <span className="ml-2 text-sm text-gray-600">
              {file ? file.name : "No ZIP selected"}
            </span>
          </div>
        );
      }
    }

    // Default for other single files (proofDocument, signatures)
    if (viewOnly && file?.url) { // If in viewOnly mode and file has a URL, display preview link
      return (
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          View {label} ({file.name})
        </a>
      );
    } else if (!viewOnly) { // If not in viewOnly mode, display file input for upload
      return (
        <div className="flex items-center">
          <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
            Choose File
            <input
              type="file"
              className="hidden"
              accept={fileKey.includes('Signature') ? 'image/*' : '*'} // Restrict signature to images
              onChange={(e) => handleFileChange(fileKey, e)}
              ref={
                fileKey === 'proofDocument' ? proofDocumentRef :
                fileKey === 'studentSignature' ? studentSignatureRef :
                fileKey === 'guideSignature' ? guideSignatureRef :
                fileKey === 'hodSignature' ? hodSignatureRef :
                fileKey === 'sdcChairpersonSignature' ? sdcChairpersonSignatureRef : null
              }
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
    setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [name]: value } }));
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
    // Reset file input value if (field === 'proofDocument' && proofDocumentRef.current) proofDocumentRef.current.value = null;
    if (proofDocumentRef.current) proofDocumentRef.current.value = null;
    if (studentSignatureRef.current) studentSignatureRef.current.value = null;
    if (guideSignatureRef.current) guideSignatureRef.current.value = null;
    if (hodSignatureRef.current) hodSignatureRef.current.value = null;
    if (sdcChairpersonSignatureRef.current) sdcChairpersonSignatureRef.current.value = null;
    if (pdfsRef.current) pdfsRef.current.value = null;
    if (zipFileRef.current) zipFileRef.current.value = null;
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleFileChange = (field, event) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(event.target.files);
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Clear previous error message related to file upload
    setUserMessage({ text: "", type: "" });

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
      if (field === 'zipFile' && file.type !== 'application/zip' && file.name.split('.').pop() !== 'zip') {
        setUserMessage({ text: `ZIP file "${file.name}" must be a ZIP archive.`, type: "error" });
        if (event.target) event.target.value = null;
        return;
      }
    }

    setFiles((prev) => {
      if (field === 'pdfs') {
        const currentPdfs = Array.isArray(prev.pdfs) ? prev.pdfs.filter(f => f.file) : []; // Keep only newly uploaded files
        const newPdfs = [...currentPdfs, ...selectedFiles.map(file => ({ file, name: file.name }))];
        if (newPdfs.length > 5) {
          setUserMessage({ text: "You can upload a maximum of 5 PDF files.", type: "error" });
          return prev; // Do not update state if limit exceeded
        }
        return { ...prev, [field]: newPdfs };
      } else {
        return { ...prev, [field]: { file: selectedFiles[0], name: selectedFiles[0].name } };
      }
    });
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission

    if (viewOnly) {
      setUserMessage({ text: 'Form is in view-only mode, cannot submit.', type: "error" });
      return;
    }

    // Only students can submit
    if (!isStudent) {
      setUserMessage({ text: 'Only students are allowed to submit this form.', type: "error" });
      return;
    }

    const formErrors = validateForm(formData, files, viewOnly, isStudent);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      setUserMessage({ text: "Please correct the errors in the form.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setUserMessage({ text: "", type: "" }); // Clear previous messages

    const submissionData = new FormData();

    // Append form data
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'authors' || key === 'bankDetails' || key === 'employeeCodes') {
        submissionData.append(key, JSON.stringify(value));
      } else {
        submissionData.append(key, value);
      }
    });

    // Retrieve svvNetId from localStorage and append
    let svvNetId = '';
    const userString = localStorage.getItem("user");
    if (userString) {
        try {
            const user = JSON.parse(userString);
            // Trim svvNetId immediately after extraction
            svvNetId = (user.svvNetId || '').trim();
            if (svvNetId) {
                submissionData.append('svvNetId', svvNetId);
            } else {
                setUserMessage({ text: "User ID (svvNetId) not found or is empty in local storage. Cannot submit.", type: "error" });
                setIsSubmitting(false);
                return;
            }
        } catch (e) {
            console.error("Failed to parse user data from localStorage:", e);
            setUserMessage({ text: "User session corrupted. Please log in again.", type: "error" });
            setIsSubmitting(false);
            return;
        }
    } else {
        setUserMessage({ text: "User data not found in local storage. Cannot submit.", type: "error" });
        setIsSubmitting(false);
        return;
    }

    // Append files
    if (files.proofDocument?.file) submissionData.append('proofDocument', files.proofDocument.file);
    if (files.studentSignature?.file) submissionData.append('studentSignature', files.studentSignature.file);
    if (files.guideSignature?.file) submissionData.append('guideSignature', files.guideSignature.file);
    if (files.hodSignature?.file) submissionData.append('hodSignature', files.hodSignature.file);
    if (files.sdcChairpersonSignature?.file) submissionData.append('sdcChairpersonSignature', files.sdcChairpersonSignature.file);
    if (files.zipFile?.file) submissionData.append('zipFile', files.zipFile.file);

    files.pdfs.forEach((pdfObj, index) => {
      if (pdfObj.file) { // Only append if it's a new File object
        submissionData.append(`pdfs`, pdfObj.file);
      }
    });

    try {
      const response = await axios.post('http://localhost:5000/api/r1form/submit', submissionData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 200 || response.status === 201) {
        setUserMessage({ text: "Form submitted successfully!", type: "success" });
        // Optionally reset form after successful submission
        setFormData(prev => ({
          ...prev,
          guideName: '', coGuideName: '', employeeCodes: [], studentName: '', yearOfAdmission: '', branch: '',
          rollNo: '', mobileNo: '', feesPaid: 'No', receivedFinance: 'No', financeDetails: '',
          paperTitle: '', paperLink: '', authors: ['', '', '', ''], sttpTitle: '', organizers: '',
          reasonForAttending: '', numberOfDays: '', dateFrom: '', dateTo: '', registrationFee: '',
          dateOfSubmission: '', remarksByHod: '',
          bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
          amountClaimed: '', finalAmountSanctioned: '', status: 'pending',
          svvNetId: '', sdcChairpersonDate: '',
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

      } else {
        setUserMessage({ text: `Submission failed: ${response.data.message || 'Unknown error'}`, type: "error" });
      }
    } catch (error) {
      console.error('Submission error:', error.response?.data || error.message);
      setUserMessage({ text: `Submission failed: ${error.response?.data?.message || error.message}`, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">R1 Form</h1>

      {userMessage.text && (
        <div className={`p-3 mb-4 rounded text-center ${userMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {userMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
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
                  className={`w-full p-1 border rounded ${errors.branch ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.branch && <p className="text-red-500 text-xs mt-1">{errors.branch}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Roll No.</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="rollNo"
                  value={formData.rollNo}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.rollNo ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.rollNo && <p className="text-red-500 text-xs mt-1">{errors.rollNo}</p>}
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
                  className={`w-full p-1 border rounded ${errors.mobileNo ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.mobileNo && <p className="text-red-500 text-xs mt-1">{errors.mobileNo}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Fees Paid for Current A.Y.</th>
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
              <th className="p-2 border border-gray-300 bg-gray-100">Received Financial Assistance in Current A.Y.</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="receivedFinance"
                  value={formData.receivedFinance}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Details of Financial Assistance</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="financeDetails"
                  value={formData.financeDetails}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.financeDetails ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.financeDetails && <p className="text-red-500 text-xs mt-1">{errors.financeDetails}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Paper / STTP Details */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Title of Paper / STTP / Workshop / Course</th>
              <td colSpan="3" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="paperTitle"
                  value={formData.paperTitle}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.paperTitle ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.paperTitle && <p className="text-red-500 text-xs mt-1">{errors.paperTitle}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Link of Paper (if available online)</th>
              <td colSpan="3" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="paperLink"
                  value={formData.paperLink}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.paperLink ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.paperLink && <p className="text-red-500 text-xs mt-1">{errors.paperLink}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Authors</th>
              <td colSpan="3" className="p-2 border border-gray-300">
                <div className="grid grid-cols-2 gap-2">
                  {formData.authors.map((author, index) => (
                    <input
                      key={index}
                      type="text"
                      value={author}
                      onChange={(e) => handleAuthorChange(index, e.target.value)}
                      disabled={viewOnly}
                      className="w-full p-1 border border-gray-300 rounded"
                      placeholder={`Author ${index + 1}`}
                    />
                  ))}
                </div>
                {errors.authors && <p className="text-red-500 text-xs mt-1">{errors.authors}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name of Guide</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="guideName"
                  value={formData.guideName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.guideName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.guideName && <p className="text-red-500 text-xs mt-1">{errors.guideName}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Co-Guide Name</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="coGuideName"
                  value={formData.coGuideName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className="w-full p-1 border border-gray-300 rounded"
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Employee Codes (comma-separated)</th>
              <td colSpan="3" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="employeeCodes"
                  value={formData.employeeCodes.join(', ')}
                  onChange={handleEmployeeCodeChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.employeeCodes ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="e.g., EMP001, EMP002"
                />
                {errors.employeeCodes && <p className="text-red-500 text-xs mt-1">{errors.employeeCodes}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Organizers</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="organizers"
                  value={formData.organizers}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.organizers ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.organizers && <p className="text-red-500 text-xs mt-1">{errors.organizers}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Reason for Attending</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="reasonForAttending"
                  value={formData.reasonForAttending}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.reasonForAttending ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.reasonForAttending && <p className="text-red-500 text-xs mt-1">{errors.reasonForAttending}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Number of Days</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="number"
                  name="numberOfDays"
                  value={formData.numberOfDays}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.numberOfDays ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.numberOfDays && <p className="text-red-500 text-xs mt-1">{errors.numberOfDays}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Date From</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="dateFrom"
                  value={formData.dateFrom}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.dateFrom ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.dateFrom && <p className="text-red-500 text-xs mt-1">{errors.dateFrom}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Date To</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="dateTo"
                  value={formData.dateTo}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.dateTo ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.dateTo && <p className="text-red-500 text-xs mt-1">{errors.dateTo}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Registration Fee</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="registrationFee"
                  value={formData.registrationFee}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.registrationFee ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.registrationFee && <p className="text-red-500 text-xs mt-1">{errors.registrationFee}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bank Details */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100" colSpan="2">Bank details for RTGS/NEFT</th>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Beneficiary Name</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="beneficiary"
                  value={formData.bankDetails.beneficiary}
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.beneficiary ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.beneficiary && <p className="text-red-500 text-xs mt-1">{errors.beneficiary}</p>}
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
                  className={`w-full p-1 border rounded ${errors.ifsc ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.ifsc && <p className="text-red-500 text-xs mt-1">{errors.ifsc}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Bank Name</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankDetails.bankName}
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.bankName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.bankName && <p className="text-red-500 text-xs mt-1">{errors.bankName}</p>}
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
                  className={`w-full p-1 border rounded ${errors.branch ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.branch && <p className="text-red-500 text-xs mt-1">{errors.branch}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Account Type</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="accountType"
                  value={formData.bankDetails.accountType}
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.accountType ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.accountType && <p className="text-red-500 text-xs mt-1">{errors.accountType}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Account Number</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.accountNumber ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.accountNumber && <p className="text-red-500 text-xs mt-1">{errors.accountNumber}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount Details */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Amount Claimed</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="amountClaimed"
                  value={formData.amountClaimed}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.amountClaimed ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.amountClaimed && <p className="text-red-500 text-xs mt-1">{errors.amountClaimed}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Final Amount Sanctioned</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="finalAmountSanctioned"
                  value={formData.finalAmountSanctioned}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.finalAmountSanctioned ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.finalAmountSanctioned && <p className="text-red-500 text-xs mt-1">{errors.finalAmountSanctioned}</p>}
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Date of Submission</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="dateOfSubmission"
                  value={formData.dateOfSubmission}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border rounded ${errors.dateOfSubmission ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.dateOfSubmission && <p className="text-red-500 text-xs mt-1">{errors.dateOfSubmission}</p>}
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Remarks by HOD</th>
              <td className="p-2 border border-gray-300">
                <textarea
                  name="remarksByHod"
                  value={formData.remarksByHod || ''} // Ensure value is a string, default to empty string
                  onChange={handleChange}
                  disabled={viewOnly}
                  rows="3"
                  className={`w-full p-2 border rounded ${errors.remarksByHod ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter remarks here..."
                ></textarea>
                {errors.remarksByHod && <p className="text-red-500 text-xs mt-1">{errors.remarksByHod}</p>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signatures and Documents */}
        {(!viewOnly || !isStudent) && ( // Show this section if not viewOnly OR if viewOnly but not a student
          <table className="w-full mb-6 border border-gray-300">
            <tbody>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">Student Signature</th>
                <td className="p-2 border border-gray-300">
                  {renderFileDisplay('studentSignature', 'Student Signature')}
                  {errors.studentSignature && <p className="text-red-500 text-xs mt-1">{errors.studentSignature}</p>}
                  {!viewOnly && files.studentSignature && (
                    <button type="button" onClick={() => handleRemoveFile('studentSignature')} className="text-red-600 hover:underline text-xs mt-1">Remove</button>
                  )}
                </td>
              </tr>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">Guide Signature</th>
                <td className="p-2 border border-gray-300">
                  {renderFileDisplay('guideSignature', 'Guide Signature')}
                  {errors.guideSignature && <p className="text-red-500 text-xs mt-1">{errors.guideSignature}</p>}
                  {!viewOnly && files.guideSignature && (
                    <button type="button" onClick={() => handleRemoveFile('guideSignature')} className="text-red-600 hover:underline text-xs mt-1">Remove</button>
                  )}
                </td>
              </tr>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">HOD Signature</th>
                <td className="p-2 border border-gray-300">
                  {renderFileDisplay('hodSignature', 'HOD Signature')}
                  {errors.hodSignature && <p className="text-red-500 text-xs mt-1">{errors.hodSignature}</p>}
                  {!viewOnly && files.hodSignature && (
                    <button type="button" onClick={() => handleRemoveFile('hodSignature')} className="text-red-600 hover:underline text-xs mt-1">Remove</button>
                  )}
                </td>
              </tr>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">Signature of chairperson of SDC with date:</th>
                <td colSpan="3" className="p-2 border border-gray-300">
                  <div className="flex items-center flex-wrap"> {/* Added flex-wrap for responsiveness */}
                    {/* Render file display for SDC Chairperson Signature */}
                    {renderFileDisplay('sdcChairpersonSignature', 'SDC Chairperson Signature')}
                    {errors.sdcChairpersonSignature && <p className="text-red-500 text-xs mt-1">{errors.sdcChairpersonSignature}</p>}
                    {/* Only show remove button if not in viewOnly mode and file exists */}
                    {!viewOnly && files.sdcChairpersonSignature && (
                      <button type="button" onClick={() => handleRemoveFile('sdcChairpersonSignature')} className="text-red-600 hover:underline text-xs ml-2 mt-1">Remove</button>
                    )}
                    {/* Date input for SDC Chairperson */}
                    <input
                      type="date"
                      name="sdcChairpersonDate"
                      value={formData.sdcChairpersonDate}
                      onChange={handleChange}
                      disabled={viewOnly}
                      className="ml-2 p-1 border border-gray-300 rounded max-w-[150px]" // Added max-width
                    />
                    {viewOnly && formData?.sdcChairpersonDate && (
                      <span className="ml-2 text-sm text-gray-600">({formData.sdcChairpersonDate})</span>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">Proof Document (PDF)</th>
                <td className="p-2 border border-gray-300">
                  {renderFileDisplay('proofDocument', 'Proof Document')}
                  {errors.proofDocument && <p className="text-red-500 text-xs mt-1">{errors.proofDocument}</p>}
                  {!viewOnly && files.proofDocument && (
                    <button type="button" onClick={() => handleRemoveFile('proofDocument')} className="text-red-600 hover:underline text-xs mt-1">Remove</button>
                  )}
                </td>
              </tr>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">Additional PDFs (Max 5)</th>
                <td className="p-2 border border-gray-300">
                  {renderFileDisplay('pdfs', 'Additional PDFs')}
                  {errors.pdfs && <p className="text-red-500 text-xs mt-1">{errors.pdfs}</p>}
                  {!viewOnly && files.pdfs.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {files.pdfs.map((pdf, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded">
                          <span>{pdf.name}</span>
                          <button type="button" onClick={() => handleRemoveFile('pdfs', index)} className="text-red-600 hover:underline text-xs ml-2">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
              <tr>
                <th className="p-2 border border-gray-300 bg-gray-100">ZIP File (Optional)</th>
                <td className="p-2 border border-gray-300">
                  {renderFileDisplay('zipFile', 'ZIP File')}
                  {errors.zipFile && <p className="text-red-500 text-xs mt-1">{errors.zipFile}</p>}
                  {!viewOnly && files.zipFile && (
                    <button type="button" onClick={() => handleRemoveFile('zipFile')} className="text-red-600 hover:underline text-xs mt-1">Remove</button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
          >
            Back
          </button>
          {!viewOnly && isStudent && ( // Only show submit button if not viewOnly AND is a student
            <button
              type="submit"
              disabled={isSubmitting}
              className={`submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 ${isSubmitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default R1;