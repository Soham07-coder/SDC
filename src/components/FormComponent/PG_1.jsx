import React, { useState, useEffect, useRef ,  useCallback } from 'react'; // Import useRef
import axios from "axios";

// No need for FILE_DOWNLOAD_BASE_URL here. The backend provides the full URL.

const PG_1 = ({ viewOnly = false, data = null }) => {
  const [messageBox, setMessageBox] = useState({ visible: false, text: '', type: '' });

  const showMessageBox = (text, type) => {
    setMessageBox({ visible: true, text, type });
    setTimeout(() => {
      setMessageBox({ visible: false, text: '', type: '' });
    }, 3000);
  };

  const originalReceiptCopyRef = useRef(null);
  const originalAdditionalDocumentsRef = useRef(null);
  const originalGuideSignatureRef = useRef(null);
  const originalPdfDocumentsRef = useRef([]);
  const originalZipFilesRef = useRef([]);

  const [formId, setFormId] = useState(null);

  const [formData, setFormData] = useState(() => {
    if (viewOnly && data) {
      return {
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        feesPaid: data.feesPaid || 'No',
        department: data.department || '',
        sttpTitle: data.sttpTitle || '',
        guideName: data.guideName || '',
        coGuideName: data.coGuideName || '',
        numberOfDays: data.numberOfDays || '',
        dateFrom: data.dateFrom ? data.dateFrom.split('T')[0] : '',
        dateTo: data.dateTo ? data.dateTo.split('T')[0] : '',
        organization: data.organization || '',
        reason: data.reason || '',
        knowledgeUtilization: data.knowledgeUtilization || '',
        bankDetails: {
          beneficiary: data.bankDetails?.beneficiary || '',
          ifsc: data.bankDetails?.ifsc || '',
          bankName: data.bankDetails?.bankName || '',
          branch: data.bankDetails?.branch || '',
          accountType: data.bankDetails?.accountType || '',
          accountNumber: data.bankDetails?.accountNumber || '',
        },
        registrationFee: data.registrationFee || '',
        previousClaim: data.previousClaim || 'No',
        claimDate: data.claimDate ? data.claimDate.split('T')[0] : '',
        amountReceived: data.amountReceived || '',
        amountSanctioned: data.amountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
      };
    }
    return {
      studentName: '', yearOfAdmission: '', feesPaid: 'No', department: '', sttpTitle: '',
      guideName: '', coGuideName: '', numberOfDays: '', dateFrom: '', dateTo: '',
      organization: '', reason: '', knowledgeUtilization: '',
      bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
      registrationFee: '', previousClaim: 'No', claimDate: '', amountReceived: '',
      amountSanctioned: '', status: 'pending', svvNetId: '',
    };
  });

  const [files, setFiles] = useState({
    receiptCopy: [],
    additionalDocuments: [],
    guideSignature: [],
    pdfDocuments: [],
    zipFiles: []
  });

  const [userRole, setUserRole] = useState('student');
  const isStudent = userRole === 'student';

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        setUserRole(user.role || 'student');
      } catch (e) {
        console.error("❌ Failed to parse user data from localStorage:", e);
        showMessageBox("User session corrupted. Please log in again.", "error");
        setUserRole('student');
      }
    } else {
      setUserRole('student');
    }
  }, []);

  useEffect(() => {
    if (data) {
      setFormId(data._id || null);
      setFormData(prev => ({
        ...prev,
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        feesPaid: data.feesPaid || 'No',
        department: data.department || '',
        sttpTitle: data.sttpTitle || '',
        guideName: data.guideName || '',
        coGuideName: data.coGuideName || '',
        numberOfDays: data.numberOfDays || '',
        dateFrom: data.dateFrom ? data.dateFrom.split('T')[0] : '',
        dateTo: data.dateTo ? data.dateTo.split('T')[0] : '',
        organization: data.organization || '',
        reason: data.reason || '',
        knowledgeUtilization: data.knowledgeUtilization || '',
        bankDetails: {
          beneficiary: data.bankDetails?.beneficiary || '',
          ifsc: data.bankDetails?.ifsc || '',
          bankName: data.bankDetails?.bankName || '',
          branch: data.bankDetails?.branch || '',
          accountType: data.bankDetails?.accountType || '',
          accountNumber: data.bankDetails?.accountNumber || '',
        },
        registrationFee: data.registrationFee || '',
        previousClaim: data.previousClaim || 'No',
        claimDate: data.claimDate ? data.claimDate.split('T')[0] : '',
        amountReceived: data.amountReceived || '',
        amountSanctioned: data.amountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
      }));

      const incomingFiles = data.files || {};

      setFiles({
        receiptCopy: incomingFiles.receiptCopy ? [incomingFiles.receiptCopy] : [],
        additionalDocuments: incomingFiles.additionalDocuments ? [incomingFiles.additionalDocuments] : [],
        guideSignature: incomingFiles.guideSignature ? [incomingFiles.guideSignature] : [],
        pdfDocuments: incomingFiles.pdfDocuments || [],
        zipFiles: incomingFiles.zipFiles || []
      });

      originalReceiptCopyRef.current = incomingFiles.receiptCopy || null;
      originalAdditionalDocumentsRef.current = incomingFiles.additionalDocuments || null;
      originalGuideSignatureRef.current = incomingFiles.guideSignature || null;
      originalPdfDocumentsRef.current = incomingFiles.pdfDocuments || [];
      originalZipFilesRef.current = incomingFiles.zipFiles || [];

    } else {
      const userString = localStorage.getItem("user");
      let storedSvvNetId = '';
      if (userString) {
        try {
          const user = JSON.parse(userString);
          storedSvvNetId = typeof user.svvNetId === "string" ? user.svvNetId : Array.isArray(user.svvNetId) ? user.svvNetId[0] : "";
        } catch (e) {
          console.error("Failed to parse user data from localStorage on reset:", e);
        }
      }

      setFormId(null);
      setFormData({
        studentName: '', yearOfAdmission: '', feesPaid: 'No', department: '', sttpTitle: '',
        guideName: '', coGuideName: '', numberOfDays: '', dateFrom: '', dateTo: '',
        organization: '', reason: '', knowledgeUtilization: '',
        bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
        registrationFee: '', previousClaim: 'No', claimDate: '', amountReceived: '',
        amountSanctioned: '', status: 'pending', svvNetId: storedSvvNetId,
      });
      setFiles({
        receiptCopy: [], additionalDocuments: [], guideSignature: [],
        pdfDocuments: [], zipFiles: []
      });
      originalReceiptCopyRef.current = null;
      originalAdditionalDocumentsRef.current = null;
      originalGuideSignatureRef.current = null;
      originalPdfDocumentsRef.current = [];
      originalZipFilesRef.current = [];
    }
  }, [data]);

  const handleChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRemoveFile = useCallback((field, index) => {
    setFiles((prev) => {
      const updated = Array.from(prev[field] || []);
      const fileToRemove = updated[index];
      if (fileToRemove && fileToRemove.url && fileToRemove.file instanceof File) {
        URL.revokeObjectURL(fileToRemove.url); // Revoke blob URL for new files
      }
      updated.splice(index, 1);
      return {
        ...prev,
        [field]: updated,
      };
    });
  }, []);

  const handleBankChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };

  const handleFileChange = (field, e) => {
    if (viewOnly) return;
    const file = e.target.files[0];
    if (!file) {
      setFiles(prev => ({ ...prev, [field]: [] }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessageBox("File size must be less than 5MB", "warning");
      e.target.value = null;
      setFiles(prev => ({ ...prev, [field]: [] }));
      return;
    }

    setFiles(prev => ({
      ...prev,
      [field]: [{ file: file, name: file.name, url: URL.createObjectURL(file), size: file.size }]
    }));
  };

  const handlePdfChange = (e) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > 5) {
      showMessageBox("Maximum 5 PDF files allowed.", "warning");
      e.target.value = null;
      return;
    }

    const newPdfFiles = [];
    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        showMessageBox(`"${file.name}" is not a PDF file.`, "warning");
        e.target.value = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showMessageBox(`"${file.name}" exceeds 5MB size limit.`, "warning");
        e.target.value = null;
        return;
      }
      newPdfFiles.push({ file: file, name: file.name, url: URL.createObjectURL(file), size: file.size });
    }

    setFiles(prev => ({
      ...prev,
      pdfDocuments: newPdfFiles
    }));
  };

  const handleZipChange = (e) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > 2) {
      showMessageBox("Maximum 2 ZIP files allowed.", "warning");
      e.target.value = null;
      return;
    }

    const newZipFiles = [];
    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        showMessageBox(`"${file.name}" is not a ZIP file.`, "warning");
        e.target.value = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showMessageBox(`"${file.name}" exceeds 5MB size limit.`, "warning");
        e.target.value = null;
        return;
      }
      newZipFiles.push({ file: file, name: file.name, url: URL.createObjectURL(file), size: file.size });
    }

    setFiles(prev => ({
      ...prev,
      zipFiles: newZipFiles
    }));
  };

  // The updated FilePreview component
  const FilePreview = useCallback(({ fileList, onRemove, fieldName }) => {
    // Do not render anything if viewOnly and student
    if (viewOnly && isStudent) {
      return null; // Completely hide the section
    }

    // Determine if we should show the remove button
    const showRemoveButton = !viewOnly;

    // Filter out files that shouldn't be displayed
    const filteredFiles = fileList.filter(fileInfo => {
      if (!fileInfo || (!fileInfo.url && !fileInfo.fileId && !fileInfo.id && !(fileInfo.file instanceof File))) {
        return false;
      }
      return true;
    });

    if (filteredFiles.length === 0) {
      return <p className="text-gray-500 text-sm italic mt-1">No file selected.</p>;
    }

    return (
      <ul className="mt-2 list-disc list-inside space-y-1">
        {filteredFiles.map((fileInfo, index) => {
          const isUploadedFile = !!(fileInfo.url || fileInfo.fileId || fileInfo.id);
          const displayUrl = fileInfo.url ||
                            (fileInfo.fileId ? `/api/pg1form/file/${fileInfo.fileId}` : null) ||
                            (fileInfo.id ? `/api/pg1form/file/${fileInfo.id}` : null);

          const fileName = fileInfo.name || (fileInfo.filename || (fileInfo.file ? fileInfo.file.name : 'Unnamed File'));
          const fileSizeMB = fileInfo.file ? (fileInfo.file.size / (1024 * 1024)).toFixed(2) : (fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'N/A');

          let linkText;
          if (viewOnly && isUploadedFile) {
            // Display custom view text based on fieldName
            switch (fieldName) {
              case 'receiptCopy':
                linkText = "View Receipt Copy";
                break;
              case 'additionalDocuments':
                linkText = "View Additional Document";
                break;
              case 'guideSignature':
                linkText = "View Guide Signature";
                break;
              case 'pdfDocuments':
                linkText = `View Supporting PDF ${index !== null ? index + 1 : ''}`;
                break;
              case 'zipFiles':
                linkText = "View Documents ZIP";
                break;
              default:
                linkText = "View File";
            }
          } else {
            // Show filename and size when NOT viewOnly or file not uploaded yet
            linkText = `${fileName} (${fileSizeMB} MB)`;
          }

          return (
            <li key={fileInfo._id || fileInfo.id || index} className="flex items-center justify-between text-sm text-gray-700 p-1 border rounded bg-gray-50 mb-1">
              {viewOnly && isUploadedFile ? (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex-grow"
                >
                  {linkText}
                </a>
              ) : (
                <span className="flex-grow">{linkText}</span>
              )}

              {showRemoveButton && (
                <button
                  type="button"
                  className="ml-4 text-red-600 hover:underline"
                  onClick={() => onRemove(fieldName, index)}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }, [viewOnly, isStudent, handleRemoveFile]);

  // Determine if the file uploads section should be visible for a student in viewOnly mode
  // This now checks against the 'files' state, which includes both new and existing files.
  // The 'data' prop is implicitly covered by how 'files' state is initialized in useEffect.
  const hasFilesToDisplay =
    files.receiptCopy.length > 0 ||
    files.additionalDocuments.length > 0 ||
    files.guideSignature.length > 0 ||
    files.pdfDocuments.length > 0 ||
    files.zipFiles.length > 0;

  const shouldShowFileUploadsForStudentInViewMode =
    viewOnly && isStudent && hasFilesToDisplay;

  // Determine if the file uploads section should be visible in general (non-student or not viewOnly)
  const shouldShowFileUploadsGenerally = !viewOnly || !isStudent;

  // Final condition to render the entire section
  if (!shouldShowFileUploadsGenerally && !shouldShowFileUploadsForStudentInViewMode) {
    return null; // Hide the entire section if no files to show for a student in viewOnly
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (viewOnly) return;

    let svvNetId = "";
    let department = "";

    const userString = localStorage.getItem("user");

    if (userString) {
      try {
        const user = JSON.parse(userString);
        svvNetId =
          typeof user.svvNetId === "string"
            ? user.svvNetId
            : Array.isArray(user.svvNetId)
            ? user.svvNetId[0]
            : "";

        department =
          typeof user.branch === "string"
            ? user.branch
            : Array.isArray(user.branch)
            ? user.branch[0]
            : "";
      } catch (e) {
        console.error("❌ Failed to parse user data from localStorage:", e);
        showMessageBox("User session corrupted. Please log in again.", "error");
        return;
      }
    }

    if (!svvNetId || !department) {
      showMessageBox("Authentication error: svvNetId or branch not found. Please log in.", "error");
      return;
    }

    try {
      const formPayload = new FormData();

      formPayload.append("svvNetId", svvNetId);
      formPayload.append("department", department);

      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "bankDetails" && key !== "department") {
          formPayload.append(key, value || "");
        }
      });

      formPayload.append("bankDetails", JSON.stringify(formData.bankDetails || {}));

      const handleSingleFileAppend = (fieldName, currentFiles, originalRef) => {
        if (currentFiles.length > 0 && currentFiles[0].file instanceof File) {
          formPayload.append(fieldName, currentFiles[0].file);
        } else if (originalRef.current && !currentFiles.length) {
          formPayload.append(`${fieldName}Removed`, 'true');
        } else if (originalRef.current && currentFiles.length > 0 && currentFiles[0]._id === originalRef.current._id) {
          formPayload.append(`${fieldName}Id`, originalRef.current._id);
        }
      };

      handleSingleFileAppend("receiptCopy", files.receiptCopy, originalReceiptCopyRef);
      handleSingleFileAppend("additionalDocuments", files.additionalDocuments, originalAdditionalDocumentsRef);
      handleSingleFileAppend("guideSignature", files.guideSignature, originalGuideSignatureRef);


      const handleMultipleFilesAppend = (fieldName, currentFiles, originalFilesRef) => {
        const newFilesToUpload = currentFiles.filter(f => f.file instanceof File);
        newFilesToUpload.forEach(fileObj => {
          formPayload.append(fieldName, fileObj.file);
        });

        const existingFileIdsToKeep = currentFiles
          .filter(f => f._id && !(f.file instanceof File))
          .map(f => f._id);

        const originalFileIds = originalFilesRef.current.map(f => f._id);

        const filesRemoved = originalFileIds.filter(id => !existingFileIdsToKeep.includes(id));

        if (existingFileIdsToKeep.length > 0) {
          formPayload.append(`${fieldName}KeepIds`, JSON.stringify(existingFileIdsToKeep));
        }
        if (filesRemoved.length > 0) {
          formPayload.append(`${fieldName}RemoveIds`, JSON.stringify(filesRemoved));
        }
      };

      handleMultipleFilesAppend("pdfDocuments", files.pdfDocuments, originalPdfDocumentsRef);
      handleMultipleFilesAppend("zipFiles", files.zipFiles, originalZipFilesRef);

      if (!viewOnly) {
          if (!files.receiptCopy.length && !originalReceiptCopyRef.current) {
            showMessageBox("Receipt Copy is required.", "warning");
            return;
          }
          if (!files.guideSignature.length && !originalGuideSignatureRef.current) {
            showMessageBox("Guide Signature is required.", "warning");
            return;
          }
      }

      const apiEndpoint = formId
        ? `http://localhost:5000/api/pg1form/update/${formId}`
        : "http://localhost:5000/api/pg1form/submit";

      const httpMethod = formId ? axios.put : axios.post;

      const response = await httpMethod(apiEndpoint, formPayload);

      showMessageBox(`Form ${formId ? 'updated' : 'submitted'} successfully!`, "success");
      console.log(`✅ Form ${formId ? 'updated' : 'submitted'}:`, response.data);

      if (!formId) {
        setFormData({
          studentName: '', yearOfAdmission: '', feesPaid: 'No', department: '', sttpTitle: '',
          guideName: '', coGuideName: '', numberOfDays: '', dateFrom: '', dateTo: '',
          organization: '', reason: '', knowledgeUtilization: '',
          bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
          registrationFee: '', previousClaim: 'No', claimDate: '', amountReceived: '',
          amountSanctioned: '', status: 'pending', svvNetId: svvNetId,
        });
        setFiles({
          receiptCopy: [], additionalDocuments: [], guideSignature: [],
          pdfDocuments: [], zipFiles: []
        });
      }
    } catch (error) {
      console.error("❌ Submit/Update error:", error.response?.data || error.message || error);
      showMessageBox(`Failed to ${formId ? 'update' : 'submit'} form. Please check required fields and try again.`, "error");
    }
  };
  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Post Graduate Form 1 - Workshop/STTP {viewOnly && "(View Only)"}
      </h1>

      {/* Custom Message Box */}
      {messageBox.visible && (
        <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg text-white
          ${messageBox.type === 'success' ? 'bg-green-500' :
            messageBox.type === 'error' ? 'bg-red-500' :
            'bg-yellow-500'}`}>
          {messageBox.text}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Whether Paid fees for Current Academic Year</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="feesPaid"
                  value={formData.feesPaid}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Title of the STTP/Workshop</th>
              <td colSpan="5" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="sttpTitle"
                  value={formData.sttpTitle}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Guide and Workshop Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name of the Guide / Co-guide</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="guideName"
                  value={formData.guideName}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Number of days of Workshop/STTP</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="number"
                  name="numberOfDays"
                  value={formData.numberOfDays}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">From Date</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="dateFrom"
                  value={formData.dateFrom}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">To Date</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="dateTo"
                  value={formData.dateTo}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Organization Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name and address of organization / institution conducting Workshop/STTP (For address one may give website address)</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Reason for attending the Workshop/STTP</th>
              <td className="p-2 border border-gray-300">
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded h-20 ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">How will you utilize the knowledge gained?</th>
              <td className="p-2 border border-gray-300">
                <textarea
                  name="knowledgeUtilization"
                  value={formData.knowledgeUtilization}
                  onChange={handleChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded h-20 ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm italic mb-6 text-gray-600">Attach a copy of authentic Receipt mentioning the Registration fees along with the Reimbursement Form</p>

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
                  onChange={handleBankChange}
                  disabled={viewOnly}
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                  className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                onChange={handleChange}
                disabled={viewOnly}
                className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="Rs.___________"
              />
            </td>
            <th className="p-2 border border-gray-300 bg-gray-100">Have you claimed previously for any paper / project competition under this scheme:</th>
            <td className="p-2 border border-gray-300">
              <select
                name="previousClaim"
                value={formData.previousClaim}
                onChange={handleChange}
                disabled={viewOnly}
                className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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
                onChange={handleChange}
                disabled={viewOnly}
                className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
            </td>
            <th className="p-2 border border-gray-300 bg-gray-100">Amount Received</th>
            <td className="p-2 border border-gray-300">
              <input
                type="text"
                name="amountReceived"
                value={formData.amountReceived}
                onChange={handleChange}
                disabled={viewOnly}
                className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="Rs.___________"
              />
            </td>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">Amount Sanctioned</th>
            <td colSpan="7" className="p-2 border border-gray-300">
              <input
                type="text"
                name="amountSanctioned"
                value={formData.amountSanctioned}
                onChange={handleChange}
                disabled={viewOnly}
                className={`w-full p-1 border border-gray-300 rounded ${viewOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="Rs.___________"
              />
            </td>
          </tr>
        </tbody>
      </table>
     <hr className="my-6 border-gray-300" />
      {/* --- File Upload Section --- */}
      <div className="mb-6 border p-4 rounded shadow-sm">
          <h3 className="text-lg font-semibold mb-3">File Uploads</h3>

          {/* Receipt Copy */}
          <div className="mb-4">
            <label htmlFor="receiptCopy" className="block text-sm font-medium text-gray-700">Receipt Copy (Max 5MB)</label>
            {!viewOnly && (
              <input
                type="file"
                id="receiptCopy"
                name="receiptCopy"
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange("receiptCopy", e)}
                className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
            )}
            {/* Using the unified FilePreview component */}
            <FilePreview fileList={files.receiptCopy} onRemove={handleRemoveFile} fieldName="receiptCopy" />
          </div>

          {/* Additional Documents */}
          <div className="mb-4">
            <label htmlFor="additionalDocuments" className="block text-sm font-medium text-gray-700">Additional Documents (Max 5MB)</label>
            {!viewOnly && (
              <input
                type="file"
                id="additionalDocuments"
                name="additionalDocuments"
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange("additionalDocuments", e)}
                className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
            )}
            <FilePreview fileList={files.additionalDocuments} onRemove={handleRemoveFile} fieldName="additionalDocuments" />
          </div>

          {/* Guide Signature */}
          <div className="mb-4">
            <label htmlFor="guideSignature" className="block text-sm font-medium text-gray-700">Guide Signature (Max 5MB)</label>
            {!viewOnly && (
              <input
                type="file"
                id="guideSignature"
                name="guideSignature"
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange("guideSignature", e)}
                className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
            )}
            <FilePreview fileList={files.guideSignature} onRemove={handleRemoveFile} fieldName="guideSignature" />
          </div>

          {/* PDF Documents */}
          <div className="mb-4">
            <label htmlFor="pdfDocuments" className="block text-sm font-medium text-gray-700">Supporting PDF Documents (Max 5 files, 5MB each, PDF only)</label>
            {!viewOnly && (
              <input
                type="file"
                id="pdfDocuments"
                name="pdfDocuments"
                accept="application/pdf"
                multiple
                onChange={handlePdfChange}
                className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
            )}
            <FilePreview fileList={files.pdfDocuments} onRemove={handleRemoveFile} fieldName="pdfDocuments" />
          </div>

          {/* ZIP Files */}
          <div className="mb-4">
            <label htmlFor="zipFiles" className="block text-sm font-medium text-gray-700">Additional Documents ZIP (Max 2 files, 5MB each, ZIP only)</label>
            {!viewOnly && (
              <input
                type="file"
                id="zipFiles"
                name="zipFiles"
                accept=".zip,application/zip,application/x-zip-compressed"
                multiple
                onChange={handleZipChange}
                className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
              />
            )}
            <FilePreview fileList={files.zipFiles} onRemove={handleRemoveFile} fieldName="zipFiles" />
          </div>
      </div>
      {/* --- End File Upload Section --- */}
      {/* Form Actions */}
      <div className="flex justify-between">
        {!viewOnly && (
          <>
            <button onClick={handleSubmit} className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
              {formId ? "Update Form" : "Submit Form"}
            </button>
            <button onClick={() => window.history.back()} className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600">
              Back
            </button>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default PG_1;
