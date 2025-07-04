import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "../styles/UG1.css"; // Removed this import due to compilation error
import JSZip from "jszip";

// FilePreview Component (moved inside the same file for simplicity, or can be a separate file)
const FilePreview = ({ fileList, onRemove, fieldName, viewOnly, isStudent }) => {

  console.log(`FilePreview for ${fieldName}:`, { fileList, viewOnly, isStudent });
  if (fieldName === 'uploadedFiles' && viewOnly && isStudent) {
    return null; // Completely hide the section for students in viewOnly mode for additional documents
  }

  // Determine if we should show the remove button
  const showRemoveButton = !viewOnly;

  // Filter out files that shouldn't be displayed (e.g., null, undefined, or empty objects)
  const filteredFiles = fileList.filter(fileInfo => {
    // Ensure fileInfo exists and has at least one of the expected properties for a file
    return fileInfo && (fileInfo.url || fileInfo.fileId || fileInfo.id || (fileInfo.file instanceof File));
  });

  if (filteredFiles.length === 0) {
    // Customize this message based on the fieldName if needed
    // For uploadedFiles, give a specific message if no files are selected/uploaded
    if (fieldName === 'uploadedFiles') {
      return <p className="text-gray-500 text-sm italic mt-1">{viewOnly ? "No supporting documents uploaded." : "No documents selected yet."}</p>;
    }
    return <p className="text-gray-500 text-sm italic mt-1">No file selected.</p>;
  }

  return (
    <ul className="mt-2 list-disc list-inside space-y-1">
      {filteredFiles.map((fileInfo, index) => {
        const isUploadedFile = !!(fileInfo.url || fileInfo.fileId || fileInfo.id);
        const displayUrl = fileInfo.url ||
                           (fileInfo.fileId ? `/api/ug1form/file/${fileInfo.fileId}` : null) ||
                           (fileInfo.id ? `/api/ug1form/file/${fileInfo.id}` : null);

        const fileName = fileInfo.name || (fileInfo.filename || (fileInfo.file ? fileInfo.file.name : 'Unnamed File'));
        const fileSizeMB = fileInfo.file ? (fileInfo.file.size / (1024 * 1024)).toFixed(2) : (fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 'N/A');

        let linkText;
        if (viewOnly && isUploadedFile) {
          // Display custom view text based on fieldName
          switch (fieldName) {
            case 'groupLeaderSignature':
              linkText = "View Group Leader Signature";
              break;
            case 'guideSignature':
              linkText = "View Guide Signature";
              break;
            case 'uploadedFiles':
              linkText = `View Document ${index + 1}`; // For general uploaded documents
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
                onClick={() => onRemove(fieldName, index)} // Pass fieldName and index
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const UG1Form = ({ data = null, viewOnly = false }) => {
  // Initial form data structure
  const initialFormData = {
    projectTitle: "",
    projectUtility: "",
    projectDescription: "",
    finance: "", // Default to empty or 'No'
    guideNames: [""],
    employeeCodes: [""],
    svvNetId: "",
    studentDetails: Array(4).fill({
      branch: "",
      yearOfStudy: "",
      studentName: "",
      rollNumber: "",
    }),
    status: "pending",
    uploadedFiles: [], // New: Unified array for all documents
    errors: {}, // New: For granular error messages
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formId, setFormId] = useState(null);

  // State for signatures, now structured as objects for FilePreview
  const [groupLeaderSignature, setGroupLeaderSignature] = useState(null);
  const [guideSignature, setGuideSignature] = useState(null);

  // Refs to store original signature data from backend for comparison/display
  const originalGroupLeaderSignatureRef = useRef(null);
  const originalGuideSignatureRef = useRef(null);

  const fileInputRef = useRef(null);

  // Determine user role and if student
  const [currentUserRole, setCurrentUserRole] = useState("");
  const isStudent = currentUserRole === "student";

  // Effect to load user role from localStorage
  useEffect(() => {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role) {
      setCurrentUserRole(parsedUser.role);
    }
  }
}, []);

  useEffect(() => {
    const currentUserId = localStorage.getItem("svvNetId");
    if (currentUserId) {
      setFormData((prev) => ({ ...prev, svvNetId: currentUserId }));
    }
  }, []);

  // Effect to populate form data when 'data' prop changes (e.g., for editing or view mode)
  useEffect(() => {
    if (data) {
      setFormData({
        projectTitle: data.projectTitle || "",
        projectUtility: data.projectUtility || "",
        projectDescription: data.projectDescription || "",
        finance: data.finance || "",
        guideNames: data.guideNames && data.guideNames.length > 0 ? data.guideNames : [""],
        employeeCodes: data.employeeCodes && data.employeeCodes.length > 0 ? data.employeeCodes : [""],
        svvNetId: data.svvNetId || formData.svvNetId || "",
        studentDetails: data.studentDetails || Array(4).fill({
          branch: "",
          yearOfStudy: "",
          studentName: "",
          rollNumber: "",
        }),
        status: data.status || "pending",
        uploadedFiles: data.uploadedFiles || [], // Ensure this is an array of file objects
        errors: {},
      });
      setFormId(data._id || null);

      if (data.groupLeaderSignature && data.groupLeaderSignature.id) { // Use .id as per getFileDetailsAndUrl return
        setGroupLeaderSignature({
          fileId: data.groupLeaderSignature.id,
          url: data.groupLeaderSignature.url,
          name: data.groupLeaderSignature.originalName || "Group Leader Signature",
          size: data.groupLeaderSignature.size
        });
      } else {
        setGroupLeaderSignature(null);
      }

      // Correct Guide Signature Mapping
      // data.guideSignature should now be the processed object
      if (data.guideSignature && data.guideSignature.id) { // Use .id as per getFileDetailsAndUrl return
        setGuideSignature({
          fileId: data.guideSignature.id,
          url: data.guideSignature.url,
          name: data.guideSignature.originalName || "Guide Signature",
          size: data.guideSignature.size
        });
      } else {
        setGuideSignature(null);
      }
    }
  }, [data]);

  useEffect(() => {
    if (data && viewOnly) {
      // Existing PDF mapping
      setFormData((prev) => ({
        ...prev,
        uploadedFiles: (data.pdfFileIds || []).map((fileId) => ({
          fileId: fileId,
          url: `/api/ug1form/uploads/files/${fileId}`
        }))
      }));

      // Correct Group Leader Signature Mapping
      if (data.groupLeaderSignatureId && data.groupLeaderSignatureId.$oid) {
        setGroupLeaderSignature({
          fileId: data.groupLeaderSignatureId.$oid,
          url: `/api/ug1form/uploads/files/${data.groupLeaderSignatureId.$oid}`,
          name: "Group Leader Signature"
        });
      }

      // Correct Guide Signature Mapping
      if (data.guideSignatureId && data.guideSignatureId.$oid) {
        setGuideSignature({
          fileId: data.guideSignatureId.$oid,
          url: `/api/ug1form/uploads/files/${data.guideSignatureId.$oid}`,
          name: "Guide Signature"
        });
      }
    }
  }, [data, viewOnly]);

  // Determine if core inputs should be disabled (viewOnly or submitting)
  const disableCoreInputs = viewOnly || isSubmitting;
  // Determine if file controls (upload/remove buttons) should be disabled
  const disableFileControls = viewOnly || isSubmitting;

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRadioChange = (value) => {
    setFormData((prev) => ({ ...prev, finance: value }));
  };

  const handleGuideChange = (index, field, value) => {
    setFormData((prev) => {
      const newArray = [...prev[field]];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addGuide = () => {
    setFormData((prev) => ({
      ...prev,
      guideNames: [...prev.guideNames, ""],
      employeeCodes: [...prev.employeeCodes, ""],
    }));
  };

  const removeGuide = (index) => {
    setFormData((prev) => {
      const newGuideNames = prev.guideNames.filter((_, i) => i !== index);
      const newEmployeeCodes = prev.employeeCodes.filter((_, i) => i !== index);
      return {
        ...prev,
        guideNames: newGuideNames,
        employeeCodes: newEmployeeCodes,
      };
    });
  };

  const handleStudentDetailsChange = (index, field, value) => {
    setFormData((prev) => {
      const newStudentDetails = [...prev.studentDetails];
      newStudentDetails[index] = { ...newStudentDetails[index], [field]: value };
      return { ...prev, studentDetails: newStudentDetails };
    });
  };

  const handleSignatureUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const newErrors = { ...formData.errors };
    let hasError = false;

    // File size validation (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      newErrors[`${type}Signature`] = "Signature file size exceeds 5MB.";
      hasError = true;
    } else {
      delete newErrors[`${type}Signature`];
    }

    setFormData(prev => ({ ...prev, errors: newErrors }));

    if (hasError) {
      e.target.value = ''; // Clear file input
      if (type === "groupLeader") setGroupLeaderSignature(null);
      if (type === "guide") setGuideSignature(null);
      return;
    }

    const fileObject = {
      file: file,
      name: file.name,
      size: file.size,
      type: file.type, // or mimetype
      url: URL.createObjectURL(file) // Create a temporary URL for preview
    };

    if (type === "groupLeader") {
      setGroupLeaderSignature(fileObject);
    } else if (type === "guide") {
      setGuideSignature(fileObject);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    let newErrors = { ...formData.errors };
    let currentUploadedFiles = [...formData.uploadedFiles];
    let hasError = false;

    // Clear previous zip errors if any
    delete newErrors.zip_generation;
    delete newErrors.zip_size;

    // Check if any file is a ZIP
    const hasZip = files.some(file => file.type === "application/zip" || file.type === "application/x-zip-compressed");
    const pdfFiles = files.filter(file => file.type === "application/pdf");

    if (hasZip && files.length > 1) {
      newErrors.zip_generation = "Cannot upload a ZIP file with other files. Please upload either a single ZIP or multiple PDFs.";
      hasError = true;
    } else if (hasZip) {
      const zipFile = files[0];
      if (zipFile.size > 25 * 1024 * 1024) { // 25MB for ZIP
        newErrors.zip_size = "ZIP file size exceeds 25MB.";
        hasError = true;
      } else {
        // If it's a valid single ZIP, replace all existing files
        currentUploadedFiles = [{
          file: zipFile,
          name: zipFile.name,
          size: zipFile.size,
          type: zipFile.type,
          url: URL.createObjectURL(zipFile)
        }];
      }
    } else { // Handling PDF files
      if (pdfFiles.length !== files.length) {
        newErrors.file_type = "Only PDF files are allowed when not uploading a ZIP.";
        hasError = true;
      } else if (pdfFiles.length + currentUploadedFiles.length > 5) {
        newErrors.file_count = "Cannot upload more than 5 PDF documents in total.";
        hasError = true;
      } else {
        for (const file of pdfFiles) {
          if (file.size > 5 * 1024 * 1024) { // 5MB for PDF
            newErrors[`file_${file.name}`] = `File "${file.name}" size exceeds 5MB.`;
            hasError = true;
          } else {
            currentUploadedFiles.push({
              file: file,
              name: file.name,
              size: file.size,
              type: file.type,
              url: URL.createObjectURL(file) // Create temporary URL for preview
            });
          }
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      uploadedFiles: currentUploadedFiles,
      errors: newErrors,
    }));

    if (hasError) {
      e.target.value = ''; // Clear file input if there's an error
    }
  };

  const handleRemoveFile = useCallback((fieldName, index) => {
    setFormData(prev => {
      const newErrors = { ...prev.errors };
      if (fieldName === 'uploadedFiles') {
        const newUploadedFiles = [...prev.uploadedFiles];
        const removedFileName = newUploadedFiles[index]?.name;
        newUploadedFiles.splice(index, 1);
        if (removedFileName) {
          delete newErrors[`file_${removedFileName}`]; // Clear specific file error
        }
        return { ...prev, uploadedFiles: newUploadedFiles, errors: newErrors };
      } else if (fieldName === 'groupLeaderSignature') {
        setGroupLeaderSignature(null);
        originalGroupLeaderSignatureRef.current = null;
        delete newErrors.groupLeaderSignature;
        return { ...prev, errors: newErrors };
      } else if (fieldName === 'guideSignature') {
        setGuideSignature(null);
        originalGuideSignatureRef.current = null;
        delete newErrors.guideSignature;
        return { ...prev, errors: newErrors };
      }
      return prev;
    });
  }, []); // Dependencies for useCallback

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    // Basic validation
    if (!formData.projectTitle || !formData.projectDescription) {
        setErrorMessage("Please fill in all required fields.");
        setIsSubmitting(false);
        return;
    }

    try {
        const fullFormData = new FormData();

        // Append all text fields
        fullFormData.append("svvNetId", formData.svvNetId);
        fullFormData.append("projectTitle", formData.projectTitle);
        fullFormData.append("projectUtility", formData.projectUtility);
        fullFormData.append("projectDescription", formData.projectDescription);
        fullFormData.append("finance", formData.finance);
        fullFormData.append("amountClaimed", formData.amountClaimed || ''); // Ensure it's not undefined if not always present
        fullFormData.append("status", formData.status);

        // Stringify studentDetails (this is already correct, assuming it's always an array of objects)
        fullFormData.append("studentDetails", JSON.stringify(formData.studentDetails));

        // --- CORRECTED LOGIC FOR GUIDES ---
        // Construct the 'guides' array from guideNames and employeeCodes
        const formattedGuides = formData.guideNames.map((name, index) => ({
            name: name,
            employeeCode: formData.employeeCodes[index] // Ensure employeeCodes has a corresponding entry for each guideName
        }));
        fullFormData.append("guides", JSON.stringify(formattedGuides));

        // Append files/signatures if they exist and are new
        // Ensure 'file' property exists, as 'url' is just for preview
        if (groupLeaderSignature && groupLeaderSignature.file) {
            fullFormData.append("groupLeaderSignature", groupLeaderSignature.file);
        }
        if (guideSignature && guideSignature.file) {
            fullFormData.append("guideSignature", guideSignature.file);
        }

        // Append PDF files (if present, filter out existing ones that are not new uploads)
        // This loop handles both PDF and a single ZIP file based on your logic in handleFileUpload
        formData.uploadedFiles.forEach(fileObj => {
            if (fileObj.file && (fileObj.type === "application/pdf" || fileObj.type === "application/x-zip-compressed")) {
                if (fileObj.type === "application/pdf") {
                    fullFormData.append("pdfFiles", fileObj.file); // Match backend field name 'pdfFiles'
                } else if (fileObj.type === "application/x-zip-compressed") {
                    fullFormData.append("zipFile", fileObj.file); // Match backend field name 'zipFile'
                }
            }
        });

        // Send the single request
        let formResponse;
        if (formId) {
            formResponse = await axios.post("/api/ug1form/saveFormData", fullFormData, { // Consider changing to axios.put if you have a dedicated update route
                headers: { "Content-Type": "multipart/form-data" },
            });
            console.log("Form and files updated (consider PUT endpoint refactor):", formResponse.data);
        } else {
            // For new form creation
            formResponse = await axios.post("/api/ug1form/saveFormData", fullFormData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            console.log("Form and files saved:", formResponse.data);
            setFormId(formResponse.data.id); // Set the formId from the response
        }

        alert("Form and files submitted successfully!");
        // Optionally redirect or clear form

    } catch (error) {
        console.error("Error submitting form:", error);
        if (error.response && error.response.data && error.response.data.message) {
            setErrorMessage(error.response.data.message);
        } else if (error.response && error.response.data && error.response.data.error) {
            setErrorMessage(error.response.data.error);
        } else {
            setErrorMessage("An unexpected error occurred.");
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  // JSX Rendering
  return (
    <div className="form-container ug1-form">
      <h2>Under Graduate Form 1</h2>
      <p className="form-category">In-house Student Project within Department</p>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="projectTitle">Title of the Project:</label>
        <input
          id="projectTitle"
          type="text"
          value={formData.projectTitle}
          onChange={(e) => handleInputChange("projectTitle", e.target.value)}
          disabled={disableCoreInputs}
          required
        />
        {formData.errors.projectTitle && <p className="error-message">{formData.errors.projectTitle}</p>}

        <label htmlFor="projectUtility">Utility of the Project:</label>
        <input
          id="projectUtility"
          type="text"
          value={formData.projectUtility}
          onChange={(e) => handleInputChange("projectUtility", e.target.value)}
          disabled={disableCoreInputs}
          required
        />
        {formData.errors.projectUtility && <p className="error-message">{formData.errors.projectUtility}</p>}

        <label htmlFor="projectDescription">Description:</label>
        <textarea
          id="projectDescription"
          value={formData.projectDescription}
          onChange={(e) => handleInputChange("projectDescription", e.target.value)}
          disabled={disableCoreInputs}
          required
        />
        {formData.errors.projectDescription && <p className="error-message">{formData.errors.projectDescription}</p>}

        <fieldset className="form-group">
            <legend>Whether received finance from any other agency:</legend>
            <div className="radio-group">
                <label>
                <input type="radio" name="finance" value="Yes" checked={formData.finance === "Yes"} onChange={() => handleRadioChange("Yes")} disabled={disableCoreInputs} required /> Yes
                </label>
                <label>
                <input type="radio" name="finance" value="No" checked={formData.finance === "No"} onChange={() => handleRadioChange("No")} disabled={disableCoreInputs} /> No
                </label>
            </div>
            {formData.errors.finance && <p className="error-message">{formData.errors.finance}</p>}
        </fieldset>


        <h3>Guide/Co-Guide Details</h3>
        {formData.guideNames.map((name, index) => (
          <div key={`guide-${index}`} className="guide-details-entry">
            <div className="form-row">
                <div>
                    <label htmlFor={`guideName-${index}`}>Name of Guide/Co-Guide {index + 1}:</label>
                    <input id={`guideName-${index}`} type="text" value={name} onChange={(e) => handleGuideChange(index, "guideNames", e.target.value)} disabled={disableCoreInputs} />
                    {formData.errors[`guideName_${index}`] && <p className="error-message">{formData.errors[`guideName_${index}`]}</p>}
                </div>
                <div>
                    <label htmlFor={`empCode-${index}`}>Employee Code {index + 1}:</label>
                    <input id={`empCode-${index}`} type="text" value={formData.employeeCodes[index]} onChange={(e) => handleGuideChange(index, "employeeCodes", e.target.value)} disabled={disableCoreInputs} />
                    {formData.errors[`employeeCode_${index}`] && <p className="error-message">{formData.errors[`employeeCode_${index}`]}</p>}
                </div>
            </div>
            {!disableCoreInputs && formData.guideNames.length > 1 && (
              <button type="button" className="remove-btn-small" onClick={() => removeGuide(index)}>Remove Guide {index+1}</button>
            )}
          </div>
        ))}
        {!disableCoreInputs && (
          <button type="button" className="add-btn" onClick={addGuide}>➕ Add Another Guide</button>
        )}

        <h3>Student Details</h3>
        <div className="table-responsive">
            <table className="student-table">
            <thead>
                <tr>
                <th>Sr. No.</th>
                <th>Branch</th>
                <th>Year of Study</th>
                <th>Student Name</th>
                <th>Roll Number (11 digits)</th>
                </tr>
            </thead>
            <tbody>
                {formData.studentDetails.map((student, index) => (
                <tr key={`student-${index}`}>
                    <td>{index + 1}</td>
                    <td><input type="text" value={student.branch} onChange={(e) => handleStudentDetailsChange(index, "branch", e.target.value)} disabled={disableCoreInputs} /></td>
                    <td><input type="text" value={student.yearOfStudy} onChange={(e) => handleStudentDetailsChange(index, "yearOfStudy", e.target.value)} disabled={disableCoreInputs} /></td>
                    <td><input type="text" value={student.studentName} onChange={(e) => handleStudentDetailsChange(index, "studentName", e.target.value)} disabled={disableCoreInputs} /></td>
                    <td><input type="text" pattern="\d{11}" title="Must be 11 digits" value={student.rollNumber} onChange={(e) => handleStudentDetailsChange(index, "rollNumber", e.target.value)} disabled={disableCoreInputs} /></td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>

        {/* Signature Section */}
        <div className="signatures-section form-row">
          <div className="signature-upload">
            <label htmlFor="groupLeaderSignatureFile">Signature of Group Leader (Image):</label>
            {!disableFileControls && (
              <>
                <input
                  id="groupLeaderSignatureFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSignatureUpload(e, "groupLeader")}
                />
              </>
            )}
            {formData.errors.groupLeaderSignature && <p className="error-message">{formData.errors.groupLeaderSignature}</p>}
            <FilePreview
              fileList={groupLeaderSignature ? [groupLeaderSignature] : []}
              onRemove={handleRemoveFile}
              fieldName="groupLeaderSignature"
              viewOnly={viewOnly}
              isStudent={isStudent}
            />
          </div>

          <div className="signature-upload">
            <label htmlFor="guideSignatureFile">Signature of Guide (Image):</label>
            {!disableFileControls && (
              <>
                <input
                  id="guideSignatureFile"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSignatureUpload(e, "guide")}
                />
              </>
            )}
            {formData.errors.guideSignature && <p className="error-message">{formData.errors.guideSignature}</p>}
            <FilePreview
              fileList={guideSignature ? [guideSignature] : []}
              onRemove={handleRemoveFile}
              fieldName="guideSignature"
              viewOnly={viewOnly}
              isStudent={isStudent}
            />
          </div>
        </div>

        {/* Supporting Documents Section - Upload Input */}
        {!viewOnly && ( // Only show upload input if not in viewOnly mode
          <div className="form-group">
            <label>
              Upload Additional Documents (Max 5 PDF files, 5MB each OR one ZIP file up to 25MB):
            </label>
            <input
              id="supportingDocs"
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed"
              multiple
              name="uploadedFiles"
              onChange={handleFileUpload}
            />
            {formData.errors.zip_generation && ( // Display general zip generation error
              <p className="error-message">{formData.errors.zip_generation}</p>
            )}
            {formData.errors.zip_size && ( // Display general zip size error
              <p className="error-message">{formData.errors.zip_size}</p>
            )}
            {formData.errors.file_type && ( // Display file type error
              <p className="error-message">{formData.errors.file_type}</p>
            )}
            {formData.errors.file_count && ( // Display file count error
              <p className="error-message">{formData.errors.file_count}</p>
            )}
          </div>
        )}
        {/* Supporting Documents Section - File Preview (visible based on FilePreview's internal logic) */}
        {!(viewOnly && isStudent) && (
          <div className="form-group">
            <label>Supporting Documents:</label>
            <FilePreview
              fileList={formData.uploadedFiles}
              onRemove={handleRemoveFile}
              fieldName="uploadedFiles"
              viewOnly={viewOnly}
              isStudent={isStudent}
            />
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="back-btn" onClick={handleBack} disabled={isSubmitting}>Back</button>
          {!viewOnly && (
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : (formId ? "Update Form" : "Submit Form")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UG1Form;