import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/UG2.css";

const UGForm2 = ({ viewOnly = false, data = null }) => {
  // Initialize currentUserRole from localStorage or default
  const getUserRoleFromLocalStorage = () => {
    try {
      const userString = localStorage.getItem("user");
      if (userString) {
        const user = JSON.parse(userString);
        return user.role || "student"; // Assuming 'role' field exists in user object
      }
    } catch (error) {
      console.error("Error parsing user data from localStorage:", error);
    }
    return "student"; // Default role if not found or error
  };

  const [currentUserRole, setCurrentUserRole] = useState(getUserRoleFromLocalStorage);
  const isStudent = currentUserRole === 'student'; // Helper derived state for clarity

  // Determine if core inputs should be disabled (based on UG_1.jsx logic)
  const disableCoreInputs = viewOnly || (isStudent && data && data.status !== 'pending');
  // Determine if file/signature controls should be disabled (based on UG_1.jsx logic)
  const disableFileControls = viewOnly;

  const initialState = {
    projectTitle: "",
    projectDescription: "",
    utility: "",
    receivedFinance: false,
    financeDetails: "",
    guideDetails: [{ name: "", employeeCode: "" }],
    students: Array(4).fill({ // Initialize with 4 empty student slots
      name: "",
      year: "",
      class: "",
      div: "",
      branch: "",
      rollNo: "",
      mobileNo: "",
    }),
    expenses: [{ category: "", amount: "", details: "" }], // At least one expense row
    totalBudget: "",
    groupLeaderSignature: null,
    guideSignature: null,
    uploadedFiles: [], // Array to hold local File objects or fetched file metadata
    status: "pending",
    errorMessage: "",
    errors: {},
  };

  // Refs for original fetched files/signatures to determine changes for backend cleanup
  const originalGroupLeaderSignatureRef = useRef(null);
  const originalGuideSignatureRef = useRef(null);
  const originalUploadedFilesRef = useRef([]); // Stores file metadata like { url, name, type }

  const getInitialFormData = (initialData) => {
    if (viewOnly && initialData) {
      return {
        ...initialState,
        projectTitle: initialData.projectTitle || "",
        projectDescription: initialData.projectDescription || "",
        utility: initialData.utility || "",
        receivedFinance: initialData.receivedFinance || false,
        financeDetails: initialData.financeDetails || "",
        guideDetails:
          Array.isArray(initialData.guideDetails) && initialData.guideDetails.length > 0
            ? initialData.guideDetails
            : [{ name: "", employeeCode: "" }],
        students: initialData.students && initialData.students.length > 0
            ? initialData.students
            : initialState.students, // Use initial 4 empty slots if no data
        expenses: initialData.expenses && initialData.expenses.length > 0
            ? initialData.expenses
            : [{ category: "", amount: "", details: "" }], // Use initial empty row if no data
        totalBudget: initialData.totalBudget || "",
        status: initialData.status || "pending",
        // Signatures and files will be fetched in useEffect based on IDs
        groupLeaderSignature: null,
        guideSignature: null,
        uploadedFiles: [],
        errors: {},
      };
    } else {
      return { ...initialState,
        students: Array(4).fill({ // Ensure 4 empty slots for new form too
          name: "", year: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "",
        }),
        expenses: [{ category: "", amount: "", details: "" }], // Ensure one empty expense row for new form
      };
    }
  };

  const [formData, setFormData] = useState(() => getInitialFormData(data));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userMessage, setUserMessage] = useState(null); // For success/error messages

  useEffect(() => {
    // Re-evaluate userRole if localStorage changes (though usually handled on page load)
    const handleStorageChange = () => {
      setCurrentUserRole(getUserRoleFromLocalStorage());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Effect to load data for viewOnly mode and fetch linked files/signatures
  useEffect(() => {
    const fetchViewOnlyData = async () => {
      if (viewOnly && data) {
        const initial = getInitialFormData(data);
        const updatedFormData = { ...initial };

        // Store original IDs for potential cleanup logic (if update functionality is added later)
        originalGroupLeaderSignatureRef.current = data.groupLeaderSignatureId || null;
        originalGuideSignatureRef.current = data.guideSignatureId || null;
        originalUploadedFilesRef.current = data.uploadedFilesIds || [];

        // Fetch Group Leader Signature
        if (data.groupLeaderSignatureId) {
          try {
            // Updated URL to match backend's /uploads/:fileId route
            const response = await axios.get(
              `http://localhost:5000/api/ug2form/uploads/${data.groupLeaderSignatureId}`,
              { responseType: "blob" }
            );
            const imageUrl = URL.createObjectURL(response.data);
            updatedFormData.groupLeaderSignature = {
              url: imageUrl,
              name: response.headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] || "groupLeaderSignature.jpeg",
              type: response.headers["content-type"],
            };
          } catch (error) {
            console.error("Error fetching group leader signature:", error);
            updatedFormData.groupLeaderSignature = null; // Clear if fetch fails
          }
        }

        // Fetch Guide Signature
        if (data.guideSignatureId) {
          try {
            // Updated URL to match backend's /uploads/:fileId route
            const response = await axios.get(
              `http://localhost:5000/api/ug2form/uploads/${data.guideSignatureId}`,
              { responseType: "blob" }
            );
            const imageUrl = URL.createObjectURL(response.data);
            updatedFormData.guideSignature = {
              url: imageUrl,
              name: response.headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] || "guideSignature.jpeg",
              type: response.headers["content-type"],
            };
          } catch (error) {
            console.error("Error fetching guide signature:", error);
            updatedFormData.guideSignature = null; // Clear if fetch fails
          }
        }

        // Fetch Uploaded Files
        if (Array.isArray(data.uploadedFilesIds) && data.uploadedFilesIds.length > 0) {
          const fetchedFiles = [];
          for (const fileId of data.uploadedFilesIds) {
            try {
              // Updated URL to match backend's /uploads/:fileId route
              const response = await axios.get(
                `http://localhost:5000/api/ug2form/uploads/${fileId}`,
                { responseType: "blob" }
              );
              const fileUrl = URL.createObjectURL(response.data);
              const filename = response.headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] || `file_${fileId}`;
              const contentType = response.headers["content-type"];

              fetchedFiles.push({
                url: fileUrl,
                name: filename,
                type: contentType || "application/octet-stream",
                size: response.data.size,
                id: fileId, // Keep ID for potential future update/delete logic
              });
            } catch (error) {
              console.error(`Error fetching file ${fileId}:`, error);
            }
          }
          updatedFormData.uploadedFiles = fetchedFiles;
        }

        setFormData(updatedFormData);
      } else if (!data) {
        // If data becomes null (e.g., navigating from view to new form), reset to initial state
        setFormData(getInitialFormData(null));
        originalGroupLeaderSignatureRef.current = null;
        originalGuideSignatureRef.current = null;
        originalUploadedFilesRef.current = [];
      }
    };

    fetchViewOnlyData();

    // Cleanup object URLs when component unmounts or data changes
    return () => {
      if (formData.groupLeaderSignature?.url) {
        URL.revokeObjectURL(formData.groupLeaderSignature.url);
      }
      if (formData.guideSignature?.url) {
        URL.revokeObjectURL(formData.guideSignature.url);
      }
      formData.uploadedFiles.forEach(file => {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      });
    };
  }, [data, viewOnly]);


  const handleBack = () => {
    window.history.back();
  };

  const validateForm = () => {
    const errors = {};
    const safeTrim = (str) => (typeof str === "string" ? str.trim() : "");

    if (!safeTrim(formData.projectTitle))
      errors.projectTitle = "Project title is required.";
    if (!safeTrim(formData.projectDescription))
      errors.projectDescription = "Project description is required.";
    if (!safeTrim(formData.utility))
      errors.utility = "Utility is required.";

    if (formData.receivedFinance && !safeTrim(formData.financeDetails)) {
      errors.financeDetails = "Finance details are required if finance received.";
    }
    if (!formData.guideDetails || formData.guideDetails.length === 0) {
      errors.guideDetails = "At least one guide is required.";
    } else {
      formData.guideDetails.forEach((guide, idx) => {
        const name = safeTrim(guide.name);
        const code = safeTrim(guide.employeeCode);
        if (name && !code) errors[`guideEmployeeCode_${idx}`] = "Employee code is required for named guide.";
        if (!name && code) errors[`guideName_${idx}`] = "Name is required for guide with employee code.";
        if (!name && !code && formData.guideDetails.length > 1) { // Only require if there's only one row and it's empty
           // If more than one guide row, empty ones are fine (they'll be filtered out)
        } else if (formData.guideDetails.length === 1 && (!name || !code)) {
            errors.guideDetails = "At least one complete guide entry (name and code) is required.";
        }
      });
    }
    // Filter out empty student rows for validation
    const filledStudents = formData.students.filter(
      (student) =>
        safeTrim(student.name) ||
        safeTrim(student.year) ||
        safeTrim(student.class) ||
        safeTrim(student.div) ||
        safeTrim(student.branch) ||
        safeTrim(student.rollNo) ||
        safeTrim(student.mobileNo)
    );

    if (filledStudents.length === 0) {
      errors.students = "At least one student's complete details must be filled.";
    } else {
      filledStudents.forEach((student, idx) => {
        const originalIndex = formData.students.indexOf(student); // Get original index for error message
        if (!safeTrim(student.name)) errors[`studentName_${originalIndex}`] = "Name is required.";
        if (!safeTrim(student.year)) errors[`studentYear_${originalIndex}`] = "Year is required.";
        if (!safeTrim(student.class)) errors[`studentClass_${originalIndex}`] = "Class is required.";
        if (!safeTrim(student.div)) errors[`studentDiv_${originalIndex}`] = "Div is required.";
        if (!safeTrim(student.branch)) errors[`studentBranch_${originalIndex}`] = "Branch is required.";
        if (!safeTrim(student.rollNo)) {
          errors[`studentRollNo_${originalIndex}`] = "Roll No. is required.";
        } else if (!/^\d{11}$/.test(safeTrim(student.rollNo))) {
          errors[`studentRollNo_${originalIndex}`] = "Roll No. must be 11 digits.";
        }
        const mobile = safeTrim(student.mobileNo);
        if (!mobile) {
          errors[`studentMobileNo_${originalIndex}`] = "Mobile No. is required.";
        } else if (!/^\d{10}$/.test(mobile)) {
          errors[`studentMobileNo_${originalIndex}`] = "Mobile No. must be 10 digits.";
        }
      });
    }

    // Filter out empty expense rows for validation
    const filledExpenses = formData.expenses.filter(
      (expense) => safeTrim(expense.category) || safeTrim(expense.amount.toString()) || safeTrim(expense.details)
    );

    if (filledExpenses.length === 0) {
        errors.expenses = "At least one expense entry is required.";
    } else {
        filledExpenses.forEach((expense, idx) => {
            const originalIndex = formData.expenses.indexOf(expense);
            if (!safeTrim(expense.category)) errors[`expenseCategory_${originalIndex}`] = "Category is required.";
            const amount = safeTrim(expense.amount.toString());
            if (!amount) {
                errors[`expenseAmount_${originalIndex}`] = "Amount is required.";
            } else if (isNaN(amount) || Number(amount) <= 0) {
                errors[`expenseAmount_${originalIndex}`] = "Amount must be a positive number.";
            }
        });
    }

    const totalBudget = safeTrim(formData.totalBudget.toString());
    if (!totalBudget) {
      errors.totalBudget = "Total budget is required.";
    } else if (isNaN(totalBudget) || Number(totalBudget) <= 0) {
      errors.totalBudget = "Total budget must be a positive number.";
    }

    // Apply validation for signatures and uploaded files only if editable
    if (!disableFileControls) { // Only validate if controls are enabled (not viewOnly)
      const isValidSignature = (sig) => {
        if (!sig) return false;
        if (sig instanceof File) {
          return sig.type.startsWith("image/") && sig.size <= 5 * 1024 * 1024; // 5MB limit for signatures
        }
        return !!sig.url; // If it has a URL, assume it's valid from backend
      };

      if (!isValidSignature(formData.groupLeaderSignature)) {
        errors.groupLeaderSignature = "Group leader signature (image, max 5MB) is required.";
      }
      if (!isValidSignature(formData.guideSignature)) {
        errors.guideSignature = "Guide signature (image, max 5MB) is required.";
      }

      const files = formData.uploadedFiles || [];
      const hasLocalFiles = files.some(f => f instanceof File);
      const hasFetchedFiles = files.some(f => f.url);

      if (!hasLocalFiles && !hasFetchedFiles) {
        errors.uploadedFiles = "At least one additional document is required (PDF or ZIP).";
      } else {
          // Check if there's a ZIP file selected or already uploaded
          const isZipPresent = files.some(f => (f instanceof File && (f.type === "application/zip" || f.name?.toLowerCase().endsWith(".zip"))) || (f.url && f.type === "application/zip"));

          if (isZipPresent) {
              if (files.length !== 1) {
                  errors.uploadedFiles = "If uploading a ZIP file, it must be the only document.";
              } else {
                  const zipFile = files[0];
                  if (zipFile instanceof File && zipFile.size > 25 * 1024 * 1024) {
                      errors.uploadedFiles = `ZIP file "${zipFile.name}" exceeds 25MB.`;
                  } else if (!zipFile.url && !(zipFile instanceof File)) {
                      errors.uploadedFiles = "Invalid ZIP file detected.";
                  }
              }
          } else { // No ZIP, must be PDFs
              if (files.length === 0) {
                  errors.uploadedFiles = "At least one PDF document is required.";
              } else if (files.length > 5) {
                  errors.uploadedFiles = "Maximum of 5 PDF files allowed.";
              } else {
                  files.forEach((file, idx) => {
                      if (file instanceof File) {
                          if (file.type !== "application/pdf") {
                              errors[`uploadedFile_${idx}`] = `File "${file.name}" must be a PDF.`;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                              errors[`uploadedFile_${idx}`] = `File "${file.name}" exceeds 5MB.`;
                          }
                      } else if (!file.url || file.type !== "application/pdf") {
                           errors[`uploadedFile_${idx}`] = `Invalid or non-PDF file detected: ${file.name}`;
                      }
                  });
              }
          }
      }
    }

    setFormData((prev) => ({ ...prev, errors }));
    if (Object.keys(errors).length > 0) {
      console.error("❌ Validation errors:", errors);
    }
    return Object.keys(errors).length === 0;
  };

  const removeUploadedFile = (index) => {
    if (disableFileControls) return; // Prevent removal if controls are disabled

    const updatedFiles = [...formData.uploadedFiles];
    if (updatedFiles[index] && updatedFiles[index].url) {
        URL.revokeObjectURL(updatedFiles[index].url); // Clean up object URL for fetched files
    }
    updatedFiles.splice(index, 1);

    setFormData((prev) => ({
      ...prev,
      uploadedFiles: updatedFiles,
      errors: { ...prev.errors, uploadedFiles: null }, // Clear general error on removal
    }));
  };

  const updateGuideField = (e, index, field) => {
    const value = e.target.value;
    setFormData((prev) => {
      const updatedGuides = [...prev.guideDetails];
      updatedGuides[index] = { ...updatedGuides[index], [field]: value };
      return {
        ...prev,
        guideDetails: updatedGuides,
        errors: {
          ...prev.errors,
          [`guide${field === "name" ? "Name" : "EmployeeCode"}_${index}`]: "",
          guideDetails: null, // Clear general guide error
        },
      };
    });
  };

  const addGuideRow = () => {
    setFormData((prev) => ({
      ...prev,
      guideDetails: [...prev.guideDetails, { name: "", employeeCode: "" }],
    }));
  };

  const removeGuideRow = (index) => {
    if (formData.guideDetails.length <= 1) {
        setUserMessage({ text: "At least one guide entry is required.", type: "error" });
        return;
    }
    setFormData((prev) => {
      const updatedGuides = [...prev.guideDetails];
      updatedGuides.splice(index, 1);
      const updatedErrors = { ...prev.errors };
      delete updatedErrors[`guideName_${index}`];
      delete updatedErrors[`guideEmployeeCode_${index}`];
      return {
        ...prev,
        guideDetails: updatedGuides,
        errors: updatedErrors,
      };
    });
    setUserMessage(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
      errors: { ...formData.errors, [name]: null }, // Clear specific error
    });
  };

  const updateStudentField = (e, index, field) => {
    const updatedStudents = [...formData.students];
    updatedStudents[index][field] = e.target.value;
    setFormData({ ...formData, students: updatedStudents,
      errors: { ...formData.errors, [`student${field}_${index}`]: null, students: null } // Clear specific & general error
    });
  };

  const removeStudentRow = (index) => {
    // Ensure there are always 4 student rows, even if empty
    if (formData.students.filter(s => Object.values(s).some(val => val !== "")).length <=1 && Object.values(formData.students[index]).every(val => val === "")) {
        setUserMessage({ text: "Cannot remove the last populated student entry if others are empty. Clear fields instead.", type: "error" });
        return;
    }

    const updatedStudents = [...formData.students];
    updatedStudents.splice(index, 1);
    setFormData({ ...formData, students: [...updatedStudents, {name: "", year: "", class: "", div: "", branch: "", rollNo: "", mobileNo: ""}], // Add an empty row back to maintain 4
        errors: { ...formData.errors, students: null }
    });
    setUserMessage(null);
  };

  const updateExpenseField = (e, index, field) => {
    const updatedExpenses = [...formData.expenses];
    const value = e.target.value;

    updatedExpenses[index][field] =
      field === "amount" ? value.replace(/[^0-9.]/g, "") : value;

    setFormData((prev) => ({
      ...prev,
      expenses: updatedExpenses,
      errors: { ...prev.errors, [`expense${field}_${index}`]: null, expenses: null },
    }));
  };

  const removeExpenseRow = (index) => {
    if (formData.expenses.length <= 1) {
        setUserMessage({ text: "At least one expense entry is required.", type: "error" });
        return;
    }
    const updatedExpenses = [...formData.expenses];
    updatedExpenses.splice(index, 1);
    setFormData({ ...formData, expenses: updatedExpenses, errors: { ...formData.errors, expenses: null } });
    setUserMessage(null);
  };

  const handleFileUpload = (e) => {
    if (disableFileControls) return; // Prevent upload if controls are disabled

    const selectedFiles = Array.from(e.target.files);
    const currentFiles = [...formData.uploadedFiles];
    setUserMessage(null);
    setFormData(prev => ({ ...prev, errors: { ...prev.errors, uploadedFiles: null } }));

    const newFiles = [];
    let error = "";
    let isNewZipSelected = false;

    for (const file of selectedFiles) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const isZip = file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip");

        if (!isPdf && !isZip) {
            error = "Only PDF and ZIP files are allowed.";
            break;
        }

        if (isZip) {
            // If a new ZIP is selected, it must be the only file selected in this action
            if (selectedFiles.length > 1 || currentFiles.length > 0) {
                error = "If uploading a ZIP file, it must be the only file. Please clear existing files and upload only the ZIP.";
                break;
            }
            if (file.size > 25 * 1024 * 1024) {
                error = `ZIP "${file.name}" exceeds 25MB.`;
                break;
            }
            isNewZipSelected = true;
            newFiles.push(file); // Only one ZIP can be added at a time
            break; // Stop processing further files if a valid ZIP is found
        }

        // If it's a PDF
        if (isPdf) {
            // If there's an existing ZIP, or a new ZIP was just selected, cannot add PDFs
            if (currentFiles.some(f => (f instanceof File && (f.type === "application/zip" || f.name?.toLowerCase().endsWith(".zip"))) || (f.url && f.type === "application/zip")) || isNewZipSelected) {
                error = "Cannot upload PDFs when a ZIP file is already present or selected.";
                break;
            }
            // Check for max 5 PDFs
            if (currentFiles.filter(f => (f instanceof File && f.type === "application/pdf") || (f.url && f.type === "application/pdf")).length + newFiles.length >= 5) {
                error = "Maximum of 5 PDF files allowed.";
                break;
            }
            if (file.size > 5 * 1024 * 1024) {
                error = `PDF "${file.name}" exceeds 5MB.`;
                break;
            }
            // Check for duplicates by name
            if (currentFiles.some(f => f.name === file.name) || newFiles.some(f => f.name === file.name)) {
                error = `File "${file.name}" is already selected.`;
                break;
            }
            newFiles.push(file);
        }
    }

    if (error) {
      setFormData((prev) => ({
        ...prev,
        errors: { ...prev.errors, uploadedFiles: error },
      }));
    } else {
        setFormData((prev) => ({
            ...prev,
            uploadedFiles: isNewZipSelected ? newFiles : [...currentFiles, ...newFiles],
            errors: { ...prev.errors, uploadedFiles: null },
        }));
    }
    e.target.value = null; // Clear the file input
  };


  const handleGroupLeaderSignatureUpload = (e) => {
    if (disableFileControls) return;
    const file = e.target.files[0];
    setUserMessage(null);
    if (file && file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024) {
      setFormData((prev) => ({
        ...prev,
        groupLeaderSignature: file,
        errors: { ...prev.errors, groupLeaderSignature: null },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        errors: {
          ...prev.errors,
          groupLeaderSignature: "Group leader signature must be an image file under 5MB.",
        },
      }));
    }
    e.target.value = null;
  };

  const handleGuideSignatureUpload = (e) => {
    if (disableFileControls) return;
    const file = e.target.files[0];
    setUserMessage(null);
    if (file && file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024) {
      setFormData((prev) => ({
        ...prev,
        guideSignature: file,
        errors: { ...prev.errors, guideSignature: null },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        errors: { ...prev.errors, guideSignature: "Guide signature must be an image file under 5MB." },
      }));
    }
    e.target.value = null;
  };

  const addStudentRow = () => {
    // Only add if existing rows are somewhat filled or if there are less than 4 populated rows
    const filledCount = formData.students.filter(s => Object.values(s).some(val => val !== "")).length;
    if (formData.students.length >= 8) { // Arbitrary max to prevent infinite rows
        setUserMessage({ text: "Maximum student entries reached.", type: "error" });
        return;
    }
    setFormData({
      ...formData,
      students: [
        ...formData.students,
        { name: "", year: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" },
      ],
    });
    setUserMessage(null);
  };

  const addExpenseRow = () => {
    setFormData({
      ...formData,
      expenses: [...formData.expenses, { category: "", amount: "", details: "" }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disableCoreInputs || isSubmitting) {
        setUserMessage({ text: "You do not have permission to submit/edit this form, or a submission is already in progress.", type: "error" });
        return;
    }

    setUserMessage(null); // Clear previous messages
    if (!validateForm()) {
      setUserMessage({ text: "Please correct the validation errors.", type: "error" });
      return;
    }

    let svvNetId = null;
    try {
      const userString = localStorage.getItem("user");
      if (userString) {
        const user = JSON.parse(userString);
        svvNetId = user.svvNetId;
      }
    } catch (err) {
      setUserMessage({ text: "User session corrupted. Please log in again.", type: "error" });
      return;
    }

    if (!svvNetId) {
      setUserMessage({ text: "Authentication error. svvNetId not found. Please log in.", type: "error" });
      return;
    }

    try {
      setIsSubmitting(true);

      // Filter out empty guide and student entries
      const filteredGuideDetails = formData.guideDetails.filter(g =>
        g.name.trim() && g.employeeCode.trim()
      ).map(g => ({ name: g.name.trim(), employeeCode: g.employeeCode.trim() }));

      const filteredStudents = formData.students.filter(s =>
        s.name.trim() || s.year.trim() || s.class.trim() || s.div.trim() || s.branch.trim() || s.rollNo.trim() || s.mobileNo.trim()
      ).map(s => ({ // Trim all string fields
          name: s.name.trim(),
          year: s.year.trim(),
          class: s.class.trim(),
          div: s.div.trim(),
          branch: s.branch.trim(),
          rollNo: s.rollNo.trim(),
          mobileNo: s.mobileNo.trim(),
      }));

      const filteredExpenses = formData.expenses.filter(exp =>
        exp.category.trim() || exp.amount.toString().trim() || exp.details.trim()
      ).map(exp => ({
          category: exp.category.trim(),
          amount: parseFloat(exp.amount) || 0,
          details: exp.details.trim(),
      }));

      // STEP 1: Submit base form data (using /save for new submission as no PUT for update is available)
      const formPayload = {
        svvNetId,
        projectTitle: formData.projectTitle.trim(),
        projectDescription: formData.projectDescription.trim(),
        utility: formData.utility.trim(),
        receivedFinance: formData.receivedFinance,
        financeDetails: formData.financeDetails.trim(),
        totalBudget: parseFloat(formData.totalBudget) || 0,
        status: formData.status,
        guideDetails: filteredGuideDetails,
        students: filteredStudents,
        expenses: filteredExpenses,
      };

      const saveRes = await axios.post(
        "http://localhost:5000/api/ug2form/save", // Matches backend route
        formPayload
      );

      if (!saveRes.data?.formId) {
        throw new Error("Form save failed or no form ID returned.");
      }

      const formId = saveRes.data.formId;
      console.log("✅ Form saved with ID:", formId);

      // STEP 2: Upload Files (PDFs/ZIP) - using common endpoint /upload-docs
      const uploadedFiles = formData.uploadedFiles.filter(f => f instanceof File); // Only new local files
      const pdfFiles = uploadedFiles.filter(f => f.type === "application/pdf");
      const zipFile = uploadedFiles.find(f => f.type === "application/zip" || f.name?.toLowerCase().endsWith(".zip"));

      if (zipFile) {
        const docFormData = new FormData();
        docFormData.append("zip", zipFile); // 'zip' must match backend field name
        await axios.post(
          `http://localhost:5000/api/ug2form/upload-docs/${formId}`,
          docFormData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        console.log("✅ ZIP file uploaded.");
      } else if (pdfFiles.length > 0) {
        const docFormData = new FormData();
        pdfFiles.forEach((file, index) => {
            docFormData.append(`pdf`, file); // 'pdf' must match backend field name for multiple PDFs
        });
        await axios.post(
          `http://localhost:5000/api/ug2form/upload-docs/${formId}`,
          docFormData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        console.log("✅ PDF files uploaded.");
      }


      // STEP 3: Upload signatures
      const uploadSignature = async (file, type) => {
        const sigForm = new FormData();
        sigForm.append("sig", file); // 'sig' must match backend field name
        await axios.post(
          `http://localhost:5000/api/ug2form/upload-signature/${formId}/${type}`, // Matches backend route
          sigForm,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      };

      if (formData.groupLeaderSignature instanceof File) {
        await uploadSignature(formData.groupLeaderSignature, "groupLeader");
        console.log("✅ Group Leader signature uploaded.");
      }

      if (formData.guideSignature instanceof File) {
        await uploadSignature(formData.guideSignature, "guide");
        console.log("✅ Guide signature uploaded.");
      }

      setUserMessage({ text: `✅ Form submitted successfully! Submission ID: ${formId}`, type: "success" });
      setFormData(getInitialFormData(null)); // Clear form on successful submission
    } catch (error) {
      console.error("❌ Submission error:", error.response?.data || error.message);
      setUserMessage({ text: error.response?.data?.message || "An error occurred during submission.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Under Graduate Form 2</h2>
      {data?._id && ( // Only show ID if data exists (view/edit mode)
        <p className="submission-id">Submission ID: {data._id}</p>
      )}
      <p className="form-category">Interdisciplinary Projects (FY to LY Students)</p>

      {userMessage && (
        <p className={`message ${userMessage.type}`}>{userMessage.text}</p>
      )}

      <form onSubmit={handleSubmit}>
        <label>Title of Proposed Project:</label>
        <input
          type="text"
          name="projectTitle"
          value={formData.projectTitle}
          disabled={disableCoreInputs}
          onChange={handleInputChange}
        />
        {formData.errors.projectTitle && (
          <p className="error-message">{formData.errors.projectTitle}</p>
        )}

        <label>Brief Description of Proposed Work:</label>
        <textarea
          name="projectDescription"
          disabled={disableCoreInputs}
          placeholder="Attach a separate sheet if required"
          value={formData.projectDescription}
          onChange={handleInputChange}
        />
        {formData.errors.projectDescription && (
          <p className="error-message">{formData.errors.projectDescription}</p>
        )}

        <label>Utility:</label>
        <input
          type="text"
          name="utility"
          disabled={disableCoreInputs}
          value={formData.utility}
          onChange={handleInputChange}
        />
        {formData.errors.utility && (
          <p className="error-message">{formData.errors.utility}</p>
        )}

        <label>Whether received finance from any other agency:</label>
        <div className="checkbox-group">
          <input
            type="radio"
            id="yes"
            name="receivedFinance"
            checked={formData.receivedFinance === true}
            onChange={() =>
              setFormData({
                ...formData,
                receivedFinance: true,
                errors: { ...formData.errors, financeDetails: null },
              })
            }
            disabled={disableCoreInputs}
          />
          <label htmlFor="yes">Yes</label>

          <input
            type="radio"
            id="no"
            name="receivedFinance"
            checked={formData.receivedFinance === false}
            onChange={() =>
              setFormData({
                ...formData,
                receivedFinance: false,
                errors: { ...formData.errors, financeDetails: null },
              })
            }
            disabled={disableCoreInputs}
          />
          <label htmlFor="no">No</label>
        </div>

        <label>Details if Yes:</label>
        <textarea
          name="financeDetails"
          disabled={disableCoreInputs || !formData.receivedFinance}
          value={formData.financeDetails}
          onChange={handleInputChange}
        />
        {formData.errors.financeDetails && (
          <p className="error-message">{formData.errors.financeDetails}</p>
        )}

        <div className="guide-table-wrapper">
          <table className="guide-table">
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Name of Guide/Co-Guide</th>
                <th>Employee Code</th>
                {!disableCoreInputs && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {formData.guideDetails.map((guide, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      type="text"
                      value={guide.name}
                      onChange={(e) => updateGuideField(e, index, "name")}
                      disabled={disableCoreInputs}
                    />
                    {formData.errors[`guideName_${index}`] && (
                      <p className="error-message">
                        {formData.errors[`guideName_${index}`]}
                      </p>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={guide.employeeCode}
                      onChange={(e) => updateGuideField(e, index, "employeeCode")}
                      disabled={disableCoreInputs}
                    />
                    {formData.errors[`guideEmployeeCode_${index}`] && (
                        <p className="error-message">
                          {formData.errors[`guideEmployeeCode_${index}`]}
                        </p>
                      )}
                  </td>
                  {!disableCoreInputs && (
                    <td>
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeGuideRow(index)}
                      >
                        ❌
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {formData.errors.guideDetails && (
            <p className="error-message">{formData.errors.guideDetails}</p>
          )}

          {!disableCoreInputs && (
            <button type="button" className="add-btn" onClick={addGuideRow}>
              ➕ Add More Guide
            </button>
          )}
        </div>

        <table className="student-table">
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Name of Student</th>
              <th>Year Of Study</th>
              <th>Class</th>
              <th>Div</th>
              <th>Branch</th>
              <th>Roll No.</th>
              <th>Mobile No.</th>
              {!disableCoreInputs && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {formData.students.map((student, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>
                  <input
                    type="text"
                    value={student.name}
                    onChange={(e) => updateStudentField(e, index, "name")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentName_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentName_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.year}
                    onChange={(e) => updateStudentField(e, index, "year")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentYear_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentYear_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.class}
                    onChange={(e) => updateStudentField(e, index, "class")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentClass_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentClass_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.div}
                    onChange={(e) => updateStudentField(e, index, "div")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentDiv_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentDiv_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.branch}
                    onChange={(e) => updateStudentField(e, index, "branch")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentBranch_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentBranch_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.rollNo}
                    onChange={(e) => updateStudentField(e, index, "rollNo")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentRollNo_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentRollNo_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.mobileNo}
                    onChange={(e) => updateStudentField(e, index, "mobileNo")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`studentMobileNo_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`studentMobileNo_${index}`]}
                    </p>
                  )}
                </td>
                {!disableCoreInputs && (
                  <td>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeStudentRow(index)}
                    >
                      ❌
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {formData.errors.students && (
          <p className="error-message">{formData.errors.students}</p>
        )}
        {!disableCoreInputs && (
          <button type="button" className="add-btn" onClick={addStudentRow}>
            ➕ Add More Student
          </button>
        )}

        <table className="budget-table">
          <thead>
            <tr>
              <th>Expense Category</th>
              <th>Amount</th>
              <th>Details</th>
              {!disableCoreInputs && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {formData.expenses.map((expense, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={expense.category}
                    onChange={(e) => updateExpenseField(e, index, "category")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`expenseCategory_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`expenseCategory_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={expense.amount}
                    onChange={(e) => updateExpenseField(e, index, "amount")}
                    disabled={disableCoreInputs}
                  />
                  {formData.errors[`expenseAmount_${index}`] && (
                    <p className="error-message">
                      {formData.errors[`expenseAmount_${index}`]}
                    </p>
                  )}
                </td>
                <td>
                  <textarea
                    value={expense.details}
                    onChange={(e) => updateExpenseField(e, index, "details")}
                    disabled={disableCoreInputs}
                  />
                </td>
                {!disableCoreInputs && (
                  <td>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeExpenseRow(index)}
                    >
                      ❌
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {formData.errors.expenses && (
            <p className="error-message">{formData.errors.expenses}</p>
        )}
        {!disableCoreInputs && (
          <button type="button" className="add-btn" onClick={addExpenseRow}>
            ➕ Add More Expense
          </button>
        )}

        <label>Total Budget (Including Contingency Amount):</label>
        <input
          type="text"
          disabled={disableCoreInputs}
          name="totalBudget"
          value={formData.totalBudget}
          onChange={handleInputChange}
        />
        {formData.errors.totalBudget && (
          <p className="error-message">{formData.errors.totalBudget}</p>
        )}

        {/* Signatures */}
        <div className="signatures">
          <div>
            <label>Signature of Group Leader (Image Only, Max 5MB)</label>
            {!disableFileControls && (
              <>
              <input
                type="file"
                accept="image/*"
                name="groupLeaderSignature"
                onChange={handleGroupLeaderSignatureUpload}
                disabled={disableFileControls}
              />
              </>
            )}
            {formData.groupLeaderSignature?.url ? (
              <img
                src={formData.groupLeaderSignature.url}
                alt="Group Leader Signature"
                className="signature-display"
              />
            ) : formData.groupLeaderSignature instanceof File ? (
              <p className="file-name">Selected: {formData.groupLeaderSignature.name}</p>
            ) : (data?.groupLeaderSignatureId && <p>No Group Leader Signature uploaded.</p>)} {/* Show message if ID exists but fetch failed or new form */}
            {formData.errors.groupLeaderSignature && (
              <p className="error-message">
                {formData.errors.groupLeaderSignature}
              </p>
            )}
          </div>

          <div>
            <label>Signature of Guide (Image Only, Max 5MB)</label>
            {!disableFileControls && (
              <input
                type="file"
                accept="image/*"
                name="guideSignature"
                onChange={handleGuideSignatureUpload}
                disabled={disableFileControls}
              />
            )}
            {formData.guideSignature?.url ? (
              <img
                src={formData.guideSignature.url}
                alt="Guide Signature"
                className="signature-display"
              />
            ) : formData.guideSignature instanceof File ? (
              <p className="file-name">Selected: {formData.guideSignature.name}</p>
            ) : (data?.guideSignatureId && <p>No Guide Signature uploaded.</p>)} {/* Show message if ID exists but fetch failed or new form */}
            {formData.errors.guideSignature && (
              <p className="error-message">{formData.errors.guideSignature}</p>
            )}
          </div>
        </div>

        <label>
          Upload Additional Documents (Max 5 PDF files, 5MB each OR one ZIP file
          up to 25MB):
        </label>
        {!disableFileControls && (
          <input
            type="file"
            accept=".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed"
            multiple
            name="uploadedFiles"
            onChange={handleFileUpload}
            disabled={disableFileControls}
          />
        )}
        {formData.uploadedFiles.length > 0 ? (
          <div className="uploaded-files-list">
            <h4>Uploaded Files:</h4>
            <ul>
              {formData.uploadedFiles.map((file, index) => {
                const fileName = file.name || "Unnamed";
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

                return (
                  <li key={index}>
                    {file.url ? ( // Display fetched file with link
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {fileName} ({file.type}, {fileSizeMB} MB)
                      </a>
                    ) : ( // Display local file name
                      <>
                        <span>{fileName} ({fileSizeMB} MB)</span>
                        {!disableFileControls && (
                          <button
                            type="button"
                            className="remove-file-btn"
                            onClick={() => removeUploadedFile(index)}
                          >
                            ❌
                          </button>
                        )}
                      </>
                    )}

                    {formData.errors[`uploadedFile_${index}`] && (
                      <p className="error-message">
                        {formData.errors[`uploadedFile_${index}`]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
            !disableFileControls ? <p>No documents selected yet.</p> : <p>No documents uploaded for this form.</p>
        )}

        {formData.errors.uploadedFiles && (
          <p className="error-message">{formData.errors.uploadedFiles}</p>
        )}
        <button type="button" className="back-btn" onClick={handleBack}>
          Back
        </button>
        {!viewOnly && ( // Only show submit button if not in viewOnly mode
          <button type="submit" disabled={isSubmitting || disableCoreInputs} className="submit-btn">
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        )}
      </form>
    </div>
  );
};

export default UGForm2;