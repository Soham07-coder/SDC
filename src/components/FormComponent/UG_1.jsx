import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/UG1.css"; // Ensure this path is correct
import JSZip from "jszip";

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

  const [formData, setFormData] = useState(
    data
      ? {
          projectTitle: data.projectTitle || "",
          projectUtility: data.projectUtility || "",
          projectDescription: data.projectDescription || "",
          finance: data.finance || "",
          guideNames: data.guideNames && data.guideNames.length > 0 ? data.guideNames : [""],
          employeeCodes: data.employeeCodes && data.employeeCodes.length > 0 ? data.employeeCodes : [""],
          svvNetId: data.svvNetId || "",
          studentDetails: data.studentDetails || initialFormData.studentDetails,
          status: data.status || "pending",
          // FIX: Initialize with data.pdfFileUrls or data.zipFile
          uploadedFiles: data.zipFile ? [data.zipFile] : (data.pdfFileUrls || []),
          errors: {},
        }
      : initialFormData
  );

  // State for signatures
  const [groupLeaderSignature, setGroupLeaderSignature] = useState(data?.groupLeaderSignature || null);
  const [guideSignature, setGuideSignature] = useState(data?.guideSignature || null);

  const [errorMessage, setErrorMessage] = useState(""); // General error message for form submission issues
  const [formId, setFormId] = useState(data?._id || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const svvNetIdRef = useRef(""); // Stores svvNetId from localStorage

  // Ref to store original document file info
  // FIX: Initialize with data.pdfFileUrls or data.zipFile
  const originalUploadedFilesRef = useRef(data?.zipFile ? [data.zipFile] : (data?.pdfFileUrls || []));
  const originalGroupLeaderSignatureRef = useRef(data?.groupLeaderSignature || null);
  const originalGuideSignatureRef = useRef(data?.guideSignature || null);

  // State for user role, fetched from localStorage
  const [currentUserRole, setCurrentUserRole] = useState('student'); // Default to 'student' if not found in localStorage

  useEffect(() => {
    const storedUserRole = localStorage.getItem("userRole");
    if (storedUserRole) {
      setCurrentUserRole(storedUserRole);
    }
  }, []); // Run once on component mount

  // Determine if the current user is a student based on fetched role
  const isStudent = currentUserRole === 'student';

  useEffect(() => {
    const storedSvvNetId = localStorage.getItem("svvNetId");
    if (storedSvvNetId) {
      svvNetIdRef.current = storedSvvNetId;
      if (!data) { // Only set in formData if it's a new form
        setFormData((prev) => ({ ...prev, svvNetId: storedSvvNetId }));
      }
    }
  }, [data]); // Rerun if `data` changes (e.g. from null to populated)

  useEffect(() => {
    if (data) {
      setFormData({
        projectTitle: data.projectTitle || "",
        projectUtility: data.projectUtility || "",
        projectDescription: data.projectDescription || "",
        finance: data.finance || "",
        guideNames: data.guideNames && data.guideNames.length > 0 ? data.guideNames : [""],
        employeeCodes: data.employeeCodes && data.employeeCodes.length > 0 ? data.employeeCodes : [""],
        svvNetId: data.svvNetId || svvNetIdRef.current, // Use svvNetId from data if available
        studentDetails: data.studentDetails || initialFormData.studentDetails,
        status: data.status || "pending",
        // FIX: Initialize with data.pdfFileUrls or data.zipFile
        uploadedFiles: data.zipFile ? [data.zipFile] : (data.pdfFileUrls || []),
        errors: {}, // Clear errors on data load
      });

      setGroupLeaderSignature(data.groupLeaderSignature || null);
      setGuideSignature(data.guideSignature || null);
      setFormId(data._id);

      // FIX: Initialize with data.pdfFileUrls or data.zipFile
      originalUploadedFilesRef.current = data.zipFile ? [data.zipFile] : (data.pdfFileUrls || []);
      originalGroupLeaderSignatureRef.current = data.groupLeaderSignature || null;
      originalGuideSignatureRef.current = data.guideSignature || null;
    } else {
        // Reset form if data is null (e.g., navigating away from edit to new form)
        setFormData(prev => ({...initialFormData, svvNetId: svvNetIdRef.current, uploadedFiles: [], errors: {}})); // Keep svvNetId from localStorage
        setGroupLeaderSignature(null);
        setGuideSignature(null);
        setFormId(null);
        // FIX: Ensure ref is cleared
        originalUploadedFilesRef.current = [];
        originalGroupLeaderSignatureRef.current = null;
        originalGuideSignatureRef.current = null;
    }
  }, [data]);


  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStudentDetailsChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedStudents = prev.studentDetails.map((student, i) =>
        i === index ? { ...student, [field]: value } : student
      );
      return { ...prev, studentDetails: updatedStudents };
    });
  };

  const handleRadioChange = (value) => {
    setFormData((prev) => ({ ...prev, finance: value }));
  };

  // Helper function to check if a file is a ZIP
  const isZipFile = (file) => {
    const mimeType = file.type || file.mimetype; // Check both for File object and backend object
    return mimeType === "application/zip" || mimeType === "application/x-zip-compressed";
  };

  const handleFileUpload = async (e) => {
    if (viewOnly) return;
    const files = Array.from(e.target.files);
    setErrorMessage(""); // Clear general form error message
    setFormData(prev => ({ ...prev, errors: {} })); // Clear file-specific errors

    if (files.length === 0) {
      if(fileInputRef.current) fileInputRef.current.value = null;
      return;
    }

    let newFilesToAdd = [];
    let containsUnsupportedType = false;
    let singleZipUploadAttempt = false;

    // Determine if the user attempted to upload a single ZIP file
    if (files.length === 1 && isZipFile(files[0])) {
        singleZipUploadAttempt = true;
    }

    if (singleZipUploadAttempt) {
        const file = files[0];
        if (file.size > 25 * 1024 * 1024) { // 25MB limit for ZIP
            setFormData(prev => ({
                ...prev,
                errors: { ...prev.errors, [`file_0`]: `❌ ZIP file "${file.name}" must be less than 25MB.` }
            }));
            if(fileInputRef.current) fileInputRef.current.value = null;
            return;
        }
        newFilesToAdd = [file];
        setFormData(prev => ({ ...prev, uploadedFiles: newFilesToAdd })); // Replace all current files with this single ZIP
    } else {
        // Processing for multiple files (or a single PDF)
        const currentValidPdfs = formData.uploadedFiles.filter(f => !isZipFile(f)); // Filter out current ZIP if any
        let tempPdfs = [...currentValidPdfs]; // Start with existing valid PDFs

        for (const file of files) {
            console.log(`DEBUG: Processing file: Name: "${file.name}", Type: "${file.type}", Size: ${file.size} bytes`);

            if (file.type === "application/pdf") {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit for individual PDF
                    setFormData(prev => ({
                        ...prev,
                        errors: { ...prev.errors, [`file_${file.name}`]: `❌ PDF file "${file.name}" must be less than 5MB.` }
                    }));
                    containsUnsupportedType = true;
                    continue; // Skip this file
                }
                // Check for duplicates based on name
                if (tempPdfs.some(existingFile => existingFile.name === file.name)) {
                    setFormData(prev => ({
                        ...prev,
                        errors: { ...prev.errors, [`file_${file.name}`]: `❌ File "${file.name}" already selected or uploaded.` }
                    }));
                    containsUnsupportedType = true;
                    continue;
                }
                tempPdfs.push(file); // Add valid new PDF
            } else if (isZipFile(file)) {
                // If a ZIP file is selected with other files, it's a warning
                setFormData(prev => ({
                    ...prev,
                    errors: { ...prev.errors, [`file_${file.name}`]: `⚠️ ZIP file "${file.name}" selected with other files. Please upload ZIP files separately.` }
                }));
                containsUnsupportedType = true;
                continue; // Skip this file
            } else { // Not a PDF and not a ZIP
                setFormData(prev => ({
                    ...prev,
                    errors: { ...prev.errors, [`file_${file.name}`]: `❌ File "${file.name}" is not a PDF or a ZIP file and cannot be processed.` }
                }));
                containsUnsupportedType = true;
                continue;
            }
        }

        // After processing all new files, decide whether to keep as PDFs or auto-zip
        if (tempPdfs.length > 5) {
            // Auto-zip all current and new PDFs
            const zip = new JSZip();
            const fetchAndAddPromises = tempPdfs.map(async (fileToZip) => {
                try {
                    if (fileToZip.url) { // File already on server, fetch its content
                        const response = await fetch(fileToZip.url);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for ${fileToZip.name}`);
                        const blob = await response.blob();
                        zip.file(fileToZip.name, blob);
                    } else { // Local File object
                        zip.file(fileToZip.name, fileToZip);
                    }
                } catch (error) {
                    console.error(`Error adding file ${fileToZip.name} to zip:`, error);
                    setFormData(prev => ({
                        ...prev,
                        errors: { ...prev.errors, [`zip_generation`]: `Could not add ${fileToZip.name} to the ZIP. It will be skipped.` }
                    }));
                }
            });
            await Promise.all(fetchAndAddPromises);

            try {
                const content = await zip.generateAsync({ type: "blob" });
                const zipFileBlob = new File([content], `documents-${Date.now()}.zip`, { type: "application/zip" });

                if (zipFileBlob.size > 25 * 1024 * 1024) { // Check size of the generated ZIP
                    setFormData(prev => ({
                        ...prev,
                        errors: { ...prev.errors, [`zip_size`]: "❌ Automatically generated ZIP file exceeds the 25MB size limit. Please reduce the number/size of PDFs." },
                        uploadedFiles: [] // Clear all files if auto-zip exceeds limit
                    }));
                } else {
                    setFormData(prev => ({ ...prev, uploadedFiles: [zipFileBlob] })); // Set as single ZIP file
                }
            } catch (err) {
                console.error("Zip Generation Error:", err);
                setFormData(prev => ({
                    ...prev,
                    errors: { ...prev.errors, [`zip_generation`]: "❌ Failed to generate ZIP from PDFs." },
                    uploadedFiles: [] // Clear files on zip error
                }));
            }
        } else {
            // 5 or fewer PDFs, set them as individual files
            setFormData(prev => ({ ...prev, uploadedFiles: tempPdfs }));
        }
    }
    if(fileInputRef.current) fileInputRef.current.value = null; // Clear the file input
  };

  const removeUploadedFile = async (indexToRemove) => {
    if (viewOnly) return;
    setErrorMessage(""); // Clear general error message
    setFormData(prev => ({ ...prev, errors: {} })); // Clear file-specific errors

    const fileToRemove = formData.uploadedFiles[indexToRemove];
    const isCurrentFileAZip = isZipFile(fileToRemove);

    let updatedFiles;

    if (isCurrentFileAZip && formData.uploadedFiles.length === 1) {
        // If the single ZIP file is being removed, clear all uploadedFiles
        updatedFiles = [];
    } else {
        // If individual PDFs are present, or a non-single ZIP was somehow in the list (shouldn't happen with current logic)
        updatedFiles = formData.uploadedFiles.filter((_, i) => i !== indexToRemove);
    }

    setFormData((prev) => ({ ...prev, uploadedFiles: updatedFiles }));
  };

  const handleSignatureUpload = (e, type) => {
    if (viewOnly) return;
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) { // Allow any image type, or be specific e.g. image/jpeg, image/png
      setErrorMessage("❌ Only image files are allowed for signatures.");
      e.target.value = null;
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      setErrorMessage("❌ Signature image must be less than 2MB.");
      e.target.value = null;
      return;
    }

    if (type === "groupLeader") setGroupLeaderSignature(file);
    else if (type === "guide") setGuideSignature(file);
    e.target.value = null;
  };

  const handleGuideChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedArray = [...prev[field]];
      updatedArray[index] = value;
      return { ...prev, [field]: updatedArray };
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
    if (formData.guideNames.length <= 1) { // Always keep at least one guide input row
        setErrorMessage("At least one guide entry is required.");
        return;
    }
    setFormData((prev) => ({
      ...prev,
      guideNames: prev.guideNames.filter((_, i) => i !== index),
      employeeCodes: prev.employeeCodes.filter((_, i) => i !== index),
    }));
  };

  const uploadSignature = async (file, type, currentFormId) => {
    const signatureFormData = new FormData();
    signatureFormData.append("file", file);
    try {
      const response = await axios.post(
        `http://localhost:5000/api/ug1form/uploadSignature/${currentFormId}/${type}`,
        signatureFormData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      console.log(`✅ ${type} Signature Uploaded:`, response.data);
    } catch (error) {
      console.error(`❌ Error uploading ${type} signature:`, error.response?.data || error.message);
      throw new Error(`Failed to upload ${type} signature.`);
    }
  };

  const handleUploadDocuments = async (currentFormId) => {
    const newFilesToUpload = formData.uploadedFiles.filter(file => file instanceof File);
    const hasCurrentZip = formData.uploadedFiles.length === 1 && isZipFile(formData.uploadedFiles[0]);
    const hasCurrentPdfs = formData.uploadedFiles.length > 0 && !hasCurrentZip;

    const wasOriginalZip = originalUploadedFilesRef.current.length === 1 && isZipFile(originalUploadedFilesRef.current[0]);
    const wasOriginalPdfs = originalUploadedFilesRef.current.length > 0 && !wasOriginalZip;

    // Clear old files from DB if the type of document has changed or all documents are removed
    if ( (wasOriginalPdfs && (!hasCurrentPdfs || hasCurrentZip)) || (wasOriginalZip && (!hasCurrentZip || hasCurrentPdfs)) || (originalUploadedFilesRef.current.length > 0 && formData.uploadedFiles.length === 0) ) {
        // Clear PDFs if they were there and now there's a zip, or PDFs are removed, or type switched to zip
        if (wasOriginalPdfs) {
            try {
                await axios.put(`http://localhost:5000/api/ug1form/clearPdfFiles/${currentFormId}`);
                console.log("Cleared old PDF files in DB.");
            } catch (clearError) {
                console.error("Error clearing old PDF files in DB:", clearError.response?.data || clearError.message);
            }
        }
        // Clear ZIP if it was there and now there are PDFs, or ZIP is removed, or type switched to PDFs
        if (wasOriginalZip) {
            try {
                await axios.put(`http://localhost:5000/api/ug1form/clearZipFile/${currentFormId}`);
                console.log("Cleared old ZIP file in DB.");
            } catch (clearError) {
                console.error("Error clearing old ZIP file in DB:", clearError.response?.data || clearError.message);
            }
        }
    }


    // Upload new files
    if (hasCurrentZip && newFilesToUpload.length > 0 && isZipFile(newFilesToUpload[0])) {
        // A new ZIP file was selected or generated
        const docFormData = new FormData();
        docFormData.append("pdfZip", newFilesToUpload[0]); // 'pdfZip' must match backend key
        await axios.post(`http://localhost:5000/api/ug1form/uploadZip/${currentFormId}`, docFormData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        console.log("New ZIP uploaded.");
    } else if (hasCurrentPdfs && newFilesToUpload.length > 0) {
        // New individual PDF files were selected/generated
        for (const file of newFilesToUpload) {
            if (file.type === "application/pdf") { // Double check type before appending
                const docFormData = new FormData();
                docFormData.append("pdfFile", file); // 'pdfFile' must match backend key
                await axios.post(`http://localhost:5000/api/ug1form/uploadPDF/${currentFormId}`, docFormData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                console.log(`Uploaded new PDF: ${file.name}`);
            }
        }
    } else {
        console.log("No new documents to upload or existing files retained.");
    }
    // Update originalUploadedFilesRef after successful upload to reflect current state
    originalUploadedFilesRef.current = formData.uploadedFiles;
};


  const handleSaveFormData = async () => {
    setErrorMessage("");
    const safeTrim = (str) => (typeof str === "string" ? str.trim() : "");

    // Core text fields validation applies to anyone submitting
    if (!safeTrim(formData.projectTitle) || !safeTrim(formData.projectUtility) || !safeTrim(formData.projectDescription) || !formData.finance) {
      setErrorMessage("Please fill all required textual fields including finance option.");
      return null;
    }
    
    const hasGuideDetails = formData.guideNames.some(name => safeTrim(name)) && formData.employeeCodes.some(code => safeTrim(code));

    if (!hasGuideDetails) {
        setErrorMessage("Please provide at least one Guide/Co-Guide name with a corresponding Employee Code. Both fields are required if one is filled.");
        return null;
    }
    
    // Check for incomplete guide pairs
    if (formData.guideNames.length !== formData.employeeCodes.length) {
        setErrorMessage("Guide names and employee codes must have matching entries.");
        return null;
    }

    for (let i = 0; i < formData.guideNames.length; i++) {
        const name = safeTrim(formData.guideNames[i]);
        const code = safeTrim(formData.employeeCodes[i]);
        if ((name && !code) || (!name && code)) {
            setErrorMessage("Please ensure all Guide/Co-Guide entries have both a name and an employee code, or leave both blank.");
            return null;
        }
    }


     const filledStudents = formData.studentDetails.filter(
      (student) =>
        safeTrim(student.studentName) ||
        safeTrim(student.rollNumber) ||
        safeTrim(student.branch) ||
        safeTrim(student.yearOfStudy)
    );

    if (filledStudents.length === 0) {
      setErrorMessage("At least one student's complete details must be filled.");
      return null;
    }

    for (let i = 0; i < filledStudents.length; i++) {
        const student = filledStudents[i];
        if (!safeTrim(student.studentName) || !safeTrim(student.rollNumber) || !safeTrim(student.branch) || !safeTrim(student.yearOfStudy)) {
            setErrorMessage(`Please complete all fields for student ${formData.studentDetails.indexOf(student) + 1} if any field is entered.`);
            return null;
        }
        if (!/^\d{11}$/.test(safeTrim(student.rollNumber))) {
            setErrorMessage(`Roll Number for student ${formData.studentDetails.indexOf(student) + 1} must be exactly 11 digits.`);
            return null;
        }
    }

    // File and signature validation
    const hasUploadedFiles = formData.uploadedFiles.length > 0;
    const isSingleZipFile = hasUploadedFiles && isZipFile(formData.uploadedFiles[0]);

    if (hasUploadedFiles) {
        if (isSingleZipFile) {
            if (formData.uploadedFiles[0] instanceof File && formData.uploadedFiles[0].size > 25 * 1024 * 1024) {
                setErrorMessage("The zipped documents file exceeds the 25MB size limit.");
                return null;
            }
        } else { // Must be individual PDFs
            if (formData.uploadedFiles.length > 5) {
                setErrorMessage("You can upload a maximum of 5 individual PDF files. Please re-upload or select fewer.");
                return null;
            }
            if (formData.uploadedFiles.some(file => file instanceof File && file.size > 5 * 1024 * 1024)) {
                setErrorMessage("One or more PDF files exceed the 5MB size limit.");
                return null;
            }
        }
    } else {
        setErrorMessage("Please upload supporting documents (Max 5 PDF files or one ZIP file).");
        return null;
    }


    if ((groupLeaderSignature === null && !originalGroupLeaderSignatureRef.current) || (groupLeaderSignature instanceof File && groupLeaderSignature.size === 0)) {
      setErrorMessage("Please upload the Group Leader's signature (image).");
      return null;
    }
    if ((guideSignature === null && !originalGuideSignatureRef.current) || (guideSignature instanceof File && guideSignature.size === 0)) {
      setErrorMessage("Please upload the Guide's signature (image).");
      return null;
    }

    const dataToSend = { ...formData, svvNetId: svvNetIdRef.current };
    // Filter out empty student details before sending
    dataToSend.studentDetails = dataToSend.studentDetails.filter(
        s => s.studentName.trim() || s.rollNumber.trim() || s.branch.trim() || s.yearOfStudy.trim()
    );
    // Filter out empty guide/employee code pairs
    const validGuides = [];
    const validCodes = [];
    dataToSend.guideNames.forEach((name, index) => {
        if (safeTrim(name) && safeTrim(dataToSend.employeeCodes[index])) {
            validGuides.push(safeTrim(name));
            validCodes.push(safeTrim(dataToSend.employeeCodes[index]));
        }
    });
    dataToSend.guideNames = validGuides;
    dataToSend.employeeCodes = validCodes;

    // Remove uploadedFiles and errors from dataToSend as they are handled separately or frontend-only
    delete dataToSend.uploadedFiles;
    delete dataToSend.errors;


    try {
      const endpoint = formId ? `http://localhost:5000/api/ug1form/updateFormData/${formId}` : "http://localhost:5000/api/ug1form/saveFormData";
      const method = formId ? "put" : "post";
      
      const response = await axios[method](endpoint, dataToSend);
      
      const returnedFormId = response.data.formId || (formId && response.data.message ? formId : null) ; // If updating, formId might not be in response
      if (returnedFormId) {
        if (!formId) setFormId(returnedFormId); // Set formId if it's a new form
        return returnedFormId;
      } else {
        setErrorMessage(response.data.message || "Failed to save form data. Form ID not received.");
        return null;
      }
    } catch (error) {
      console.error("❌ Error Saving Form Data:", error.response?.data || error.message);
      setErrorMessage(error.response?.data?.error || "Error saving form data. Try again.");
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (viewOnly || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setFormData(prev => ({ ...prev, errors: {} })); // Clear all errors on submission attempt

    try {
      const currentFormId = await handleSaveFormData(); // This now handles create/update
      if (!currentFormId) {
        setIsSubmitting(false);
        return;
      }

      // Documents and Signatures are always handled if not in viewOnly mode
      try {
        await handleUploadDocuments(currentFormId);
      } catch (docErr) {
        console.error("❌ Document Upload/Clear Failed:", docErr.message || docErr);
        setErrorMessage(`Error with documents: ${docErr.message || 'Please try again.'}`);
      }

      // Signatures
      try {
        if (groupLeaderSignature instanceof File) {
          await uploadSignature(groupLeaderSignature, "groupLeader", currentFormId);
        } else if (groupLeaderSignature === null && originalGroupLeaderSignatureRef.current) {
          // If signature was present but now cleared (null), send clear request
          await axios.put(`http://localhost:5000/api/ug1form/clearSignature/${currentFormId}/groupLeader`);
          originalGroupLeaderSignatureRef.current = null; // Reflect change
        }

        if (guideSignature instanceof File) {
          await uploadSignature(guideSignature, "guide", currentFormId);
        } else if (guideSignature === null && originalGuideSignatureRef.current) {
          // If signature was present but now cleared (null), send clear request
          await axios.put(`http://localhost:5000/api/ug1form/clearSignature/${currentFormId}/guide`);
          originalGuideSignatureRef.current = null; // Reflect change
        }
      } catch (sigErr) {
        console.error("❌ Signature Upload/Clear Failed:", sigErr.message || sigErr);
        setErrorMessage(`Error with signatures: ${sigErr.message || 'Please try again.'}`);
      }


      alert("✅ Form submitted successfully!");
      if (!data) { // If it was a new submission (not an edit)
        setFormData(prev => ({...initialFormData, svvNetId: svvNetIdRef.current}));
        setGroupLeaderSignature(null);
        setGuideSignature(null);
        setFormId(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) { // Catch errors from handleSaveFormData if not caught internally
      console.error("❌ Top Level Submission Error:", err);
      setErrorMessage(err.message || "An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  // Determine if inputs for core form fields should be disabled for students (if not pending) or if viewOnly
  const disableCoreInputs = viewOnly || (isStudent && data && data.status !== 'pending');
  // Determine if file/signature related controls (upload/remove) should be disabled.
  const disableFileControls = viewOnly;


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

        <label htmlFor="projectUtility">Utility of the Project:</label>
        <input
          id="projectUtility"
          type="text"
          value={formData.projectUtility}
          onChange={(e) => handleInputChange("projectUtility", e.target.value)}
          disabled={disableCoreInputs} 
          required
        />

        <label htmlFor="projectDescription">Description:</label>
        <textarea
          id="projectDescription"
          value={formData.projectDescription}
          onChange={(e) => handleInputChange("projectDescription", e.target.value)}
          disabled={disableCoreInputs} 
          required
        />

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
        </fieldset>


        <h3>Guide/Co-Guide Details</h3>
        {formData.guideNames.map((name, index) => (
          <div key={`guide-${index}`} className="guide-details-entry">
            <div className="form-row">
                <div>
                    <label htmlFor={`guideName-${index}`}>Name of Guide/Co-Guide {index + 1}:</label>
                    <input id={`guideName-${index}`} type="text" value={name} onChange={(e) => handleGuideChange(index, "guideNames", e.target.value)} disabled={disableCoreInputs} />
                </div>
                <div>
                    <label htmlFor={`empCode-${index}`}>Employee Code {index + 1}:</label>
                    <input id={`empCode-${index}`} type="text" value={formData.employeeCodes[index]} onChange={(e) => handleGuideChange(index, "employeeCodes", e.target.value)} disabled={disableCoreInputs} />
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
            {(groupLeaderSignature || originalGroupLeaderSignatureRef.current) ? (
              <div className="file-preview">
                {/* Check if not student OR if data.url exists to display image preview */}
                {(!isStudent || (groupLeaderSignature?.url || originalGroupLeaderSignatureRef.current?.url)) && (
                  <>
                    <a href={groupLeaderSignature.url || originalGroupLeaderSignatureRef.current.url} target="_blank" rel="noopener noreferrer">View Current</a>
                  </>
                )}
                <span>{groupLeaderSignature instanceof File ? `Selected: ${groupLeaderSignature.name}` : (groupLeaderSignature?.name || originalGroupLeaderSignatureRef.current?.name)}</span>
              </div>
            ) : (
              !isStudent && <p>No Group Leader Signature uploaded.</p>
            )}
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
            {(guideSignature || originalGuideSignatureRef.current) ? (
              <div className="file-preview">
                {/* Check if not student OR if data.url exists to display image preview */}
                {(!isStudent || (guideSignature?.url || originalGuideSignatureRef.current?.url)) && (
                  <>
                    <a href={guideSignature.url || originalGuideSignatureRef.current.url} target="_blank" rel="noopener noreferrer">View Current</a>
                  </>
                )}
                <span>{guideSignature instanceof File ? `Selected: ${guideSignature.name}` : (guideSignature?.name || originalGuideSignatureRef.current?.name)}</span>
              </div>
            ) : (
              !isStudent && <p>No Guide Signature uploaded.</p>
            )}
          </div>
        </div>
        
        {/* Supporting Documents Section */}
        <div className="form-group">
          <label>
            Upload Additional Documents (Max 5 PDF files, 5MB each OR one ZIP file up to 25MB):
          </label>
          {!disableFileControls && (
            <input
              id="supportingDocs"
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed"
              multiple
              name="uploadedFiles"
              onChange={handleFileUpload}
            />
          )}
          {formData.uploadedFiles.length > 0 && (
            <div className="uploaded-files-list">
              <h4>Uploaded Files:</h4>
              <ul className="file-list">
                {formData.uploadedFiles.map((file, index) => {
                  const fileName = file.name || file.originalName || "Unnamed";
                  const fileUrl = file.url;
                  const fileMimeType = file.mimetype || file.type;
                  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

                  return (
                    <li key={index}>
                      {viewOnly && fileUrl ? (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                          {fileName} ({fileMimeType}, {fileSizeMB} MB)
                        </a>
                      ) : (
                        <>
                          <span>{fileName} ({fileSizeMB} MB)</span>
                          {!disableFileControls && (
                            <button
                              type="button"
                              className="remove-btn-small"
                              onClick={() => removeUploadedFile(index)}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                      {formData.errors[`file_${fileName}`] && ( // Display file-specific errors
                        <p className="error-message">
                          {formData.errors[`file_${fileName}`]}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {formData.uploadedFiles.length === 0 && (
              isStudent ? <li>No documents selected yet.</li> : <li>No supporting documents selected/uploaded.</li>
          )}
          {formData.errors.zip_generation && ( // Display general zip generation error
            <p className="error-message">{formData.errors.zip_generation}</p>
          )}
          {formData.errors.zip_size && ( // Display general zip size error
            <p className="error-message">{formData.errors.zip_size}</p>
          )}
        </div>

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