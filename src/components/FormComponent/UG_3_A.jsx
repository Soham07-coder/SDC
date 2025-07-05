import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from "axios";

const UG3AForm = ({ data = null, viewOnly = false }) => {
  const [formData, setFormData] = useState(
    data ?? {
      organizingInstitute: '',
      projectTitle: '',
      students: [
        { name: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" }
      ],
      expenses: [
        { srNo: "1", description: "", amount: "" }
      ],
      bankDetails: {
        beneficiary: "",
        bankName: "",
        branch: "",
        ifsc: "",
        accountType:"",
        accountNumber: ""
      },
      svvNetId: "" // Initialize svvNetId for new forms if it's a form field
    }
  );
  const [totalAmount, setTotalAmount] = useState(0);

  
  const [files, setFiles] = useState({
    image: { file: null, url: null, name: null, fileId: null, size: null }, // Initialize with size property
    pdfs: [],
    zipFile: { file: null, url: null, name: null, fileId: null, size: null } // Initialize with size property
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  const imageInputRef = useRef(null);
  const pdfsInputRef = useRef(null);
  const zipFileInputRef = useRef(null);

  const disableFileControls = viewOnly;

  const [userRole, setUserRole] = useState(null);
  const isStudent = userRole === 'student';

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        setUserRole(user.role);
      } catch (err) {
        console.error("Failed to parse user data from local storage:", err);
      }
    }
  }, []);

  useEffect(() => {
    const storedSvvNetId = localStorage.getItem('svvNetId');
    // Only set if a stored ID exists and formData.svvNetId is not already populated (e.g., from `data` prop)
    if (storedSvvNetId && !formData.svvNetId) {
      setFormData(prev => ({
        ...prev,
        svvNetId: storedSvvNetId
      }));
    }
  }, [formData.svvNetId]);


  // Effect to load data when in viewOnly mode or initial data is provided
  useEffect(() => {
    if (data) {
      setFormData(data); // Update main form data

      const tempFiles = {
        image: { file: null, url: null, name: null, fileId: null, size: null },
        pdfs: [],
        zipFile: { file: null, url: null, name: null, fileId: null, size: null }
      };

      // For uploadedImage
      if (data.uploadedImage && data.uploadedImage.id) {
        tempFiles.image = {
          file: null,
          url: `/api/ug3aform/file/${data.uploadedImage.id}`,
          name: data.uploadedImage.filename,
          fileId: data.uploadedImage.id,
          size: data.uploadedImage.size
        };
      }

      // For uploadedPdfs
      if (data.uploadedPdfs && data.uploadedPdfs.length > 0) {
        tempFiles.pdfs = data.uploadedPdfs.map(pdf => ({
          file: null,
          url: `/api/ug3aform/file/${pdf.id}`,
          name: pdf.filename,
          fileId: pdf.id,
          size: pdf.size
        }));
      }

      // For uploadedZipFile
      if (data.uploadedZipFile && data.uploadedZipFile.fileId) {
        tempFiles.zipFile = {
          file: null,
          url: `/api/ug3aform/file/${data.uploadedZipFile.fileId}`,
          name: data.uploadedZipFile.filename,
          fileId: data.uploadedZipFile.fileId,
          size: data.uploadedZipFile.size
        };
      } else if (data.zipFile && data.zipFile.id) {
        tempFiles.zipFile = {
          file: null,
          url: `/api/ug3aform/file/${data.zipFile.id}`,
          name: data.zipFile.filename,
          fileId: data.zipFile.id,
          size: data.zipFile.size
        };
      }
      setFiles(tempFiles);
    }
  }, [data, setFormData, setFiles]); // Depend on data and setters

  // Effect to calculate total amount whenever expenses change
  useEffect(() => {
    const amount = formData.expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setTotalAmount(amount);
  }, [formData.expenses]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };

  const handleStudentChange = (index, field, value) => {
    setFormData(prevData => {
      const newStudents = [...prevData.students];
      newStudents[index] = {
        ...newStudents[index], // Spread existing student data
        [field]: value,         // Update specific field
      };
      return { ...prevData, students: newStudents };
    });
  };

  const addStudent = () => {
    setFormData(prev => ({
      ...prev,
      students: [
        ...prev.students,
        { name: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" }
      ]
    }));
  };

  const removeStudent = (index) => {
    const updatedStudents = formData.students.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, students: updatedStudents }));
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`studentName${index}`];
      delete newErrors[`studentRollNo${index}`];
      return newErrors;
    });
  };

  const handleExpenseChange = (index, field, value) => {
    setFormData(prevData => {
      const newExpenses = [...prevData.expenses];
      newExpenses[index] = {
        ...newExpenses[index], // Spread existing expense data
        [field]: value,         // Update specific field
      };

      // Ensure amount is handled as a number
      if (field === 'amount') {
          newExpenses[index].amount = value === '' ? '' : parseFloat(value) || 0;
      }

      return { ...prevData, expenses: newExpenses };
    });
  };

  const addExpense = () => {
    setFormData(prev => ({
      ...prev,
      expenses: [
        ...prev.expenses,
        { srNo: (prev.expenses.length + 1).toString(), description: "", amount: "" }
      ]
    }));
  };

  const removeExpense = (index) => {
    const updatedExpenses = formData.expenses.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, expenses: updatedExpenses.map((exp, idx) => ({ ...exp, srNo: (idx + 1).toString() })) }));
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`expenseDescription${index}`];
      delete newErrors[`expenseAmount${index}`];
      return newErrors;
    });
  };

  const handleBankDetailsChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
    setValidationErrors(prev => ({ ...prev, [name]: "" }));
  };

  // Centralized file change handler
  const handleFileChange = (type, e) => {
    setErrorMessage("");
    const selectedFiles = Array.from(e.target.files);

    if (type === 'image' && files.image.url && files.image.file) {
      URL.revokeObjectURL(files.image.url);
    } else if (type === 'zipFile' && files.zipFile.url && files.zipFile.file) {
      URL.revokeObjectURL(files.zipFile.url);
    } else if (type === 'pdfs') {
      files.pdfs.forEach(pdf => {
        if (pdf.url && pdf.file) URL.revokeObjectURL(pdf.url);
      });
    }

    if (selectedFiles.length === 0) {
      if (type === 'image' || type === 'zipFile') {
        setFiles(prev => ({ ...prev, [type]: { file: null, url: null, name: null, fileId: null, size: null } }));
      } else if (type === 'pdfs') {
        setFiles(prev => ({ ...prev, pdfs: [] }));
      }
      return;
    }

    if (type === 'image') {
      const file = selectedFiles[0];
      if (!file.type.startsWith("image/jpeg") && !file.type.startsWith("image/png")) {
        setErrorMessage("Only JPEG/PNG format is allowed for images.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, image: { file: null, url: null, name: null, fileId: null, size: null } }));
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setErrorMessage("Image size must be less than 2MB.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, image: { file: null, url: null, name: null, fileId: null, size: null } }));
        return;
      }
      setFiles(prev => ({
        ...prev,
        image: { file, url: URL.createObjectURL(file), name: file.name, size: file.size }
      }));
      setValidationErrors(prev => ({ ...prev, image: "" }));
    } else if (type === 'zipFile') {
      const file = selectedFiles[0];
      if (!file.name.toLowerCase().endsWith('.zip') && !["application/zip", "application/x-zip-compressed"].includes(file.type)) {
        setErrorMessage("Only ZIP files are allowed. Please select a .zip file.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, zipFile: { file: null, url: null, name: null, fileId: null, size: null } }));
        return;
      }
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        setErrorMessage("ZIP file size must be less than 20MB.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, zipFile: { file: null, url: null, name: null, fileId: null, size: null } }));
        return;
      }
      setFiles(prev => ({
        ...prev,
        zipFile: { file, url: URL.createObjectURL(file), name: file.name, size: file.size }
      }));
      setValidationErrors(prev => ({ ...prev, zipFile: "" }));
    } else if (type === 'pdfs') {
      if (selectedFiles.length > 5) {
        setErrorMessage("You can select a maximum of 5 PDF files.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, pdfs: [] }));
        return;
      }
      const newPdfFiles = [];
      for (const file of selectedFiles) {
        if (file.type !== "application/pdf") {
          setErrorMessage(`File "${file.name}" is not a PDF. Please select only PDF files.`);
          e.target.value = null;
          setFiles(prev => ({ ...prev, pdfs: [] }));
          return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit per PDF
          setErrorMessage(`PDF file "${file.name}" exceeds the 5MB size limit.`);
          e.target.value = null;
          setFiles(prev => ({ ...prev, pdfs: [] }));
          return;
        }
        newPdfFiles.push({
          file: file,
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size
        });
      }
      setFiles(prev => ({ ...prev, pdfs: newPdfFiles }));
      setValidationErrors(prev => ({ ...prev, pdfs: "" }));
    }
  };

  const handleRemoveFile = useCallback((type, fileIndex = null) => {
    setFiles(prevFiles => {
      const newFiles = { ...prevFiles };
      if (type === 'image') {
        if (newFiles.image.url && newFiles.image.file) URL.revokeObjectURL(newFiles.image.url);
        newFiles.image = { file: null, url: null, name: null, fileId: null, size: null };
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (!viewOnly) setValidationErrors(prev => ({ ...prev, image: "Project image is required." })); // Only add validation error if not in viewOnly
      } else if (type === 'pdfs') {
        if (fileIndex !== null) {
          if (newFiles.pdfs[fileIndex]?.url && newFiles.pdfs[fileIndex]?.file) {
            URL.revokeObjectURL(newFiles.pdfs[fileIndex].url);
          }
          newFiles.pdfs = prevFiles.pdfs.filter((_, i) => i !== fileIndex);
        } else {
          newFiles.pdfs.forEach(pdf => { if (pdf.url && pdf.file) URL.revokeObjectURL(pdf.url); });
          newFiles.pdfs = [];
        }
        if (newFiles.pdfs.length === 0 && pdfsInputRef.current) {
          pdfsInputRef.current.value = '';
          if (!viewOnly) setValidationErrors(prev => ({ ...prev, pdfs: "At least one supporting PDF is required." }));
        }
      } else if (type === 'zipFile') {
        if (newFiles.zipFile.url && newFiles.zipFile.file) URL.revokeObjectURL(newFiles.zipFile.url);
        newFiles.zipFile = { file: null, url: null, name: null, fileId: null, size: null };
        if (zipFileInputRef.current) zipFileInputRef.current.value = '';
        if (!viewOnly) setValidationErrors(prev => ({ ...prev, zipFile: "Remaining documents ZIP file is required." }));
      }
      return newFiles;
    });
    setErrorMessage('');
  }, [viewOnly]); // Add viewOnly to dependencies of handleRemoveFile

  const validateForm = useCallback(() => {
    let errors = {};

    // Basic Field Validations
    if (!formData.organizingInstitute) errors.organizingInstitute = "Organizing Institute is required.";
    if (!formData.projectTitle) errors.projectTitle = "Project Title is required.";
    if (!formData.svvNetId) errors.svvNetId = "SVV Net ID is required.";

    // Student Validations
    formData.students.forEach((student, index) => {
      if (!student.name) errors[`studentName${index}`] = "Student name is required.";
      if (!student.rollNo) errors[`studentRollNo${index}`] = "Roll No is required.";
      if (!student.class) errors[`studentClass${index}`] = "Class is required.";
      if (!student.div) errors[`studentDiv${index}`] = "Division is required.";
      if (!student.branch) errors[`studentBranch${index}`] = "Branch is required.";
      if (!student.mobileNo) errors[`studentMobileNo${index}`] = "Mobile No is required.";
    });

    // Expense Validations
    if (formData.expenses.length === 0) {
      errors.expenses = "At least one expense is required.";
    } else {
      formData.expenses.forEach((expense, index) => {
        if (!expense.description) errors[`expenseDescription${index}`] = "Expense description is required.";
        const amount = parseFloat(expense.amount);
        if (isNaN(amount) || amount <= 0) errors[`expenseAmount${index}`] = "Amount must be a positive number.";
      });
    }

    // File Validations
    if (!viewOnly) { // Validate files only if NOT in viewOnly mode
      // Image: Must have either a newly selected file OR an existing fileId OR preloaded data fileId
      if (
        !files.image.file &&
        !files.image.fileId &&
        !(data?.uploadedImage?.id || data?.uploadedImage?.fileId)
      ) {
        errors.image = "Project image is required.";
      }

      // PDFs: Must have at least one selected file OR existing files from initial data
      if (
        files.pdfs.length === 0 &&
        !(data?.uploadedPdfs && data.uploadedPdfs.length > 0)
      ) {
        errors.pdfs = "At least one supporting PDF is required.";
      }

      // ZIP: Must have either a selected file OR an existing fileId OR preloaded data fileId
      if (
        !files.zipFile.file &&
        !files.zipFile.fileId &&
        !(data?.uploadedZipFile?.fileId || data?.zipFile?.id)
      ) {
        errors.zipFile = "Remaining documents ZIP file is required.";
      }
    }

    // Bank Details Validations
    if (!formData.bankDetails.beneficiary) errors.beneficiary = "Beneficiary name is required.";
    if (!formData.bankDetails.accountNumber) errors.accountNumber = "Account number is required.";
    if (!formData.bankDetails.bankName) errors.bankName = "Bank name is required.";
    if (!formData.bankDetails.branch) errors.branch = "Branch is required.";
    if (!formData.bankDetails.ifsc) errors.ifsc = "IFSC code is required.";
    if (!formData.bankDetails.accountType) errors.accountType = "Account type is required.";

    setValidationErrors(errors);
    console.log("Errors Object:", errors); // ✅ Log errors object
    console.log("Is form valid?", Object.keys(errors).length === 0); // ✅ Log if the form is valid
    return Object.keys(errors).length === 0;
  }, [formData, files, data, viewOnly]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!validateForm()) {
      setErrorMessage("Please correct the errors in the form.");
      return;
    } else {
      setValidationErrors({}); // 🔴 Add this to clear errors when form is valid
    }
    try {
      const formDataToSend = new FormData();

      formDataToSend.append("organizingInstitute", formData.organizingInstitute);
      formDataToSend.append("projectTitle", formData.projectTitle);
      formDataToSend.append("students", JSON.stringify(formData.students));
      formDataToSend.append("expenses", JSON.stringify(formData.expenses));
      formDataToSend.append("bankDetails", JSON.stringify(formData.bankDetails));
      formDataToSend.append("svvNetId", formData.svvNetId);

      if (files.image.file) {
        formDataToSend.append("uploadedImage", files.image.file);
      }
      files.pdfs.forEach((pdfFileObj) => {
        if (pdfFileObj.file) {
          formDataToSend.append(`uploadedPdfs`, pdfFileObj.file);
        }
      });
      if (files.zipFile.file) {
        formDataToSend.append("uploadedZipFile", files.zipFile.file);
      }
      // If data is provided (meaning we are updating an existing form),
      // we need to send the IDs of existing files that were NOT removed.
      // This logic will depend on your backend's API for updates.
      // For example, you might send an array of original file IDs that should be kept.
      if (data) {
        if (data.uploadedImage && !files.image.file && files.image.fileId) {
            // Image existed and was not replaced, send its ID to keep it
            formDataToSend.append("existingImageId", files.image.fileId);
        }
        const existingPdfIds = files.pdfs
            .filter(pdf => pdf.fileId) // Only include PDFs that came from initial data (have a fileId)
            .map(pdf => pdf.fileId);
        if (existingPdfIds.length > 0) {
            formDataToSend.append("existingPdfIds", JSON.stringify(existingPdfIds));
        }
        if (data.uploadedZipFile && !files.zipFile.file && files.zipFile.fileId) {
            formDataToSend.append("existingZipFileId", files.zipFile.fileId);
        } else if (data.zipFile && !files.zipFile.file && files.zipFile.fileId) {
             formDataToSend.append("existingZipFileId", files.zipFile.fileId);
        }
      }

      const response = await axios.post("http://localhost:5000/api/ug3aform/submit", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert(response.data.message);
      setErrorMessage(""); // <-- Add this to clear the error
      if (!data) { // Only clear if it's a new form, not an update
        setFormData({
          organizingInstitute: '',
          projectTitle: '',
          students: [
            { name: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" }
          ],
          expenses: [
            { srNo: "1", description: "", amount: "" }
          ],
          bankDetails: {
            beneficiary: "",
            bankName: "",
            branch: "",
            ifsc: "",
            accountType:"",
            accountNumber: ""
          },
          svvNetId: ""
        });
        setFiles({
          image: { file: null, url: null, name: null, fileId: null, size: null },
          pdfs: [],
          zipFile: { file: null, url: null, name: null, fileId: null, size: null }
        });
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (pdfsInputRef.current) pdfsInputRef.current.value = '';
        if (zipFileInputRef.current) zipFileInputRef.current.value = '';
      }

    } catch (error) {
      console.error("Form submission error:", error);
      if (error.response && error.response.data && error.response.data.error) {
        setErrorMessage(error.response.data.error);
      } else if (error.response && error.response.data && error.response.data.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage("An unexpected error occurred during form submission. Please check console for details.");
      }
    }
  };

  // Helper function to render file display (adjust for your specific UI)
  const FilePreview = useCallback((fileInfo, type, index = null) => {
    // Skip rendering if file is invalid in viewOnly student mode
    if (viewOnly && isStudent && !fileInfo?.url && !fileInfo?.fileId && !fileInfo?.id && !(fileInfo?.file instanceof File)) {
      return null;
    }

    // Skip rendering if file is invalid in any mode
    if (!fileInfo || (!fileInfo.url && !fileInfo.fileId && !fileInfo.id && !(fileInfo.file instanceof File))) {
      return null;
    }

    const displayUrl = fileInfo.url ||
      (fileInfo.fileId ? `/api/ug3aform/file/${fileInfo.fileId}` : null) ||
      (fileInfo.id ? `/api/ug3aform/file/${fileInfo.id}` : null);

    const fileName = fileInfo.name || (fileInfo.file ? fileInfo.file.name : 'Unnamed File');
    const fileSizeMB = fileInfo.file
      ? (fileInfo.file.size / (1024 * 1024)).toFixed(2)
      : (fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'N/A');

    let linkText = '';
    if (viewOnly) {
      switch (type) {
        case 'image':
          linkText = "View Project Image";
          break;
        case 'pdfs':
          linkText = `View Supporting PDF ${index !== null ? index + 1 : ''}`;
          break;
        case 'zipFile':
          linkText = "View Documents ZIP";
          break;
        default:
          linkText = "View File";
      }
    } else {
      linkText = `Selected: ${fileName} (${fileSizeMB} MB)`;
    }

    return (
      <div className="mt-2 flex items-center justify-between p-2 border rounded bg-blue-50">
        {viewOnly ? (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline flex-grow"
          >
            {linkText}
          </a>
        ) : (
          <span className="flex-grow">{linkText}</span>
        )}

        {!disableFileControls && (
          <button
            type="button"
            onClick={() => handleRemoveFile(type, index)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
    );
  }, [viewOnly, handleRemoveFile, isStudent]);

  // Determine if the file uploads section should be visible for a student in viewOnly mode
  const shouldShowFileUploadsForStudentInViewMode =
    viewOnly && isStudent && (
      (data?.uploadedImage?.id || files.image.url) ||
      (data?.uploadedPdfs?.length > 0 || files.pdfs.length > 0) ||
      (data?.uploadedZipFile?.fileId || data?.zipFile?.id || files.zipFile.url)
    );

  // Determine if the file uploads section should be visible in general (non-student or not viewOnly)
  const shouldShowFileUploadsGenerally = !viewOnly || !isStudent;

  // Final condition to render the entire section
  if (!shouldShowFileUploadsGenerally && !shouldShowFileUploadsForStudentInViewMode) {
    return null; // Hide the entire section if no files to show for a student in viewOnly
  }

  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Under Graduate Form 3A - Project Competition</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Application Form</h2>
      
      <div className="mb-6">
          <label htmlFor="organizingInstitute" className="block font-semibold mb-2">Name and Address of Organizing Institute:</label>
          <input
              type="text"
              id="organizingInstitute"
              name="organizingInstitute"
              value={formData.organizingInstitute}
              onChange={handleChange}
              className={`w-full p-2 border rounded 
                  ${viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border-gray-300"} 
                  ${validationErrors.organizingInstitute ? "border-red-500" : ""}` // Keep validation styling
              }
              disabled={viewOnly} // Disable input when in viewOnly mode
          />
          {validationErrors.organizingInstitute && !viewOnly && ( // Only show validation error if not in viewOnly mode
              <p className="text-red-500 text-sm mt-1">{validationErrors.organizingInstitute}</p>
          )}
      </div>

      {/* Project Title */}
      <div className="mb-6">
    <label htmlFor="projectTitle" className="block font-semibold mb-2">Title of Project:</label>
    <input
        type="text"
        id="projectTitle"
        name="projectTitle"
        value={formData.projectTitle}
        onChange={handleChange}
        className={`w-full p-2 border rounded 
            ${viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border-gray-300"} 
            ${validationErrors.projectTitle ? "border-red-500" : ""}` // Keep validation styling
        }
        disabled={viewOnly} // Disable input when in viewOnly mode
    />
    {validationErrors.projectTitle && !viewOnly && ( // Only show validation error if not in viewOnly mode
        <p className="text-red-500 text-sm mt-1">{validationErrors.projectTitle}</p>
    )}
      </div>

      {/* Student Details */}
    <div className="mb-6">
      <h3 className="font-semibold mb-2">Student Details</h3>
      {/* The table structure is now always rendered, regardless of viewOnly */}
      <table className="w-full mb-4 border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-300 text-left">Name of Student</th>
            <th className="p-2 border border-gray-300 text-left">Class</th>
            <th className="p-2 border border-gray-300 text-left">Div</th>
            <th className="p-2 border border-gray-300 text-left">Branch</th>
            <th className="p-2 border border-gray-300 text-left">Roll No.</th>
            <th className="p-2 border border-gray-300 text-left">Mobile No.</th>
            <th className="p-2 border border-gray-300 text-center">Action</th> {/* Center align action header */}
          </tr>
        </thead>
        <tbody>
          {formData.students.map((student, index) => (
            <tr key={index}>
              {/* Name Input */}
              <td className="p-0 border border-gray-300"> {/* p-0 on td to allow input to fill cell */}
                <input
                  type="text"
                  value={student.name}
                  onChange={(e) => handleStudentChange(index, 'name', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${ /* p-2 on input itself for content padding */
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`student_name_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly}
                />
                {validationErrors[`student_name_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`student_name_${index}`]}</p> /* Added px-2 */
                )}
              </td>
              {/* Class Input */}
              <td className="p-0 border border-gray-300">
                <input
                  type="text"
                  value={student.class}
                  onChange={(e) => handleStudentChange(index, 'class', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`student_class_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly}
                />
                {validationErrors[`student_class_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`student_class_${index}`]}</p>
                )}
              </td>
              {/* Div Input */}
              <td className="p-0 border border-gray-300">
                <input
                  type="text"
                  value={student.div}
                  onChange={(e) => handleStudentChange(index, 'div', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`student_div_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly}
                />
                {validationErrors[`student_div_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`student_div_${index}`]}</p>
                )}
              </td>
              {/* Branch Input */}
              <td className="p-0 border border-gray-300">
                <input
                  type="text"
                  value={student.branch}
                  onChange={(e) => handleStudentChange(index, 'branch', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`student_branch_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly}
                />
                {validationErrors[`student_branch_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`student_branch_${index}`]}</p>
                )}
              </td>
              {/* Roll No. Input */}
              <td className="p-0 border border-gray-300">
                <input
                  type="text"
                  value={student.rollNo}
                  onChange={(e) => handleStudentChange(index, 'rollNo', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`student_rollNo_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly}
                />
                {validationErrors[`student_rollNo_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`student_rollNo_${index}`]}</p>
                )}
              </td>
              {/* Mobile No. Input */}
              <td className="p-0 border border-gray-300">
                <input
                  type="text"
                  value={student.mobileNo}
                  onChange={(e) => handleStudentChange(index, 'mobileNo', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`student_mobileNo_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly}
                />
                {validationErrors[`student_mobileNo_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`student_mobileNo_${index}`]}</p>
                )}
              </td>
              {/* Action Button (Remove) */}
              <td className="p-2 border border-gray-300 text-center">
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 text-lg"
                  onClick={() => removeStudent(index)}
                  disabled={viewOnly || formData.students.length <= 1} /* Disable if viewOnly or only one student */
                >
                  ❌
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Add More Student Button */}
      <button
          type="button"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center" /* Added flex and items-center for icon alignment */
          onClick={addStudent}
          disabled={viewOnly} /* Disable if viewOnly */
      >
      <span className="text-lg mr-2">➕</span> Add More Student {/* Icon and text separation */}
      </button>
    </div>

      {/* Expense Details */}
    <div className="mb-6">
      <h3 className="font-semibold mb-2">Expense Details</h3>
      {/* The table structure is now always rendered */}
      <table className="w-full mb-4 border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border border-gray-300 text-left">Sr. No.</th>
            <th className="p-2 border border-gray-300 text-left">Description</th>
            <th className="p-2 border border-gray-300 text-left">Amount (₹)</th>
            <th className="p-2 border border-gray-300 text-center">Action</th> {/* Center align action header */}
          </tr>
        </thead>
        <tbody>
          {formData.expenses.map((expense, index) => (
            <tr key={index}>
              <td className="p-2 border border-gray-300">
                {/* Display Sr. No. */}
                <span className={viewOnly ? "text-gray-700" : ""}>{expense.srNo}</span>
              </td>
              {/* Description Input */}
              <td className="p-0 border border-gray-300"> {/* p-0 on td to allow input to fill cell */}
                <input
                  type="text"
                  value={expense.description}
                  onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${ /* p-2 on input itself for content padding */
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`expense_description_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly} // Disable input when in viewOnly mode
                />
                {validationErrors[`expense_description_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`expense_description_${index}`]}</p>
                )}
              </td>
              {/* Amount Input */}
              <td className="p-0 border border-gray-300">
                <input
                  type="number"
                  value={expense.amount}
                  onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                  className={`w-full p-2 focus:outline-none ${
                    viewOnly ? "bg-gray-100 text-gray-700 cursor-not-allowed" : "border rounded border-gray-300"
                  } ${
                    validationErrors[`expense_amount_${index}`] ? "border-red-500" : ""
                  }`}
                  disabled={viewOnly} // Disable input when in viewOnly mode
                />
                {validationErrors[`expense_amount_${index}`] && !viewOnly && (
                  <p className="text-red-500 text-xs mt-1 px-2">{validationErrors[`expense_amount_${index}`]}</p>
                )}
              </td>
              {/* Action Button (Remove) */}
              <td className="p-2 border border-gray-300 text-center">
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 text-lg"
                  onClick={() => removeExpense(index)}
                  disabled={viewOnly || formData.expenses.length <= 1} /* Disable if viewOnly or only one expense */
                >
                  ❌
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Add More Expense Button */}
      <button
        type="button"
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        onClick={addExpense}
        disabled={viewOnly} // Disable if viewOnly
      >
        <span className="text-lg mr-2">➕</span> Add More Expense
      </button>
      {/* Total Amount Display - This can remain outside the conditional */}
      <div className="mt-4 p-2 border-t-2 border-gray-300 font-bold text-right">
        Total Amount: ₹{totalAmount.toFixed(2)}
      </div>
    </div>

      {/* Bank Details */}
    <table className="w-full mb-6 border border-gray-300">
        <tbody>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100" colSpan="2">Bank details for RTGS/NEFT</th>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">Beneficiary name, brief address and mobile no. (Student author)</th>
            <td className="p-2 border border-gray-300">
              {viewOnly ? (
                <p className="p-2 bg-gray-100">{formData.bankDetails.beneficiary}</p>
              ) : (
                <input
                  type="text"
                  name="beneficiary"
                  value={formData.bankDetails.beneficiary}
                  onChange={handleBankChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.beneficiary ? "border-red-500" : "border-gray-300"
                  }`}
                />
              )}
               {validationErrors.beneficiary && <p className="text-red-500 text-xs mt-1">{validationErrors.beneficiary}</p>}
            </td>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">IFSC Code</th>
            <td className="p-2 border border-gray-300">
              {viewOnly ? (
                <p className="p-2 bg-gray-100">{formData.bankDetails.ifsc}</p>
              ) : (
                <input
                  type="text"
                  name="ifsc"
                  value={formData.bankDetails.ifsc}
                  onChange={handleBankDetailsChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.ifsc ? "border-red-500" : "border-gray-300"
                  }`}
                />
              )}
              {validationErrors.ifsc && <p className="text-red-500 text-xs mt-1">{validationErrors.ifsc}</p>}
            </td>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">Name of the bank</th>
            <td className="p-2 border border-gray-300">
              {viewOnly ? (
                <p className="p-2 bg-gray-100">{formData.bankDetails.bankName}</p>
              ) : (
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankDetails.bankName}
                  onChange={handleBankDetailsChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.bankName ? "border-red-500" : "border-gray-300"
                  }`}
                />
              )}
              {validationErrors.bankName && <p className="text-red-500 text-xs mt-1">{validationErrors.bankName}</p>}
            </td>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">Branch</th>
            <td className="p-2 border border-gray-300">
              {viewOnly ? (
                <p className="p-2 bg-gray-100">{formData.bankDetails.branch}</p>
              ) : (
                <input
                  type="text"
                  name="branch"
                  value={formData.bankDetails.branch}
                  onChange={handleBankDetailsChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.branch ? "border-red-500" : "border-gray-300"
                  }`}
                />
              )}
              {validationErrors.branch && <p className="text-red-500 text-xs mt-1">{validationErrors.branch}</p>}
            </td>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">Account type</th>
            <td className="p-2 border border-gray-300">
              {viewOnly ? (
                <p className="p-2 bg-gray-100">
                  {formData.bankDetails.accountType || "—"}
                </p>
              ) : (
                <input
                  type="text"
                  name="accountType"
                  value={formData.bankDetails.accountType}
                  onChange={handleBankDetailsChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.accountType ? "border-red-500" : "border-gray-300"
                  }`}
                />
              )}
              {validationErrors.accountType && (
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.accountType}
                </p>
              )}
            </td>
          </tr>
          <tr>
            <th className="p-2 border border-gray-300 bg-gray-100">Account number</th>
            <td className="p-2 border border-gray-300">
              {viewOnly ? (
                <p className="p-2 bg-gray-100">{formData.bankDetails.accountNumber}</p>
              ) : (
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={handleBankDetailsChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.accountNumber ? "border-red-500" : "border-gray-300"
                  }`}
                />
              )}
              {validationErrors.accountNumber && <p className="text-red-500 text-xs mt-1">{validationErrors.accountNumber}</p>}
            </td>
          </tr>
        </tbody>
    </table>

      {/* Image Upload Section */}
      <div className="form-group">
        <label htmlFor="imageUpload">Upload Image (JPEG/PNG Only)</label>
        {/* Image upload input is only visible for students when NOT in viewOnly mode */}
        {!viewOnly && isStudent && (
          <input
            type="file"
            id="imageUpload"
            accept=".jpeg,.jpg,.png,image/jpeg,image/png"
            onChange={(e) => handleFileChange('image', e)}
            ref={imageInputRef}
          />
        )}
        {/* File preview is visible ONLY if user is NOT a student OR user is a student and NOT in viewOnly mode */}
        {(userRole !== 'student' || !viewOnly) && FilePreview(files.image, 'image')}
        {validationErrors.image && <p className="error-message">{validationErrors.image}</p>}
      </div>

      {/* PDF Upload Section */}
      <div className="form-group">
        <label htmlFor="pdfUpload">Upload PDFs (Max 5 files, 5MB each)</label>
        {/* PDF upload input is only visible for students when NOT in viewOnly mode */}
        {!viewOnly && isStudent && (
          <input
            type="file"
            id="pdfUpload"
            accept=".pdf,application/pdf"
            multiple
            onChange={(e) => handleFileChange('pdfs', e)}
            ref={pdfsInputRef}
          />
        )}
        {files.pdfs.length > 0 && (userRole !== 'student' || !viewOnly) && (
          <div className="uploaded-files-list">
            <h4>Uploaded PDFs:</h4>
            <ul>
              {files.pdfs.map((file, index) => (
                <li key={index}>
                  {FilePreview(file, 'pdfs', index)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {validationErrors.pdfs && <p className="error-message">{validationErrors.pdfs}</p>}
      </div>

      {/* ZIP File Upload Section */}
      <div className="form-group">
        <label htmlFor="zipUpload">Upload ZIP File (Max 1 file, 20MB)</label>
        {/* ZIP upload input is only visible for students when NOT in viewOnly mode */}
        {!viewOnly && isStudent && (
          <input
            type="file"
            id="zipUpload"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(e) => handleFileChange('zipFile', e)}
            ref={zipFileInputRef}
          />
        )}
        {(userRole !== 'student' || !viewOnly) && FilePreview(files.zipFile, 'zipFile')}
        {validationErrors.zipFile && <p className="error-message">{validationErrors.zipFile}</p>}
      </div>

        {/* Form Actions */}
        {!viewOnly && (
          <div className="flex justify-between">
            <button onClick={() => window.history.back()} className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600">
              Back
            </button>
            <button  onClick={handleSubmit} className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default UG3AForm;