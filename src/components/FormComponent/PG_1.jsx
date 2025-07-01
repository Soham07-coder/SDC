import React, { useState } from 'react';
import axios from "axios";

const PG_1 = ({ viewOnly = false , data = null }) => {
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
        dateFrom: data.dateFrom || '',
        dateTo: data.dateTo || '',
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
        claimDate: data.claimDate || '',
        amountReceived: data.amountReceived || '',
        amountSanctioned: data.amountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
      };
    }
    // Defaults if not viewOnly or no data
    return {
      studentName: '',
      yearOfAdmission: '',
      feesPaid: 'No',
      department: '', 
      sttpTitle: '',
      guideName: '',
      coGuideName: '',
      numberOfDays: '',
      dateFrom: '',
      dateTo: '',
      organization: '',
      reason: '',
      knowledgeUtilization: '',
      bankDetails: {
        beneficiary: '',
        ifsc: '',
        bankName: '',
        branch: '',
        accountType: '',
        accountNumber: ''
      },
      registrationFee: '',
      previousClaim: 'No',
      claimDate: '',
      amountReceived: '',
      amountSanctioned: '',
      status: 'pending',
      svvNetId: '',
    };
  });

  // files state: single files + multiple PDFs and ZIPs (max limits enforced)
  const [files, setFiles] = useState(() => {
    if (viewOnly && data) {
      return {
        receiptCopy: null,
        guideSignature: null,
        additionalDocuments: null,
        pdfDocuments: [],
        zipFiles: []
      };
    }
    return {
      receiptCopy: null,
      additionalDocuments: null,
      guideSignature: null,
      pdfDocuments: [],
      zipFiles: []
    };
  });

  // Handlers for form inputs
  const handleChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRemoveFile = (field, index) => {
    setFiles((prev) => {
      const updated = Array.from(prev[field] || []);
      updated.splice(index, 1);
      return {
        ...prev,
        [field]: updated,
      };
    });
  };

  const handleBankChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };

  // Single file input handler with 5MB size limit
  const handleFileChange = (field, e) => {
    if (viewOnly) return;
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setFiles(prev => ({
      ...prev,
      [field]: file
    }));
  };

  // Multiple PDFs handler with max 5 files, PDF type & size validation
  const handlePdfChange = (e) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > 5) {
      alert("Maximum 5 PDF files allowed.");
      return;
    }

    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert(`"${file.name}" is not a PDF file.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 5MB size limit.`);
        return;
      }
    }

    setFiles(prev => ({
      ...prev,
      pdfDocuments: selectedFiles
    }));
  };

  // Multiple ZIPs handler with max 2 files, ZIP type & size validation
  const handleZipChange = (e) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > 2) {
      alert("Maximum 2 ZIP files allowed.");
      return;
    }

    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        alert(`"${file.name}" is not a ZIP file.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 5MB size limit.`);
        return;
      }
    }

    setFiles(prev => ({
      ...prev,
      zipFiles: selectedFiles
    }));
  };

  // File preview component for multiple files
  const FilePreview = ({ files, type, onRemove, showRemoveButton }) => {
    if (!files || files.length === 0) return null;

    return (
      <ul className="mt-2 list-disc list-inside space-y-1">
        {files.map((file, index) => (
          <li key={index} className="flex items-center justify-between text-sm text-gray-700">
            <span>{file.name || file.filename}</span>
            {showRemoveButton && (
              <button
                type="button"
                className="ml-4 text-red-600 hover:underline"
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  };

  // Submit handler with FormData construction for single + multiple files
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
        setUserMessage({
          text: "User session corrupted. Please log in again.",
          type: "error",
        });
        return;
      }
    }

    if (!svvNetId || !department) {
      setUserMessage({
        text: "Authentication error: svvNetId or branch not found. Please log in.",
        type: "error",
      });
      return;
    }

    try {
      const formPayload = new FormData();

      // ✅ Append user identity fields
      formPayload.append("svvNetId", svvNetId);
      formPayload.append("department", department);

      // 📄 Append form fields except bankDetails and department
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "bankDetails" && key !== "department") {
          formPayload.append(key, value || "");
        }
      });

      // 🏦 Append bankDetails JSON
      formPayload.append("bankDetails", JSON.stringify(formData.bankDetails || {}));

      // 📎 Required files
      if (!files.receiptCopy || !files.guideSignature) {
        alert("Please upload both Receipt Copy and Guide Signature.");
        return;
      }

      formPayload.append("receiptCopy", files.receiptCopy);
      formPayload.append("guideSignature", files.guideSignature);

      // 📎 Optional files
      if (files.additionalDocuments) {
        formPayload.append("additionalDocuments", files.additionalDocuments);
      }

      (files.pdfDocuments || []).slice(0, 5).forEach((file) => {
        formPayload.append("pdfDocuments", file);
      });

      (files.zipFiles || []).slice(0, 2).forEach((file) => {
        formPayload.append("zipFiles", file);
      });

      // 🚀 Submit form
      const response = await axios.post("http://localhost:5000/api/pg1form/submit", formPayload);

      alert("Form submitted successfully!");
      console.log("✅ Submitted:", response.data);
    } catch (error) {
      console.error("❌ Submit error:", error.response || error.message || error);
      alert("Failed to submit form. Please check required fields and try again.");
    }
  };

  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Post Graduate Form 1 - Workshop/STTP {viewOnly && "(View Only)"}
      </h1>
      
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
      <div className="mb-6 space-y-4">
      {!viewOnly ? (
        <>
          {/* Receipt Copy */}
          <div>
            <label className="block font-semibold mb-2">Attach receipt of registration fees:</label>
            <div className="flex items-center">
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                Choose Receipt
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileChange("receiptCopy", e)}
                  disabled={viewOnly}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.receiptCopy ? files.receiptCopy.name : "No file chosen"}
              </span>
            </div>
          </div>

          {/* Additional Documents */}
          <div>
            <label className="block font-semibold mb-2">Additional Documents:</label>
            <div className="flex items-center">
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                Choose Document
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileChange("additionalDocuments", e)}
                  disabled={viewOnly}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.additionalDocuments ? files.additionalDocuments.name : "No file chosen"}
              </span>
            </div>
          </div>

          {/* Guide Signature */}
          <div>
            <label className="block font-semibold mb-2">Guide Signature:</label>
            <div className="flex items-center">
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                Upload Signature
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileChange("guideSignature", e)}
                  disabled={viewOnly}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.guideSignature ? files.guideSignature.name : "No file chosen"}
              </span>
            </div>
          </div>

          {/* PDF Files (max 5) */}
          <div>
            <label className="block font-semibold mb-2">Upload up to 5 PDFs:</label>
            <div className="flex items-center">
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                Choose PDFs
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={handlePdfChange}
                  disabled={viewOnly}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.pdfDocuments && files.pdfDocuments.length > 0
                  ? `${files.pdfDocuments.length} file(s) selected`
                  : "No PDFs selected"}
              </span>
            </div>
            <FilePreview
              files={files.pdfDocuments}
              type="PDF"
              onRemove={(index) => handleRemoveFile("pdfDocuments", index)}
              showRemoveButton={!viewOnly}
            />
          </div>

          {/* ZIP Files (max 2) */}
          <div>
            <label className="block font-semibold mb-2">Upload up to 2 ZIPs:</label>
            <div className="flex items-center">
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                Choose ZIPs
                <input
                  type="file"
                  accept=".zip"
                  multiple
                  className="hidden"
                  onChange={handleZipChange}
                  disabled={viewOnly}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.zipFiles && files.zipFiles.length > 0
                  ? `${files.zipFiles.length} file(s) selected`
                  : "No ZIPs selected"}
              </span>
            </div>
            <FilePreview
              files={files.zipFiles}
              type="ZIP"
              onRemove={(index) => handleRemoveFile("zipFiles", index)}
              showRemoveButton={!viewOnly}
            />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="font-semibold">Receipt Copy:</label>
            <span className="ml-2 text-sm text-gray-600">
              {files.receiptCopy ? files.receiptCopy.name : "No file uploaded"}
            </span>
          </div>
          <div>
            <label className="font-semibold">Additional Documents:</label>
            <span className="ml-2 text-sm text-gray-600">
              {files.additionalDocuments ? files.additionalDocuments.name : "No file uploaded"}
            </span>
          </div>
          <div>
            <label className="font-semibold">Guide Signature:</label>
            <span className="ml-2 text-sm text-gray-600">
              {files.guideSignature ? files.guideSignature.name : "No file uploaded"}
            </span>
          </div>
          <div>
            <label className="font-semibold">Uploaded PDFs:</label>
            <FilePreview files={files.pdfDocuments} type="PDF" />
          </div>
          <div>
            <label className="font-semibold">Uploaded ZIPs:</label>
            <FilePreview files={files.zipFiles} type="ZIP" />
          </div>
        </div>
      )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-between">
        {!viewOnly && (
          <>
            <button onClick={handleSubmit} className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
              Submit
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
