import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/UG2.css";

const UGForm2 = ({ viewOnly = false, data = null }) => {
  const initialState = {
    projectTitle: "",
    projectDescription: "",
    utility: "",
    receivedFinance: false,
    financeDetails: "",
    guideDetails: [{ name: "", employeeCode: "" }],
    students: [],
    expenses: [],
    totalBudget: "",
    groupLeaderSignature: null, // Stored as File object
    guideSignature: null,       // Stored as File object
    uploadedFiles: [],          // Stored as array of File objects
    status: "pending",
    errorMessage: "",
    errors: {},
  };

  const getInitialFormData = () => {
    if (viewOnly && data) {
      return {
        ...initialState,
        projectTitle: data.projectTitle || "",
        projectDescription: data.projectDescription || "",
        utility: data.utility || "",
        receivedFinance: data.receivedFinance || false,
        financeDetails: data.financeDetails || "",
        guideDetails:
          Array.isArray(data.guideDetails) && data.guideDetails.length > 0
            ? data.guideDetails
            : [{ name: "", employeeCode: "" }],
        students: data.students || [],
        expenses: data.expenses || [],
        totalBudget: data.totalBudget || "",
        // For viewOnly, these will likely come as URLs or IDs, not File objects
        groupLeaderSignature: data.groupLeaderSignatureId ? { url: `http://localhost:5000/api/ug2form/uploads/${data.groupLeaderSignatureId}` } : null,
        guideSignature: data.guideSignatureId ? { url: `http://localhost:5000/api/ug2form/uploads/${data.guideSignatureId}` } : null,
        uploadedFiles: (data.uploadedFilesIds || []).map(fileId => ({
          url: `http://localhost:5000/api/ug2form/uploads/${fileId}`,
          originalName: fileId, // You might want to fetch original name from metadata if available
        })),
        status: data.status || "pending",
      };
    } else {
      return initialState;
    }
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [userRole, setUserRole] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userMessage, setUserMessage] = useState(null);

  useEffect(() => {
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        setUserRole(user.role.toLowerCase().trim());
      } catch (err) {
        console.error("Failed to parse user data from local storage:", err);
      }
    }

    if (viewOnly && data) {
      setFormData(getInitialFormData());
    }
  }, [data, viewOnly]);

  const handleBack = () => {
    window.history.back();
  };

  const validateForm = () => {
    const errors = {};

    if (!(formData.projectTitle || "").trim())
      errors.projectTitle = "Project title is required.";
    if (!(formData.projectDescription || "").trim())
      errors.projectDescription = "Project description is required.";
    if (!(formData.utility || "").trim())
      errors.utility = "Utility is required.";

    if (formData.receivedFinance && !(formData.financeDetails || "").trim()) {
      errors.financeDetails = "Finance details are required if finance received.";
    }
    if (!formData.guideDetails || formData.guideDetails.length === 0) {
      errors.guideDetails = "At least one guide is required.";
    } else {
      formData.guideDetails.forEach((guide, idx) => {
        if (!(guide.name || "").trim())
          errors[`guideName_${idx}`] = "Guide name is required.";
        if (!(guide.employeeCode || "").trim())
          errors[`guideEmployeeCode_${idx}`] = "Employee code is required.";
      });
    }

    if (!formData.students || formData.students.length === 0) {
      errors.students = "At least one student is required.";
    } else {
      formData.students.forEach((student, idx) => {
        if (!(student.name || "").trim())
          errors[`studentName_${idx}`] = "Student name is required.";
        if (!(student.year || "").trim())
          errors[`studentYear_${idx}`] = "Year is required.";
        if (!(student.class || "").trim())
          errors[`studentClass_${idx}`] = "Class is required.";
        if (!(student.div || "").trim())
          errors[`studentDiv_${idx}`] = "Div is required.";
        if (!(student.branch || "").trim())
          errors[`studentBranch_${idx}`] = "Branch is required.";
        if (!(student.rollNo || "").trim())
          errors[`studentRollNo_${idx}`] = "Roll No. is required.";

        const mobile = (student.mobileNo || "").trim();
        if (!mobile) {
          errors[`studentMobileNo_${idx}`] = "Mobile No. is required.";
        } else if (!/^\d{10}$/.test(mobile)) {
          errors[`studentMobileNo_${idx}`] = "Mobile No. must be 10 digits.";
        }
      });
    }

    (formData.expenses || []).forEach((expense, idx) => {
      if (!(expense.category || "").trim())
        errors[`expenseCategory_${idx}`] = "Category is required.";
      const amount = (expense.amount || "").toString().trim();
      if (!amount) {
        errors[`expenseAmount_${idx}`] = "Amount is required.";
      } else if (isNaN(amount) || Number(amount) <= 0) {
        errors[`expenseAmount_${idx}`] = "Amount must be a positive number.";
      }
    });

    const totalBudget = (formData.totalBudget || "").toString().trim();
    if (!totalBudget) {
      errors.totalBudget = "Total budget is required.";
    } else if (isNaN(totalBudget) || Number(totalBudget) <= 0) {
      errors.totalBudget = "Total budget must be a positive number.";
    }

    // Validation for signatures and uploaded files only if not in viewOnly mode and user role is 'student'
    if (!viewOnly && userRole === 'student') {
      const isValidSignature = (sig) => {
        if (!sig) return false;
        return sig instanceof File && sig.type.startsWith("image/") && sig.size <= 5 * 1024 * 1024;
      };

      if (!isValidSignature(formData.groupLeaderSignature)) {
        errors.groupLeaderSignature = "Group leader signature must be a JPEG/PNG under 5MB.";
      }

      if (!isValidSignature(formData.guideSignature)) {
        errors.guideSignature = "Guide signature must be a JPEG/PNG under 5MB.";
      }

      const files = formData.uploadedFiles || [];
      const pdfFiles = files.filter(f => f instanceof File && f.type === "application/pdf");
      const zipFile = files.find(f => f instanceof File && (f.type.includes("zip") || f.name?.toLowerCase().endsWith(".zip")));

      if (files.length === 0) {
        errors.uploadedFiles = "At least one additional document is required (PDF or ZIP).";
      } else if (pdfFiles.length > 5) {
        errors.uploadedFiles = "Maximum of 5 PDF files allowed.";
      } else if (zipFile && files.length > 1) {
          // If a ZIP is present, and there are other files (Pdfs), it's invalid unless it's just the ZIP.
          // This handles cases like [zip, pdf1], [pdf1, zip]
          if(files.length > 1 || pdfFiles.length > 0) {
            errors.uploadedFiles = "If a ZIP file is uploaded, no other files (PDFs) are allowed.";
          }
      } else if (zipFile && zipFile.size > 25 * 1024 * 1024) {
        errors.uploadedFiles = `ZIP file "${zipFile.name}" exceeds 25MB.`;
      } else {
        // Validate individual PDFs if no ZIP is present or only ZIP is present and valid
        for (const file of pdfFiles) {
          if (file.size > 5 * 1024 * 1024) {
            errors.uploadedFiles = `PDF "${file.name}" exceeds 5MB.`;
            break;
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
    const updated = [...formData.uploadedFiles];
    updated.splice(index, 1);

    setFormData((prev) => ({
      ...prev,
      uploadedFiles: updated,
      errors: {
        ...prev.errors,
        uploadedFiles: undefined, // Clear general file error on removal
      }
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
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
      errors: { ...formData.errors, [name]: null },
    });
  };

  const updateStudentField = (e, index, field) => {
    const updatedStudents = [...formData.students];
    updatedStudents[index][field] = e.target.value;
    setFormData({ ...formData, students: updatedStudents });
  };

  const removeStudentRow = (index) => {
    const updatedStudents = [...formData.students];
    updatedStudents.splice(index, 1);
    setFormData({ ...formData, students: updatedStudents });
  };

  const updateExpenseField = (e, index, field) => {
    const updatedExpenses = [...formData.expenses];
    const value = e.target.value;
    updatedExpenses[index][field] = field === "amount" ? value.replace(/[^0-9.]/g, "") : value.trim();
    setFormData((prev) => ({
      ...prev,
      expenses: updatedExpenses,
    }));
  };

  const removeExpenseRow = (index) => {
    const updatedExpenses = [...formData.expenses];
    updatedExpenses.splice(index, 1);
    setFormData({ ...formData, expenses: updatedExpenses });
  };

  const handleFileUpload = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFormData(prev => {
      const newFiles = [...prev.uploadedFiles];
      let error = "";

      for (const file of selectedFiles) {
        const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
        const isZip = file.type === "application/zip" || file.name?.toLowerCase().endsWith(".zip");

        if (!isPdf && !isZip) {
          error = "Only PDF and ZIP files are allowed.";
          break;
        }

        if (isZip) {
          // If a ZIP is being uploaded, clear existing files and add only the ZIP
          newFiles.splice(0, newFiles.length, file); // Replace all files with this ZIP
          if (file.size > 25 * 1024 * 1024) {
             error = `ZIP "${file.name}" exceeds 25MB.`;
          }
          break; // Only one ZIP is allowed, and it replaces others
        } else if (isPdf) {
          // If PDF, check current count and add
          const currentPdfs = newFiles.filter(f => f instanceof File && (f.type === "application/pdf" || f.name?.toLowerCase().endsWith(".pdf"))).length;
          const currentZips = newFiles.filter(f => f instanceof File && (f.type.includes("zip") || f.name?.toLowerCase().endsWith(".zip"))).length;

          if(currentZips > 0) { // If there's already a ZIP, no PDFs allowed
              error = "Cannot upload PDFs when a ZIP file is already present.";
              break;
          }
          if (currentPdfs >= 5) {
            error = "Maximum of 5 PDF files allowed.";
            break;
          }
          if (file.size > 5 * 1024 * 1024) {
            error = `PDF "${file.name}" exceeds 5MB.`;
            break;
          }
          newFiles.push(file);
        }
      }

      if (error) {
        return {
          ...prev,
          errors: {
            ...prev.errors,
            uploadedFiles: error,
          },
        };
      }

      return {
        ...prev,
        uploadedFiles: newFiles,
        errors: {
          ...prev.errors,
          uploadedFiles: undefined,
        },
      };
    });
  };

  const handleSignatureUpload = (e, signatureType) => {
    const file = e.target.files[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) { // Allow PNG too
      setFormData((prev) => ({
        ...prev,
        [signatureType]: file,
        errors: { ...prev.errors, [signatureType]: null },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        errors: { ...prev.errors, [signatureType]: "Only JPEG or PNG image files are allowed." },
      }));
    }
  };

  const addStudentRow = () => {
    setFormData({
      ...formData,
      students: [
        ...formData.students,
        { name: "", year: "", class: "", div: "", branch: "", rollNo: "", mobileNo: "" },
      ],
    });
  };

  const addExpenseRow = () => {
    setFormData({
      ...formData,
      expenses: [...formData.expenses, { category: "", amount: "", details: "" }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🔍 Submit clicked");

    if (!validateForm()) {
      console.log("❌ Validation failed");
      return;
    }

    let svvNetId = null;
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        svvNetId = user.svvNetId;
        setUserRole(user.role);
      } catch (err) {
        setUserMessage({ text: "User session corrupted. Please log in.", type: "error" });
        return;
      }
    }

    if (!svvNetId) {
      setUserMessage({ text: "Authentication error. Please log in.", type: "error" });
      return;
    }

    // Restrict submission if not a student and not in viewOnly mode
    if (userRole !== 'student' && !viewOnly) {
      setUserMessage({ text: "You do not have permission to submit this form.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setUserMessage(null); // Clear previous messages

    try {
      const dataToSend = new FormData();
      dataToSend.append("svvNetId", svvNetId);
      dataToSend.append("projectTitle", formData.projectTitle?.trim() || "");
      dataToSend.append("projectDescription", formData.projectDescription?.trim() || "");
      dataToSend.append("utility", formData.utility?.trim() || "");
      dataToSend.append("receivedFinance", formData.receivedFinance);
      if (formData.receivedFinance) {
        dataToSend.append("financeDetails", formData.financeDetails?.trim() || "");
      }
      dataToSend.append("totalBudget", formData.totalBudget);

      // Stringify complex arrays/objects before appending to FormData
      dataToSend.append("guideDetails", JSON.stringify(
        formData.guideDetails
          .filter(g => g.name?.trim() && g.employeeCode?.trim())
          .map(g => ({
            name: g.name.trim(),
            employeeCode: g.employeeCode.trim(),
          }))
      ));
      dataToSend.append("students", JSON.stringify(formData.students));
      dataToSend.append("expenses", JSON.stringify(
        formData.expenses
          .filter(exp => exp.category?.trim())
          .map(exp => ({
            category: exp.category.trim(),
            amount: parseFloat(exp.amount) || 0,
            details: exp.details?.trim() || "",
          }))
      ));

      // Append files if they are File objects
      if (formData.groupLeaderSignature instanceof File) {
        dataToSend.append("groupLeaderSignature", formData.groupLeaderSignature);
      }
      if (formData.guideSignature instanceof File) {
        dataToSend.append("guideSignature", formData.guideSignature);
      }
      formData.uploadedFiles.forEach((file, index) => {
        if (file instanceof File) {
          dataToSend.append(`uploadedFiles`, file); // Append each file with the same field name
        }
      });

      // Status can be set on backend, or passed from frontend if needed
      // dataToSend.append("status", formData.status?.trim() || "pending");

      const saveRes = await axios.post(
        "http://localhost:5000/api/ug2form/saveFormData",
        dataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data", // Axois usually sets this, but explicit is fine
          },
        }
      );

      if (!saveRes.data?.id) {
        throw new Error("Form save failed or no form ID returned.");
      }

      const formId = saveRes.data.id; // Backend returns 'id', not 'formId' now
      console.log("✅ Form saved with ID:", formId);

      setUserMessage({ text: `✅ Form submitted successfully!\nSubmission ID: ${formId}`, type: "success" });
      setFormData(initialState); // Clear form
    } catch (error) {
      console.error("❌ Submission error:", error);
      const errorMessage = error.response?.data?.message || "An error occurred during submission.";
      setUserMessage({ text: `❌ ${errorMessage}`, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Under Graduate Form 2</h2>
      {viewOnly && data && data.id && <p className="submission-id">Submission ID: {data.id}</p>}
      <p className="form-category">Interdisciplinary Projects (FY to LY Students)</p>
      {userMessage && (
        <p className={`user-message ${userMessage.type === "error" ? "error" : "success"}`}>
          {userMessage.text}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <label>Title of Proposed Project:</label>
        <input
          type="text"
          name="projectTitle"
          value={formData.projectTitle}
          disabled={viewOnly || userRole !== 'student'}
          onChange={handleInputChange}
        />
        {formData.errors.projectTitle && <p className="error-message">{formData.errors.projectTitle}</p>}

        <label>Brief Description of Proposed Work:</label>
        <textarea
          name="projectDescription"
          disabled={viewOnly || userRole !== 'student'}
          placeholder="Attach a separate sheet if required"
          value={formData.projectDescription}
          onChange={handleInputChange}
        />
        {formData.errors.projectDescription && <p className="error-message">{formData.errors.projectDescription}</p>}

        <label>Utility:</label>
        <input
          type="text"
          name="utility"
          disabled={viewOnly || userRole !== 'student'}
          value={formData.utility}
          onChange={handleInputChange}
        />
        {formData.errors.utility && <p className="error-message">{formData.errors.utility}</p>}

        <label>Whether received finance from any other agency:</label>
        <div className="checkbox-group">
          <input
            type="radio"
            id="yes"
            name="receivedFinance"
            checked={formData.receivedFinance === true}
            onChange={() => setFormData({ ...formData, receivedFinance: true, errors: { ...formData.errors, financeDetails: null } })}
            disabled={viewOnly || userRole !== 'student'}
          />
          <label htmlFor="yes">Yes</label>

          <input
            type="radio"
            id="no"
            name="receivedFinance"
            checked={formData.receivedFinance === false}
            onChange={() => setFormData({ ...formData, receivedFinance: false, errors: { ...formData.errors, financeDetails: null } })}
            disabled={viewOnly || userRole !== 'student'}
          />
          <label htmlFor="no">No</label>
        </div>

        <label>Details if Yes:</label>
        <textarea
          name="financeDetails"
          disabled={viewOnly || !formData.receivedFinance || userRole !== 'student'}
          value={formData.financeDetails}
          onChange={handleInputChange}
        />
        {formData.errors.financeDetails && <p className="error-message">{formData.errors.financeDetails}</p>}

        <div className="guide-table-wrapper">
          <table className="guide-table">
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Name of Guide/Co-Guide</th>
                <th>Employee Code</th>
                {(!viewOnly && userRole === 'student') && <th>Action</th>}
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
                      disabled={viewOnly || userRole !== 'student'}
                    />
                    {(!viewOnly && userRole === 'student') && formData.errors[`guideName_${index}`] && (
                      <p className="error-message">{formData.errors[`guideName_${index}`]}</p>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={guide.employeeCode}
                      onChange={(e) => updateGuideField(e, index, "employeeCode")}
                      disabled={viewOnly || userRole !== 'student'}
                    />
                    {(!viewOnly && userRole === 'student') && formData.errors[`guideEmployeeCode_${index}`] && (
                      <p className="error-message">{formData.errors[`guideEmployeeCode_${index}`]}</p>
                    )}
                  </td>
                  {(!viewOnly && userRole === 'student') && (
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

          {(!viewOnly && userRole === 'student') && (
            <button
              type="button"
              className="add-btn"
              onClick={addGuideRow}
            >
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
              {(!viewOnly && userRole === 'student') && <th>Action</th>}
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
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentName_${index}`] && (
                    <p className="error-message">{formData.errors[`studentName_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.year}
                    onChange={(e) => updateStudentField(e, index, "year")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentYear_${index}`] && (
                    <p className="error-message">{formData.errors[`studentYear_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.class}
                    onChange={(e) => updateStudentField(e, index, "class")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentClass_${index}`] && (
                    <p className="error-message">{formData.errors[`studentClass_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.div}
                    onChange={(e) => updateStudentField(e, index, "div")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentDiv_${index}`] && (
                    <p className="error-message">{formData.errors[`studentDiv_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.branch}
                    onChange={(e) => updateStudentField(e, index, "branch")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentBranch_${index}`] && (
                    <p className="error-message">{formData.errors[`studentBranch_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.rollNo}
                    onChange={(e) => updateStudentField(e, index, "rollNo")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentRollNo_${index}`] && (
                    <p className="error-message">{formData.errors[`studentRollNo_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={student.mobileNo}
                    onChange={(e) => updateStudentField(e, index, "mobileNo")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`studentMobileNo_${index}`] && (
                    <p className="error-message">{formData.errors[`studentMobileNo_${index}`]}</p>
                  )}
                </td>
                {(!viewOnly && userRole === 'student') && (
                    <td>
                        <button type="button" className="remove-btn" onClick={() => removeStudentRow(index)}>
                        ❌
                        </button>
                    </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {formData.errors.students && <p className="error-message">{formData.errors.students}</p>}
        {(!viewOnly && userRole === 'student') && (
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
              {(!viewOnly && userRole === 'student') && <th>Action</th>}
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
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`expenseCategory_${index}`] && (
                    <p className="error-message">{formData.errors[`expenseCategory_${index}`]}</p>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    value={expense.amount}
                    onChange={(e) => updateExpenseField(e, index, "amount")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                  {(!viewOnly && userRole === 'student') && formData.errors[`expenseAmount_${index}`] && (
                    <p className="error-message">{formData.errors[`expenseAmount_${index}`]}</p>
                  )}
                </td>
                <td>
                  <textarea
                    value={expense.details}
                    onChange={(e) => updateExpenseField(e, index, "details")}
                    disabled={viewOnly || userRole !== 'student'}
                  />
                </td>
                {(!viewOnly && userRole === 'student') && (
                    <td>
                        <button type="button" className="remove-btn" onClick={() => removeExpenseRow(index)}>
                        ❌
                        </button>
                    </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {(!viewOnly && userRole === 'student') && (
          <button type="button" className="add-btn" onClick={addExpenseRow}>
            ➕ Add More Expense
          </button>
        )}

        <label>Total Budget (Including Contingency Amount):</label>
        <input
          type="text"
          disabled={viewOnly || userRole !== 'student'}
          name="totalBudget"
          value={formData.totalBudget}
          onChange={handleInputChange}
        />
        {formData.errors.totalBudget && <p className="error-message">{formData.errors.totalBudget}</p>}

        {/* Signatures */}
        <div className="signatures">
          <div>
            <label>Signature of Group Leader (JPEG/PNG Only)</label>
            {(!viewOnly && userRole === 'student') && (
              <input
                type="file"
                accept=".jpeg,.jpg,.png,image/jpeg,image/png"
                name="groupLeaderSignature"
                onChange={(e) => handleSignatureUpload(e, "groupLeaderSignature")}
                disabled={viewOnly || userRole !== 'student'}
              />
            )}
            {/* MODIFIED CONDITION HERE for Group Leader Signature */}
            {(viewOnly && userRole !== 'student') && formData.groupLeaderSignature?.url ? (
              <a
                href={formData.groupLeaderSignature.url}
                target="_blank"
                rel="noopener noreferrer"
                className="signature-link"
              >
                View Group Leader Signature
              </a>
            ) : formData.groupLeaderSignature instanceof File ? (
              <p className="file-name">{formData.groupLeaderSignature.name}</p>
            ) : null}
            {(!viewOnly && userRole === 'student') && formData.errors.groupLeaderSignature && (
              <p className="error-message">{formData.errors.groupLeaderSignature}</p>
            )}
          </div>

          <div>
            <label>Signature of Guide (JPEG/PNG Only)</label>
            {(!viewOnly && userRole === 'student') && (
              <input
                type="file"
                accept=".jpeg,.jpg,.png,image/jpeg,image/png"
                name="guideSignature"
                onChange={(e) => handleSignatureUpload(e, "guideSignature")}
                disabled={viewOnly || userRole !== 'student'}
              />
            )}
            {/* MODIFIED CONDITION HERE for Guide Signature */}
            {(viewOnly && userRole !== 'student') && formData.guideSignature?.url ? (
              <a
                href={formData.guideSignature.url}
                target="_blank"
                rel="noopener noreferrer"
                className="signature-link"
              >
                View Guide Signature
              </a>
            ) : formData.guideSignature instanceof File ? (
              <p className="file-name">{formData.guideSignature.name}</p>
            ) : null}
            {(!viewOnly && userRole === 'student') && formData.errors.guideSignature && (
              <p className="error-message">{formData.errors.guideSignature}</p>
            )}
          </div>
        </div>

        <label>
          Upload Additional Documents (Max 5 PDF files, 5MB each OR one ZIP file up to 25MB):
        </label>
        {(!viewOnly && userRole === 'student') && (
          <input
            type="file"
            accept=".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed"
            multiple
            name="uploadedFiles"
            onChange={handleFileUpload}
            disabled={viewOnly || userRole !== 'student'}
          />
        )}
        {formData.uploadedFiles.length > 0 && (
          <div className="uploaded-files-list">
            <h4>Uploaded Files:</h4>
            <ul>
              {formData.uploadedFiles.map((file, index) => {
                const fileName = file.name || file.originalName || `File ${index + 1}`;
                const fileSize = file instanceof File ? file.size : 0;
                const fileSizeMB = fileSize > 0 ? (fileSize / (1024 * 1024)).toFixed(2) : "N/A";

                return (
                  <li key={index}>
                    {/* MODIFIED CONDITION HERE for Uploaded Files */}
                    {(viewOnly && userRole !== 'student') && file.url ? (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {fileName} ({fileSizeMB} MB)
                      </a>
                    ) : (
                      <>
                        {fileName} ({fileSizeMB} MB)
                        {(!viewOnly && userRole === 'student') && (
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

                    {(!viewOnly && userRole !== 'student') && formData.errors[`uploadedFile_${index}`] && (
                      <p className="error-message">
                        {formData.errors[`uploadedFile_${index}`]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* General error for uploadedFiles (e.g., if more than 5 files are not a single zip) */}
        {(!viewOnly && userRole === 'student') && formData.errors.uploadedFiles && <p className="error-message">{formData.errors.uploadedFiles}</p>}
        <button type="button" className="back-btn" onClick={handleBack} disabled={isSubmitting}>Back</button>
        {(!viewOnly && userRole === 'student') && (
          <button type="submit" disabled={isSubmitting} className="submit-btn">
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        )}
      </form>
    </div>
  );
};

export default UGForm2;