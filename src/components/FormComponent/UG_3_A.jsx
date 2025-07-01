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
      }
    }
  );

  const [totalAmount, setTotalAmount] = useState(0);

  const [files, setFiles] = useState({
    image: { file: null, url: null, name: null },
    pdfs: [], // Each item is { file: FileObject, url: 'blob:...', name: 'fileName' }
    zipFile: { file: null, url: null, name: null }
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  // Refs for file inputs to clear their values
  // These need to be attached to your actual file input JSX elements
  const imageInputRef = useRef(null); // Ref for the 'image' input
  const pdfsInputRef = useRef(null);  // Ref for the 'pdfs' input
  const zipFileInputRef = useRef(null); // Ref for the 'zipFile' input

  // Effect to populate form data and files when initialData changes or viewOnly mode changes
  useEffect(() => {
  if (data) {
    setFormData({
      organizingInstitute: data.organizingInstitute || '',
        projectTitle: data.projectTitle || data.topic || '',
        students: data.students && data.students.length > 0
          ? data.students
          : [{ name: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" }],
        expenses: data.expenses && data.expenses.length > 0
          ? data.expenses
          : [{ srNo: "1", description: "", amount: "" }],
        bankDetails: data.bankDetails || {
          beneficiary: "",
          bankName: "",
          branch: "",
          ifsc: "",
          accountNumber: "",
          accountType: "",
        },
        guideName: data.guideNames?.[0] || "",
        employeeCode: data.employeeCodes?.[0] || "",
        studentName: data.name || data.students?.[0]?.name || "",
        yearOfAdmission: data.yearOfAdmission || "",
        feesPaid: data.feesPaid || "Yes",
        conferenceDate: data.conferenceDate ? new Date(data.conferenceDate).toISOString().split('T')[0] : "",
        organization: data.organization || "",
        publisher: data.publisher || "",
        paperLink: data.paperLink || "",
        authors: data.authors && Array.isArray(data.authors)
          ? [...data.authors].concat(["", "", ""]).slice(0, 3)
          : ["", "", ""],
        projectDescription: data.projectDescription || "",
        utility: data.utility || "",
        receivedFinance: data.receivedFinance || "",
    });

    setFiles({
      image: data.uploadedImage
        ? { file: null, url: data.uploadedImage, name: data.uploadedImage.split('/').pop() || 'Existing Image' }
        : { file: null, url: null, name: null },
      pdfs: data.uploadedPdfs && data.uploadedPdfs.length > 0
        ? data.uploadedPdfs.map(pdf => ({ file: null, url: pdf.url, name: pdf.originalName || pdf.filename }))
        : [],
      zipFile: (data.zipFile || data.uploadedZipFile)
        ? { file: null, url: (data.zipFile || data.uploadedZipFile).url, name: (data.zipFile || data.uploadedZipFile).originalName || (data.zipFile || data.uploadedZipFile).filename || 'Existing ZIP' }
        : { file: null, url: null, name: null }
    });

    setTotalAmount(data.totalAmount || 0);
    setErrorMessage('');
    setValidationErrors({});
    } else if (!viewOnly) {
      // If no initialData and not in viewOnly mode, reset to a fresh form state
      console.log("Resetting form state.");
      setFormData({
        organizingInstitute: '',
        projectTitle: '',
        students: [{ name: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" }],
        expenses: [{ srNo: "1", description: "", amount: "" }],
        bankDetails: {
          beneficiary: "",
          bankName: "",
          branch: "",
          ifsc: "",
          accountNumber: ""
        },
        // Reset other fields too
        studentName: "",
        yearOfAdmission: "",
        feesPaid: "Yes",
        guideName: "",
        employeeCode: "",
        conferenceDate: "",
        organization: "",
        publisher: "",
        paperLink: "",
        authors: ["", "", ""],
        projectDescription: "",
        utility: "",
        receivedFinance: "",
      });
      setFiles({
        image: null,
        pdfs: [],
        zipFile: null
      });
      setTotalAmount(0);
      setErrorMessage('');
      setValidationErrors({});
    }
  }, [data, viewOnly]);
  // Effect to calculate totalAmount whenever expenses change
  useEffect(() => {
    const sum = formData.expenses.reduce((total, expense) => {
      const amount = parseFloat(expense.amount) || 0;
      return total + amount;
    }, 0);
    setTotalAmount(sum);
  }, [formData.expenses]);

  // Generic change handler for top-level form fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Note: If you add checkboxes, you'll need `type, checked` as before:
    // const { name, value, type, checked } = e.target;
    // [name]: type === "checkbox" ? checked : value,
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRemovePdf = (indexToRemove) => {
    setFiles(prevFiles => {
      const newPdfs = prevFiles.pdfs.filter((_, index) => index !== indexToRemove);
    
      // Clear input if no files left (optional)
      if (newPdfs.length === 0 && pdfsInputRef.current) {
        pdfsInputRef.current.value = "";
      }

      return { ...prevFiles, pdfs: newPdfs };
    });
  };

  // Change handler for student array fields (maintaining immutability)
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

  // Add new student row
  const addStudent = () => {
    setFormData(prev => ({
      ...prev,
      students: [...prev.students, { name: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" }]
    }));
  };

  const handlePdfsChange = (e) => {
    setErrorMessage("");
    const selectedPdfs = Array.from(e.target.files);

    if (selectedPdfs.length === 0) {
      files.pdfs.forEach(pdf => { // Revoke URLs for current local PDFs
        if (pdf.file && pdf.url) URL.revokeObjectURL(pdf.url);
      });
      setFiles(prev => ({ ...prev, pdfs: [] }));
      return;
    }

    if (selectedPdfs.length > 5) {
      setErrorMessage("You can select a maximum of 5 PDF files.");
      e.target.value = null;
      files.pdfs.forEach(pdf => { if (pdf.file && pdf.url) URL.revokeObjectURL(pdf.url); }); // Revoke existing local URLs before clearing
      setFiles(prev => ({ ...prev, pdfs: [] })); // Clear all selected PDFs if count is too high
      return;
    }

    const newPdfFiles = [];
    for (const file of selectedPdfs) {
      if (file.type !== "application/pdf") {
        setErrorMessage(`File "${file.name}" is not a PDF. Please select only PDF files.`);
        e.target.value = null;
        files.pdfs.forEach(pdf => { if (pdf.file && pdf.url) URL.revokeObjectURL(pdf.url); }); // Revoke existing local URLs before clearing
        setFiles(prev => ({ ...prev, pdfs: [] }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // Example: 5MB limit per PDF
        setErrorMessage(`PDF file "${file.name}" exceeds the 5MB size limit.`);
        e.target.value = null;
        files.pdfs.forEach(pdf => { if (pdf.file && pdf.url) URL.revokeObjectURL(pdf.url); }); // Revoke existing local URLs before clearing
        setFiles(prev => ({ ...prev, pdfs: [] }));
        return;
      }
      newPdfFiles.push({
        file: file,
        url: URL.createObjectURL(file), // Create URL for each new PDF
        name: file.name
      });
    }

    // Revoke old URLs from previous selection if any
    files.pdfs.forEach(pdf => {
      if (pdf.file && pdf.url) URL.revokeObjectURL(pdf.url);
    });

    setFiles(prev => ({ ...prev, pdfs: newPdfFiles }));
  };

  // Remove student row
  const removeStudent = (index) => {
    if (formData.students.length > 1) { // Ensure at least one student remains
      const newStudents = formData.students.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, students: newStudents }));
    }
  };

  // Change handler for expense array fields (maintaining immutability and parsing amount)
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

  // Add new expense row
  const addExpense = () => {
    const newSrNo = (formData.expenses.length + 1).toString(); // Auto-increment Sr. No.
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { srNo: newSrNo, description: "", amount: "" }]
    }));
  };

  // Remove expense row
  const removeExpense = (index) => {
    if (formData.expenses.length > 1) { // Ensure at least one expense remains
      const newExpenses = formData.expenses.filter((_, i) => i !== index)
        .map((expense, i) => ({ ...expense, srNo: (i + 1).toString() })); // Re-index Sr. No. after removal
      setFormData(prev => ({ ...prev, expenses: newExpenses }));
    }
  };

  // Change handler for bank details fields
  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };

  // Handle file input changes with validation
  const handleFileChange = (field, e) => {
    setErrorMessage(""); // Clear previous general error
    const selectedFile = e.target.files[0]; // For single file inputs

    if (!selectedFile) {
      // Clear the specific file state if no file is chosen (e.g., user cancels dialog)
      setFiles(prev => {
        // Revoke existing object URL if it was a local file
        if (prev[field] && prev[field].file && prev[field].url) {
          URL.revokeObjectURL(prev[field].url);
        }
        return { ...prev, [field]: { file: null, url: null, name: null } };
      });
      return;
    }

    // Revoke any previous object URL for this field before creating a new one
    if (files[field] && files[field].file && files[field].url) {
      URL.revokeObjectURL(files[field].url);
    }

    if (field === "image") {
      if (!selectedFile.type.startsWith("image/jpeg")) {
        setErrorMessage("Only JPEG format is allowed for images.");
        e.target.value = null; // Reset file input
        setFiles(prev => ({ ...prev, image: { file: null, url: null, name: null } }));
        return;
      }
      // Optional: Add size validation for image
      if (selectedFile.size > 2 * 1024 * 1024) { // Example: 2MB limit
        setErrorMessage("Image size must be less than 2MB.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, image: { file: null, url: null, name: null } }));
        return;
      }
      setFiles(prev => ({
        ...prev,
        image: {
          file: selectedFile,
          url: URL.createObjectURL(selectedFile),
          name: selectedFile.name
        }
      }));
    } else if (field === "zipFile") {
      // Basic ZIP type check (can be expanded for more MIME types if needed)
      if (!selectedFile.name.toLowerCase().endsWith('.zip') && !["application/zip", "application/x-zip-compressed", "application/octet-stream"].includes(selectedFile.type)) {
        setErrorMessage("Only ZIP files are allowed. Please select a .zip file.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, zipFile: { file: null, url: null, name: null } }));
        return;
      }
      // Optional: Add size validation for ZIP file
      if (selectedFile.size > 20 * 1024 * 1024) { // Example: 20MB limit for ZIP
        setErrorMessage("ZIP file size must be less than 20MB.");
        e.target.value = null;
        setFiles(prev => ({ ...prev, zipFile: { file: null, url: null, name: null } }));
        return;
      }
      setFiles(prev => ({
        ...prev,
        zipFile: {
          file: selectedFile,
          url: URL.createObjectURL(selectedFile),
          name: selectedFile.name
        }
      }));
    }
    // Note: handlePdfsChange is separate for multiple files
  };

  // Callback to remove specific files (useful for displaying selected files with remove buttons)
  const handleRemoveFile = useCallback((fileType, index = null) => {
    setFiles(prevFiles => {
      const newFiles = { ...prevFiles };
      if (fileType === 'pdfs') {
        if (index !== null) { // Remove specific PDF by index
          newFiles[fileType] = prevFiles.pdfs.filter((_, i) => i !== index);
        } else { // Clear all PDFs (this case might be less common with individual remove buttons)
          newFiles[fileType] = [];
        }
      } else { // Clear single file (image, zipFile)
        newFiles[fileType] = null;
      }
      return newFiles;
    });

    // Clear corresponding input ref value to allow re-selection
    // Make sure these refs are correctly attached to your JSX inputs!
    if (fileType === 'image' && imageInputRef.current) {
        imageInputRef.current.value = '';
    } else if (fileType === 'pdfs' && pdfsInputRef.current) {
        pdfsInputRef.current.value = '';
    } else if (fileType === 'zipFile' && zipFileInputRef.current) {
        zipFileInputRef.current.value = '';
    }

    // Clear any validation errors related to this file type
    setValidationErrors(prev => ({ ...prev, [fileType]: undefined }));
    setErrorMessage('');
  }, []); // Dependencies for useCallback. None needed if refs are stable.

  // Validation logic for the entire form
  const validateForm = () => {
    let errors = {};

    if (!formData.organizingInstitute.trim()) {
      errors.organizingInstitute = "Organizing Institute is required.";
    }
    if (!formData.projectTitle.trim()) {
      errors.projectTitle = "Project Title is required.";
    }

    formData.students.forEach((student, i) => {
      if (!student.name.trim()) errors[`student_name_${i}`] = "Name is required";
      if (!student.class.trim()) errors[`student_class_${i}`] = "Class is required";
      if (!student.div.trim()) errors[`student_div_${i}`] = "Div is required";
      if (!student.branch.trim()) errors[`student_branch_${i}`] = "Branch is required";
      if (!student.rollNo.trim()) errors[`student_rollNo_${i}`] = "Roll No. is required";
      if (!student.mobileNo.trim()) errors[`student_mobileNo_${i}`] = "Mobile No. is required";
    });

    formData.expenses.forEach((expense, i) => {
      if (!expense.description.trim()) errors[`expense_description_${i}`] = "Description is required";
      // Validate amount specifically for expenses
      if (expense.amount === "" || isNaN(parseFloat(expense.amount)) || parseFloat(expense.amount) <= 0) {
        errors[`expense_amount_${i}`] = "Valid amount is required";
      }
    });

    const bd = formData.bankDetails;
    if (!bd.beneficiary.trim()) errors.beneficiary = "Beneficiary is required";
    if (!bd.bankName.trim()) errors.bankName = "Bank Name is required";
    if (!bd.branch.trim()) errors.branch = "Branch is required";
    if (!bd.ifsc.trim()) errors.ifsc = "IFSC Code is required";
    // Added validation for accountType as it's now in your bankDetails state
    if (!bd.accountType || bd.accountType.trim() === "") errors.accountType = "Account Type is required";
    if (!bd.accountNumber.trim()) errors.accountNumber = "Account Number is required";


    // File validations (adapted to use 'data' instead of 'initialData')
    // Logic: If there's no newly selected file AND no existing file from 'data', then it's an error.
    if (!files.image && !data?.uploadedImage) { // Check data.uploadedImage (the URL/object from backend)
        errors.image = "A project image is required.";
    }

    if (files.pdfs.length === 0 && (!data?.uploadedPdfs || data.uploadedPdfs.length === 0)) {
        errors.pdfs = "At least one PDF file is required.";
    }

    if (!files.zipFile && (!data?.zipFile && !data?.uploadedZipFile)) { // Check both potential keys for zip file
        errors.zipFile = "A ZIP file is required.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0; // Return true if no errors
};

  const handleSubmit = async () => {
    if (!validateForm()) {
      setErrorMessage("Please fix the validation errors.");
      return;
    }
    setErrorMessage("");
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

    // Check if svvNetId is available before attempting to submit
    if (!svvNetId) {
      setUserMessage({ text: "Authentication error: User ID (svvNetId) not found. Please log in.", type: "error" });
      return;
    }
    const form = new FormData();
    form.append("svvNetId", svvNetId);
    form.append("organizingInstitute", formData.organizingInstitute);
    form.append("projectTitle", formData.projectTitle);
    form.append("students", JSON.stringify(formData.students));
    form.append("expenses", JSON.stringify(formData.expenses));
    form.append("bankDetails", JSON.stringify(formData.bankDetails));
  
    if (files.image) {
      // Change 'image' to 'uploadedImage' to match backend Multer
      form.append("uploadedImage", files.image);
    }

    // Append PDF files
    files.pdfs.forEach((pdfFile) => {
      // Change 'pdfFiles' to 'uploadedPdfs' to match backend Multer
      form.append("uploadedPdfs", pdfFile);
    });

    if (files.zipFile) {
      // Change 'zipFile' to 'uploadedZipFile' to match backend Multer
      form.append("uploadedZipFile", files.zipFile);
    }
  
    // The existing "document" field is removed as per new requirements
    // if (files.document) form.append("document", files.document);
  
    try {
      await axios.post("http://localhost:5000/api/ug3aform/submit", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      alert("Form submitted successfully!");
      // Optionally reset form state here
    } catch (err) {
      console.error("Submit error:", err);
      alert("Form submission failed.");
    }
  };
  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Under Graduate Form 3A - Project Competition</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Application Form</h2>
        
        {errorMessage && (
          <div className="bg-red-200 text-red-800 p-3 mb-4 rounded">{errorMessage}</div>
        )}

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
                  onChange={handleBankChange}
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
                  onChange={handleBankChange}
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
                  onChange={handleBankChange}
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
                  onChange={handleBankChange}
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
                  onChange={handleBankChange}
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

    {/* File Uploads Section */}
    <div className="mb-6 border p-4 rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2">File Uploads</h3>

        {/* Image Upload */}
        <div className="mb-4">
          <label htmlFor="image" className="block font-semibold mb-2">Upload Image (JPEG):</label>
          {viewOnly ? (
            // Corrected: Use optional chaining files.image?.url
            files.image?.url ? (
                <p className="p-2 border border-gray-300 rounded bg-gray-100">
                    <a href={files.image.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View Image: {files.image.name || 'Project Image'}
                    </a>
                </p>
            ) : <p className="p-2 border border-gray-300 rounded bg-gray-100 text-gray-500">No project image uploaded.</p>
          ) : (
            <>
              <input
                type="file"
                id="image"
                accept="image/jpeg"
                onChange={(e) => handleFileChange("image", e)}
                ref={imageInputRef}
                className="w-full p-2 border border-gray-300 rounded"
              />
              {/* Corrected: Use optional chaining files.image?.url */}
              {files.image?.url && (
                <div className="mt-2 flex items-center justify-between p-2 border rounded bg-blue-50">
                  <span>{files.image.name || 'Project Image'}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile('image')}
                    className="ml-4 text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              {validationErrors.image && <p className="text-red-500 text-sm mt-1">{validationErrors.image}</p>}
            </>
          )}
        </div>

        {/* PDF Files Upload (up to 5) */}
        <div className="mb-4">
          <label htmlFor="pdfs" className="block font-semibold mb-2">Upload Supporting PDFs (max 5 files):</label>
          {viewOnly ? (
            // files.pdfs is an array, so map will handle empty array gracefully.
            // pdf.url should be safe within the map if pdf objects are always valid.
            files.pdfs && files.pdfs.length > 0 ? (
                <div className="space-y-2 p-2 border border-gray-300 rounded bg-gray-100">
                    {files.pdfs.map((pdf, index) => (
                        <p key={index}>
                            {/* pdf.url is fine here because pdf objects are guaranteed by handlePdfsChange */}
                            <a href={pdf.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {pdf.name || `PDF ${index + 1}`}
                            </a>
                        </p>
                    ))}
                </div>
            ) : <p className="p-2 border border-gray-300 rounded bg-gray-100 text-gray-500">No PDF files uploaded.</p>
          ) : (
            <>
              <input
                type="file"
                id="pdfs"
                multiple
                accept="application/pdf"
                onChange={handlePdfsChange}
                ref={pdfsInputRef}
                className="w-full p-2 border border-gray-300 rounded"
              />
              {files.pdfs.length > 0 && (
                <div className="mt-2 space-y-2">
                  {files.pdfs.map((pdf, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded bg-blue-50">
                      <span>{pdf.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePdf(index)}
                        className="ml-4 text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {validationErrors.pdfs && <p className="text-red-500 text-sm mt-1">{validationErrors.pdfs}</p>}
            </>
          )}
        </div>

        {/* ZIP File Upload */}
        <div className="mb-4">
          <label htmlFor="zipFile" className="block font-semibold mb-2">Upload Remaining Documents (ZIP):</label>
          {viewOnly ? (
            // Corrected: Use optional chaining files.zipFile?.url
            files.zipFile?.url ? (
                <p className="p-2 border border-gray-300 rounded bg-gray-100">
                    <a href={files.zipFile.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View ZIP File: {files.zipFile.name || 'ZIP File'}
                    </a>
                </p>
            ) : <p className="p-2 border border-gray-300 rounded bg-gray-100 text-gray-500">No ZIP file uploaded.</p>
          ) : (
            <>
              <input
                type="file"
                id="zipFile"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(e) => handleFileChange("zipFile", e)}
                ref={zipFileInputRef}
                className="w-full p-2 border border-gray-300 rounded"
              />
              {/* Corrected: Use optional chaining files.zipFile?.url */}
              {files.zipFile?.url && (
                <div className="mt-2 flex items-center justify-between p-2 border rounded bg-blue-50">
                  <span>{files.zipFile.name || 'ZIP File'}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile('zipFile')}
                    className="ml-4 text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              {validationErrors.zipFile && <p className="text-red-500 text-sm mt-1">{validationErrors.zipFile}</p>}
            </>
          )}
        </div>
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