import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PG_2_A = ({ viewOnly = false, data = null }) => {
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  const isNewForm = !data;

  // State for form data
  const [formData, setFormData] = useState(() => {
    if (data) {
      return {
        organizingInstitute: data.organizingInstitute || '',
        projectTitle: data.projectTitle || '',
        teamName: data.teamName || '',
        guideName: data.guideName || '',
        date: data.date || '',
        hodRemarks: data.hodRemarks || '',
        studentDetails: data.studentDetails?.length
          ? data.studentDetails.map(student => ({
              name: student.name || '',
              class: student.class || '',
              division: student.division || '',
              branch: student.branch || '',
              rollNo: student.rollNo || '',
              mobileNo: student.mobileNo || '',
            }))
          : [{ name: '', class: '', division: '', branch: '', rollNo: '', mobileNo: '' }],
        expenses: data.expenses?.length
          ? data.expenses.map(expense => ({
              description: expense.description || '',
              amount: expense.amount || '',
            }))
          : [{ description: '', amount: '' }],
        bankDetails: {
          beneficiary: data.bankDetails?.beneficiary || '',
          ifsc: data.bankDetails?.ifsc || '',
          bankName: data.bankDetails?.bankName || '',
          branch: data.bankDetails?.branch || '',
          accountType: data.bankDetails?.accountType || '',
          accountNumber: data.bankDetails?.accountNumber || '',
        },
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
        amountClaimed: data.amountClaimed || '',
        amountRecommended: data.amountRecommended || '',
        comments: data.comments || '',
        finalAmount: data.finalAmount || '',
        formId: data.formId || null,
      };
    }
    return {
      organizingInstitute: '', projectTitle: '', teamName: '', guideName: '', date: '',
      hodRemarks: '', studentDetails: [{ name: '', class: '', division: '', branch: '', rollNo: '', mobileNo: '' }],
      expenses: [{ description: '', amount: '' }],
      bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
      status: 'pending', svvNetId: '', amountClaimed: '', amountRecommended: '', comments: '', finalAmount: '', formId: null,
    };
  });

  // State for files, now explicitly handling existing file URLs/paths and new File objects
  const [files, setFiles] = useState(() => {
    if (data) {
      return {
        bills: Array.isArray(data.bills) ? data.bills : [],
        zips: Array.isArray(data.zipFile) ? data.zipFile : (data.zipFile ? [data.zipFile] : []),
        studentSignature: data.studentSignature ? data.studentSignature : null,
        guideSignature: data.guideSignature ? data.guideSignature : null,
      };
    }
    return {
      bills: [],
      zips: [],
      studentSignature: null,
      guideSignature: null,
    };
  });

  const [userMessage, setUserMessage] = useState(null);

  // Effect to fetch user role from localStorage on component mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user && user.role) {
          setCurrentUserRole(user.role.toLowerCase().trim()); 
        } else {
          setCurrentUserRole('student'); // Default if role is missing
        }
      } else {
        setCurrentUserRole('student'); // Default if no user data
      }
    } catch (error) {
      console.error("Failed to parse user data from localStorage:", error);
      setCurrentUserRole('student'); // Fallback on error
    } finally {
      setIsLoadingRole(false);
    }
  }, []);

  // Effect to calculate total amount claimed when expenses change
  useEffect(() => {
    const totalClaimed = formData.expenses
      .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0)
      .toFixed(2);
    setFormData(prev => ({ ...prev, amountClaimed: totalClaimed }));
  }, [formData.expenses]);

  // Helper function to determine if a field is editable based on role and viewOnly prop
  const canEditField = (fieldName) => {
    if (viewOnly || isLoadingRole || !currentUserRole) return false;

    const editableByStatus = isNewForm || formData.status === 'pending' || formData.status === 'draft';

    if (currentUserRole === 'student') {
      const studentEditableFields = [
        'organizingInstitute', 'projectTitle', 'teamName', 'guideName','date',
        'studentDetails', 'expenses', 'bankDetails', 'svvNetId',
        'studentSignature', 'bills', 'zips','guideSignature',
      ];
      return editableByStatus && studentEditableFields.includes(fieldName);
    }

    if (currentUserRole === 'guide') {
      const guideEditableFields = ['hodRemarks'];
      return editableByStatus && guideEditableFields.includes(fieldName);
    }

    if (currentUserRole === 'hod') {
      const hodEditableFields = ['hodRemarks', 'status', 'amountRecommended', 'comments', 'finalAmount'];
      return editableByStatus && hodEditableFields.includes(fieldName);
    }

    if (currentUserRole === 'admin') {
      return true; // Admin can always edit
    }

    return false;
  };

  // Generic handler for text inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (canEditField(name)) {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleStudentChange = (index, field, value) => {
    if (!canEditField('studentDetails')) return;
    const newStudents = [...formData.studentDetails];
    newStudents[index][field] = value;
    setFormData(prev => ({ ...prev, studentDetails: newStudents }));
  };

  const handleExpenseChange = (index, field, value) => {
    if (!canEditField('expenses')) return;
    if (field === 'amount') {
      const num = Number(value);
      if (value !== '' && (isNaN(num) || num < 0)) return;
      value = num;
    }
    const newExpenses = [...formData.expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setFormData(prev => ({ ...prev, expenses: newExpenses }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    if (!canEditField('bankDetails')) return;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };

  // Remove file handler: handles both File objects and string paths
  const removeFile = (fileType, index = null) => {
    if (!canEditField(fileType)) return;

    setFiles((prevFiles) => {
      if (fileType === 'bills' || fileType === 'zips') {
        const updatedFiles = [...prevFiles[fileType]];
        updatedFiles.splice(index, 1);
        return { ...prevFiles, [fileType]: updatedFiles };
      } else if (fileType === 'studentSignature' || fileType === 'guideSignature') {
        return { ...prevFiles, [fileType]: null };
      }
      return prevFiles; // Should not happen
    });
  };

  // Handle file inputs: now distinguishes between new File objects and existing string paths
  const handleFileChange = (field, event) => {
    if (!canEditField(field)) return;
    const selectedFiles = Array.from(event.target.files);

    setFiles((prevFiles) => {
      if (field === 'bills' || field === 'zips') {
        // Keep existing files (those with 'url' or 'id')
        const existingFiles = prevFiles[field].filter(f => f.url || f.id);
        // Map new File objects to the new structure
        const newFileObjects = selectedFiles.map(file => ({ file, name: file.name, size: file.size }));
        const combinedFiles = [...existingFiles, ...newFileObjects];

        if (field === 'bills' && combinedFiles.length > 5) {
          setUserMessage({ text: 'You can upload a maximum of 5 PDF files for bills.', type: 'error' });
          return prevFiles;
        }
        if (field === 'zips' && combinedFiles.length > 2) {
          setUserMessage({ text: 'You can upload a maximum of 2 ZIP files.', type: 'error' });
          return prevFiles;
        }
        return { ...prevFiles, [field]: combinedFiles };
      } else { // For single signature files
        const newSignatureFile = selectedFiles[0] ? { file: selectedFiles[0], name: selectedFiles[0].name, size: selectedFiles[0].size } : null;
        return { ...prevFiles, [field]: newSignatureFile };
      }
    });
    setUserMessage(null);
  };

  const addStudent = () => {
    if (!canEditField('studentDetails')) return;
    setFormData(prev => ({
      ...prev,
      studentDetails: [...prev.studentDetails, { name: '', class: '', division: '', branch: '', rollNo: '', mobileNo: '' }]
    }));
  };

  const removeStudent = (index) => {
    if (!canEditField('studentDetails')) return;
    const updatedStudents = [...formData.studentDetails];
    updatedStudents.splice(index, 1);
    setFormData({ ...formData, studentDetails: updatedStudents });
  };

  const addExpense = () => {
    if (!canEditField('expenses')) return;
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { description: '', amount: '' }],
    }));
  };

  const removeExpense = (index) => {
    if (!canEditField('expenses')) return;
    const updatedExpenses = [...formData.expenses];
    updatedExpenses.splice(index, 1);
    setFormData({ ...formData, expenses: updatedExpenses });
  };

  // Form validation logic
  const validateForm = () => {
    // Only validate fields relevant to the student for initial submission
    if (currentUserRole === 'student' && isNewForm) {
      const requiredFields = [
        "projectTitle", "teamName", "guideName", "organizingInstitute"
      ];
      for (const field of requiredFields) {
        if (!formData[field] || formData[field].toString().trim() === "") {
          setUserMessage({ text: `Please fill the field: ${field}`, type: 'error' });
          return false;
        }
      }

      if (!formData.studentDetails || formData.studentDetails.length === 0) {
        setUserMessage({ text: "Please add at least one student detail.", type: 'error' });
        return false;
      }
      for (let i = 0; i < formData.studentDetails.length; i++) {
        const student = formData.studentDetails[i];
        if (!student.name || student.name.trim() === "" || !student.class || student.class.trim() === "" ||
            !student.division || student.division.trim() === "" || !student.branch || student.branch.trim() === "" ||
            !student.rollNo || student.rollNo.trim() === "" || !student.mobileNo || !/^\d{10}$/.test(student.mobileNo.trim())) {
          setUserMessage({ text: `Student ${i + 1}: All fields (Name, Class, Div, Branch, Roll No., Mobile No.) are required and Mobile No. must be 10 digits.`, type: 'error' });
          return false;
        }
      }

      if (!formData.expenses || formData.expenses.length === 0) {
        setUserMessage({ text: "Please add at least one expense detail.", type: 'error' });
        return false;
      }
      for (let i = 0; i < formData.expenses.length; i++) {
        const expense = formData.expenses[i];
        if (!expense.description || expense.description.trim() === "" ||
            expense.amount === undefined || expense.amount === null || expense.amount === "" ||
            isNaN(expense.amount) || Number(expense.amount) <= 0) {
          setUserMessage({ text: `Expense ${i + 1}: Description and positive Amount are required.`, type: 'error' });
          return false;
        }
      }

      const bank = formData.bankDetails || {};
      if (!bank.beneficiary || bank.beneficiary.trim() === "" || !bank.ifsc || !/^[A-Za-z]{4}\d{7}$/.test(bank.ifsc.trim()) ||
          !bank.bankName || bank.bankName.trim() === "" || !bank.branch || bank.branch.trim() === "" ||
          !bank.accountType || bank.accountType.trim() === "" || !bank.accountNumber || !/^\d{9,18}$/.test(bank.accountNumber.trim())) {
        setUserMessage({ text: "All bank details (Beneficiary, IFSC, Bank Name, Branch, Account Type, Account Number) are required and must be valid.", type: 'error' });
        return false;
      }

      if (!files.bills || files.bills.length === 0) {
        setUserMessage({ text: "Please upload at least one Bill PDF file.", type: 'error' });
        return false;
      }
      if (files.bills.length > 5) {
        setUserMessage({ text: "You can upload maximum 5 Bill PDF files.", type: 'error' });
        return false;
      }
      for (let file of files.bills) {
        // Only validate type for new File objects, assume existing URLs are valid
        if (file.file instanceof File && file.file.type !== "application/pdf") {
          setUserMessage({ text: `Bill file ${file.name} must be a PDF.`, type: 'error' });
          return false;
        }
      }

      if (files.zips && files.zips.length > 2) {
        setUserMessage({ text: "You can upload maximum 2 ZIP files.", type: 'error' });
        return false;
      }
      for (let file of files.zips || []) {
        if (file.file instanceof File && !file.file.name.toLowerCase().endsWith(".zip")) {
          setUserMessage({ text: `ZIP file ${file.name} must have .zip extension.`, type: 'error' });
          return false;
        }
      }

      if (!files.studentSignature || (files.studentSignature.file instanceof File && !files.studentSignature.file.type.startsWith("image/"))) {
        setUserMessage({ text: "Please upload Student Signature image.", type: 'error' });
        return false;
      }

      if (!files.guideSignature || (files.guideSignature.file instanceof File && !files.guideSignature.file.type.startsWith("image/"))) {
        setUserMessage({ text: "Please upload Guide Signature image.", type: 'error' });
        return false;
      }
    }
    if (currentUserRole === 'hod') {
      if (formData.status === 'rejected' && (!formData.hodRemarks || formData.hodRemarks.trim() === '')) {
        setUserMessage({ text: 'HOD Remarks are required if the status is rejected.', type: 'error' });
        return false;
      }
    }

    setUserMessage(null);
    return true;
  };

  // Handle form submission/update
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoadingRole) {
      setUserMessage({ text: 'User role is still loading. Please wait.', type: 'error' });
      return;
    }

    // Check if the user has permission to submit/update any part of the form
    // This is a general check, more specific checks are in canEditField
    const canPerformAction = canEditField('organizingInstitute') || canEditField('hodRemarks') ||
                             canEditField('studentSignature') || canEditField('guideSignature');

    if (!canPerformAction) {
      setUserMessage({ text: 'You do not have permission to submit/update this form.', type: 'error' });
      return;
    }

    if (!validateForm()) return;

    let svvNetId = null;
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        svvNetId = user.svvNetId;
      } catch (e) {
        console.error("Failed to parse user data from localStorage for submission:", e);
        setUserMessage({ text: "User session corrupted. Please log in again.", type: "error" });
        return;
      }
    }

    if (!svvNetId && isNewForm) {
      setUserMessage({ text: "Authentication error: User ID (svvNetId) not found. Please log in.", type: "error" });
      return;
    }

    try {
      const formPayload = new FormData();
      if (svvNetId) {
        formPayload.append('svvNetId', svvNetId);
      }

      // Append all form data fields
      Object.keys(formData).forEach(key => {
        if (typeof formData[key] === 'object' && formData[key] !== null && !Array.isArray(formData[key])) {
          formPayload.append(key, JSON.stringify(formData[key]));
        } else if (Array.isArray(formData[key])) {
          formPayload.append(key, JSON.stringify(formData[key]));
        } else {
          formPayload.append(key, formData[key] || '');
        }
      });

      // Append files: differentiate between new File objects and existing URLs
      (files.bills || []).forEach(fileInfo => {
        if (fileInfo.file instanceof File) { // Only append new File objects
          formPayload.append("bills", fileInfo.file);
        } else if (fileInfo.url || fileInfo.id) { // Append existing file URLs/IDs
          formPayload.append("existingBills", fileInfo.url || fileInfo.id);
        }
      });
      (files.zips || []).forEach(fileInfo => {
        if (fileInfo.file instanceof File) {
          formPayload.append("zips", fileInfo.file);
        } else if (fileInfo.url || fileInfo.id) {
          formPayload.append("existingZips", fileInfo.url || fileInfo.id);
        }
      });

      if (files.studentSignature) {
        if (files.studentSignature.file instanceof File) {
          formPayload.append("studentSignature", files.studentSignature.file);
        } else if (files.studentSignature.url || files.studentSignature.id) {
          formPayload.append("existingStudentSignature", files.studentSignature.url || files.studentSignature.id);
        }
      }

      if (files.guideSignature) {
        if (files.guideSignature.file instanceof File) {
          formPayload.append("guideSignature", files.guideSignature.file);
        } else if (files.guideSignature.url || files.guideSignature.id) {
          formPayload.append("existingGuideSignature", files.guideSignature.url || files.guideSignature.id);
        }
      }

      const apiUrl = isNewForm
        ? "http://localhost:5000/api/pg2aform/submit"
        : `http://localhost:5000/api/pg2aform/update/${formData.formId}`;
      const httpMethod = isNewForm ? 'POST' : 'PUT';
      const response = await axios({
        method: httpMethod,
        url: apiUrl,
        data: formPayload,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUserMessage({ text: `PG2A Form ${isNewForm ? 'submitted' : 'updated'} successfully!`, type: 'success' });
      if (isNewForm) {
        setFormData({ // Reset form for new entry
          organizingInstitute: '', projectTitle: '', teamName: '', guideName: '', date: '',
          hodRemarks: '', studentDetails: [{ name: '', class: '', division: '', branch: '', rollNo: '', mobileNo: '' }],
          expenses: [{ description: '', amount: '' }], bankDetails: { beneficiary: '', ifsc: '', bankName: '', branch: '', accountType: '', accountNumber: '' },
          status: 'pending', svvNetId: '', amountClaimed: '', amountRecommended: '', comments: '', finalAmount: '', formId: null,
        });
        setFiles({ bills: [], zips: [], studentSignature: null, guideSignature: null });
      } else {
        // If updated, refresh files state to reflect new/retained files from backend response if necessary
        // Assuming the backend returns updated file paths/URLs in a 'files' object
        if (response.data.files) {
            setFiles({
                bills: response.data.files.bills?.map(url => ({ url, name: url.split('/').pop(), id: url })) || [],
                zips: response.data.files.zips?.map(url => ({ url, name: url.split('/').pop(), id: url })) || [],
                studentSignature: response.data.files.studentSignature ? { url: response.data.files.studentSignature, name: response.data.files.studentSignature.split('/').pop(), id: response.data.files.studentSignature } : null,
                guideSignature: response.data.files.guideSignature ? { url: response.data.files.guideSignature, name: response.data.files.guideSignature.split('/').pop(), id: response.data.files.guideSignature } : null,
            });
        }
      }

    } catch (error) {
      if (error.response) {
        console.error("Backend error response data:", error.response.data);
        setUserMessage({
          text: `Failed to ${isNewForm ? 'submit' : 'update'} PG2A form: ${error.response.data.message || JSON.stringify(error.response.data)}`,
          type: 'error'
        });
      } else {
        console.error(`Error ${isNewForm ? 'submitting' : 'updating'} PG2A form:`, error);
        setUserMessage({
          text: `Failed to ${isNewForm ? 'submit' : 'update'} PG2A form. Please check your data and try again.`,
          type: 'error'
        });
      }
    }
  };

  // Define FilePreview component inside PG_2_A to access its state/props
  const isStudent = currentUserRole === 'student'; // Derived state for FilePreview

  const FilePreview = useCallback(({ fileList, onRemove, fieldName }) => {
    const isSupportingDocument = fieldName === 'bills' || fieldName === 'zips';
    if (isSupportingDocument && viewOnly && isStudent) return null;

    const showRemoveButton = canEditField(fieldName);

    const filteredFiles = fileList.filter(fileInfo =>
      fileInfo && (fileInfo.file instanceof File || fileInfo.url || fileInfo.fileId || fileInfo.id)
    );

    if (filteredFiles.length === 0) {
      return <p className="text-gray-500 text-sm italic mt-1">No file selected.</p>;
    }

    return (
      <ul className="mt-2 list-disc list-inside space-y-1">
        {filteredFiles.map((fileInfo, index) => {
          const isUploadedFile = !!(fileInfo.url || fileInfo.fileId || fileInfo.id);

          // Construct the file URL
          let displayUrl = fileInfo.url;
          if (!displayUrl && (fileInfo.id || fileInfo.fileId)) {
            const id = fileInfo.id || fileInfo.fileId;
            displayUrl = `/api/pg2aform/uploads/files/${id}?bucket=pg2afiles`;
          }
          // Determine filename and size
          const fileName =
            fileInfo.originalName ||
            fileInfo.name ||
            fileInfo.filename ||
            (fileInfo.file?.name || 'Unnamed File');

          const fileSizeMB = fileInfo.file
            ? (fileInfo.file.size / (1024 * 1024)).toFixed(2)
            : fileInfo.size
            ? (fileInfo.size / (1024 * 1024)).toFixed(2)
            : 'N/A';

          // Determine link text
          let linkText;
          if (viewOnly && isUploadedFile) {
            switch (fieldName) {
              case 'bills':
                linkText = `View Bill ${index + 1}`;
                break;
              case 'zips':
                linkText = 'View Documents ZIP';
                break;
              case 'guideSignature':
                linkText = 'View Guide Signature';
                break;
              case 'studentSignature':
                linkText = 'View Student Signature';
                break;
              default:
                linkText = 'View File';
            }
          } else {
            linkText = `${fileName} (${fileSizeMB} MB)`;
          }

          return (
            <li
              key={fileInfo._id || fileInfo.id || index}
              className="flex items-center justify-between text-sm text-gray-700 p-1 border rounded bg-gray-50 mb-1"
            >
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
  }, [viewOnly, isStudent, removeFile, canEditField]);


  if (isLoadingRole) {
    return (
      <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md font-inter text-center py-20">
        <p className="text-xl text-gray-700">Loading user role...</p>
      </div>
    );
  }

  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md font-inter">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Post Graduate Form 2A - Project Competition</h1>

      {userMessage && (
        <div className={`mb-4 p-3 rounded text-center ${userMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {userMessage.text}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Application Form</h2>

        {/* Organizing Institute */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Name and brief address of the organising institute</label>
          <input
            type="text"
            name="organizingInstitute"
            value={formData.organizingInstitute}
            onChange={handleChange}
            disabled={!canEditField('organizingInstitute')}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Project Title */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Title of Project:</label>
          <input
            type="text"
            name="projectTitle"
            value={formData.projectTitle}
            onChange={handleChange}
            disabled={!canEditField('projectTitle')}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Team Name */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Team Name:</label>
          <input
            type="text"
            name="teamName"
            value={formData.teamName}
            onChange={handleChange}
            disabled={!canEditField('teamName')}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Guide Name */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Guide Name:</label>
          <input
            type="text"
            name="guideName"
            value={formData.guideName}
            onChange={handleChange}
            disabled={!canEditField('guideName')}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Date:</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            disabled={!canEditField('date')}
            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Student Details Table */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Student Details</h3>
          <table className="w-full mb-4 border border-gray-300 rounded-md overflow-hidden">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border border-gray-300">Name of the student</th>
                <th className="p-2 border border-gray-300">Class</th>
                <th className="p-2 border border-gray-300">Div</th>
                <th className="p-2 border border-gray-300">Branch</th>
                <th className="p-2 border border-gray-300">Roll No.</th>
                <th className="p-2 border border-gray-300">Mobile No.</th>
                {canEditField('studentDetails') && (
                  <th className="p-2 border border-gray-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {formData.studentDetails.map((student, index) => (
                <tr key={index}>
                  {['name', 'class', 'division', 'branch', 'rollNo', 'mobileNo'].map((field) => (
                    <td className="p-2 border border-gray-300" key={field}>
                      <input
                        type="text"
                        value={student[field]}
                        onChange={(e) => handleStudentChange(index, field, e.target.value)}
                        disabled={!canEditField('studentDetails')}
                        className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                  ))}
                  {canEditField('studentDetails') && (
                    <td className="p-2 border border-gray-300 text-center">
                      <button
                        onClick={() => removeStudent(index)}
                        className="text-red-500 hover:text-red-700 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={formData.studentDetails.length <= 1}
                      >
                        ❌
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {canEditField('studentDetails') && (
            <button onClick={addStudent} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 shadow-md transition-all duration-200 ease-in-out">
              Add Student
            </button>
          )}
        </div>

        {/* Expenses */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Details of expenses (attach bills in order):</h3>
          <table className="w-full mb-4 border border-gray-300 rounded-md overflow-hidden">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border border-gray-300">Sr. No.</th>
                <th className="p-2 border border-gray-300">Description</th>
                <th className="p-2 border border-gray-300">Amount (Rs.)</th>
                {canEditField('expenses') && (
                  <th className="p-2 border border-gray-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {formData.expenses.map((expense, index) => (
                <tr key={index}>
                  <td className="p-2 border border-gray-300">{index + 1}</td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={expense.description}
                      onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                      disabled={!canEditField('expenses')}
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="number"
                      value={expense.amount}
                      onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                      disabled={!canEditField('expenses')}
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  {canEditField('expenses') && (
                    <td className="p-2 border border-gray-300 text-center">
                      <button
                        onClick={() => removeExpense(index)}
                        className="text-red-500 hover:text-red-700 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={formData.expenses.length <= 1}
                      >
                        ❌
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr>
                <td className="p-2 border border-gray-300 font-semibold">Total Claimed</td>
                <td className="p-2 border border-gray-300"></td>
                <td className="p-2 border border-gray-300 font-bold">
                  {formData.amountClaimed}
                </td>
                {canEditField('expenses') && <td className="p-2 border border-gray-300"></td>}
              </tr>
            </tbody>
          </table>
          {canEditField('expenses') && (
            <button onClick={addExpense} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 shadow-md transition-all duration-200 ease-in-out">
              Add Expense
            </button>
          )}
        </div>

        {/* Bank Details */}
        <table className="w-full mb-6 border border-gray-300 rounded-md overflow-hidden">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100" colSpan="2">Bank details for RTGS/NEFT</th>
            </tr>
            {[
              { label: 'Beneficiary name, address, mobile', name: 'beneficiary' },
              { label: 'IFSC Code', name: 'ifsc' },
              { label: 'Name of the bank', name: 'bankName' },
              { label: 'Branch', name: 'branch' },
              { label: 'Account type', name: 'accountType' },
              { label: 'Account number', name: 'accountNumber' }
            ].map((field) => (
              <tr key={field.name}>
                <th className="p-2 border border-gray-300 bg-gray-100">{field.label}</th>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    name={field.name}
                    value={formData.bankDetails[field.name]}
                    onChange={handleBankChange}
                    disabled={!canEditField('bankDetails')}
                    className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* File Uploads */}
        <div className="mb-6 space-y-4">
          {/* PDF Bills (max 5) */}
          <div>
            <label className="block font-semibold mb-2">Attach bills (in order of serial no.) – Max 5 PDF files:</label>
            {canEditField('bills') && ( // Only show upload button if editable
              <div className="flex items-center mb-2">
                <label
                  className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer shadow-md transition-all duration-200 ease-in-out hover:bg-blue-600`}
                >
                  Choose PDFs
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    multiple
                    onChange={(e) => handleFileChange('bills', e)}
                  />
                </label>
                <span className="ml-2 text-sm text-gray-700">
                  {files.bills.filter(f => f.file instanceof File).length > 0 ? `${files.bills.filter(f => f.file instanceof File).length} new file(s) chosen` : 'No new files chosen'}
                </span>
              </div>
            )}
            {/* Render FilePreview for bills */}
            <FilePreview
              fileList={files.bills}
              onRemove={removeFile}
              fieldName="bills"
              viewOnly={viewOnly}
              currentUserRole={currentUserRole}
            />
          </div>

          {/* ZIP Files (max 2) */}
          <div>
            <label className="block font-semibold mb-2">Attach additional ZIP files – Max 2:</label>
            {canEditField('zips') && ( // Only show upload button if editable
              <div className="flex items-center mb-2">
                <label
                  className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer shadow-md transition-all duration-200 ease-in-out hover:bg-blue-600`}
                >
                  Choose ZIPs
                  <input
                    type="file"
                    className="hidden"
                    accept=".zip"
                    multiple
                    onChange={(e) => handleFileChange('zips', e)}
                  />
                </label>
                <span className="ml-2 text-sm text-gray-700">
                  {files.zips.filter(f => f.file instanceof File).length > 0 ? `${files.zips.filter(f => f.file instanceof File).length} new file(s) chosen` : 'No new files chosen'}
                </span>
              </div>
            )}
            {/* Render FilePreview for zips */}
            <FilePreview
              fileList={files.zips}
              onRemove={removeFile}
              fieldName="zips"
              viewOnly={viewOnly}
              currentUserRole={currentUserRole}
            />
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student Signature */}
            <div>
              <label className="block font-semibold mb-2">Signature of Student</label>
              <div className="flex items-center">
                {canEditField('studentSignature') && ( // Only show upload button if editable
                  <label
                    className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer shadow-md transition-all duration-200 ease-in-out hover:bg-blue-600`}
                  >
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange('studentSignature', e)}
                    />
                  </label>
                )}
                {/* Render FilePreview for studentSignature */}
                {files.studentSignature && (
                  <FilePreview
                    fileList={[files.studentSignature]} // Pass as an array for consistency
                    onRemove={removeFile}
                    fieldName="studentSignature"
                    viewOnly={viewOnly}
                    currentUserRole={currentUserRole}
                  />
                )}
                {!files.studentSignature && !canEditField('studentSignature') && (
                  <span className="ml-2 text-sm text-gray-700">No file chosen</span>
                )}
              </div>
            </div>

            {/* Guide Signature */}
            <div>
              <label className="block font-semibold mb-2">Signature of Guide</label>
              <div className="flex items-center">
                {canEditField('guideSignature') && ( // Only show upload button if editable
                  <label
                    className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer shadow-md transition-all duration-200 ease-in-out hover:bg-blue-600`}
                  >
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange('guideSignature', e)}
                    />
                  </label>
                )}
                {/* Render FilePreview for guideSignature */}
                {files.guideSignature && (
                  <FilePreview
                    fileList={[files.guideSignature]} // Pass as an array for consistency
                    onRemove={removeFile}
                    fieldName="guideSignature"
                    viewOnly={viewOnly}
                    currentUserRole={currentUserRole}
                  />
                )}
                {!files.guideSignature && !canEditField('guideSignature') && (
                  <span className="ml-2 text-sm text-gray-700">No file chosen</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HOD/Admin Specific Fields (Conditional Rendering) */}
        {(currentUserRole === 'hod' || currentUserRole === 'admin') && (
          <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-blue-50 bg-opacity-30">
            <h3 className="text-lg font-semibold mb-3 text-blue-800">HOD/Admin Review Section</h3>

            <div className="mb-4">
              <label className="block font-semibold mb-2">HOD Remarks:</label>
              <textarea
                name="hodRemarks"
                value={formData.hodRemarks}
                onChange={handleChange}
                disabled={!canEditField('hodRemarks')}
                rows="3"
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div className="mb-4">
              <label className="block font-semibold mb-2">Status:</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={!canEditField('status')}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="under_review">Under Review</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block font-semibold mb-2">Amount Recommended (Rs.):</label>
              <input
                type="number"
                name="amountRecommended"
                value={formData.amountRecommended}
                onChange={handleChange}
                disabled={!canEditField('amountRecommended')}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                min="0"
                step="0.01"
              />
            </div>

            <div className="mb-4">
              <label className="block font-semibold mb-2">Comments:</label>
              <textarea
                name="comments"
                value={formData.comments}
                onChange={handleChange}
                disabled={!canEditField('comments')}
                rows="3"
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <div className="mb-4">
              <label className="block font-semibold mb-2">Final Amount (Rs.):</label>
              <input
                type="number"
                name="finalAmount"
                value={formData.finalAmount}
                onChange={handleChange}
                disabled={!canEditField('finalAmount')}
                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-between mt-8">
          {/* Only show submit/update button if the current role can edit any field related to submission */}
          {(canEditField('organizingInstitute') || canEditField('hodRemarks') || canEditField('studentSignature') || canEditField('guideSignature')) && (
            <button
              onClick={handleSubmit}
              className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
            >
              {isNewForm ? 'Submit Form' : 'Update Form'}
            </button>
          )}
          <button
            onClick={() => window.history.back()}
            className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PG_2_A;
