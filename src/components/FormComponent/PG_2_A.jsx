import React, { useState , useEffect} from 'react';
import axios from 'axios';

const PG_2_A = ({ viewOnly = false, data = null }) => {
  const [formData, setFormData] = useState(() => {
    if (viewOnly && data) {
      return {
        organizingInstitute: data.organizingInstitute || '',
        projectTitle: data.projectTitle || '',
        teamName: data.teamName || '',
        guideName: data.guideName || '',
        department: data.department || '',
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
          : [{
              name: '',
              class: '',
              division: '',
              branch: '',
              rollNo: '',
              mobileNo: '',
            }],
        expenses: data.expenses?.length
          ? data.expenses.map(expense => ({
              description: expense.description || '',
              amount: expense.amount || '',
            }))
          : [{
              description: '',
              amount: '',
            }],
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
      };
    }
  
    // Default values if not viewOnly or no data
    return {
      organizingInstitute: '',
      projectTitle: '',
      teamName: '',
      guideName: '',
      department: '',
      date: '',
      hodRemarks: '',
      studentDetails: [{
        name: '',
        class: '',
        division: '',
        branch: '',
        rollNo: '',
        mobileNo: '',
      }],
      expenses: [{
        description: '',
        amount: '',
      }],
      bankDetails: {
        beneficiary: '',
        ifsc: '',
        bankName: '',
        branch: '',
        accountType: '',
        accountNumber: '',
      },
      status: 'pending',
      svvNetId: '',
    };
  });
  
  const [files, setFiles] = useState(() => {
    if (viewOnly && data) {
      return {
        bills: data.files?.bills || [],
        zips: data.files?.zips || [],
        studentSignature: data.files?.studentSignature || null,
        guideSignature: data.files?.guideSignature || null,
      };
    }
    return {
      bills: [],
      zips: [],
      studentSignature: null,
      guideSignature: null,
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (!viewOnly) {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleStudentChange = (index, field, value) => {
    if (viewOnly) return;
    const newStudents = [...formData.studentDetails];
    newStudents[index][field] = value;
    setFormData(prev => ({ ...prev, studentDetails: newStudents }));
  };

  const handleExpenseChange = (index, field, value) => {
    if (viewOnly) return;
  
    // Validate amount input
    if (field === 'amount') {
      // Allow empty string (for clearing input)
      if (value !== '') {
        // Prevent non-numeric or negative
        const num = Number(value);
        if (isNaN(num) || num < 0) return;
        value = num; // convert to number for consistent type
      }
    }
    const newExpenses = [...formData.expenses];
    newExpenses[index] = {
      ...newExpenses[index],
      [field]: value,
    };
    setFormData(prev => ({ ...prev, expenses: newExpenses }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    if (!viewOnly) {
      setFormData(prev => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [name]: value }
      }));
    }
  };

  const handleFileChange = (field, event) => {
    const selectedFiles = event.target.files;
  
    setFiles((prevFiles) => {
      if (field === 'bills' || field === 'zips') {
        return {
          ...prevFiles,
          [field]: [...prevFiles[field], ...Array.from(selectedFiles)],
        };
      } else {
        return {
          ...prevFiles,
          [field]: selectedFiles[0],
        };
      }
    });
  };

  const addStudent = () => {
    if (viewOnly) return;
    setFormData(prev => ({
      ...prev,
      studentDetails: [...prev.studentDetails, {
        name: '',
        class: '',
        division: '',
        branch: '',
        rollNo: '',
        mobileNo: ''
      }]
    }));
  };

  const addExpense = () => {
    if (viewOnly) return;
    setFormData(prev => ({
      ...prev,
      expenses: [...prev.expenses, { description: '', amount: '' }],
    }));
  };

  const validateForm = () => {
    // Validate basic required text fields
    const requiredFields = [
      "projectTitle",
      "teamName",
      "guideName",
      "department",
      "organizingInstitute"
    ];
    for (const field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === "") {
        alert(`Please fill the field: ${field}`);
        return false;
      }
    }
    if (!formData.expenses || formData.expenses.length === 0) {
      alert("Please add at least one expense.");
      return false;
    }
    // Validate studentDetails array
    if (!formData.studentDetails || formData.studentDetails.length === 0) {
      alert("Please add at least one student detail.");
      return false;
    }
    for (let i = 0; i < formData.studentDetails.length; i++) {
      const student = formData.studentDetails[i];
      if (!student.name || student.name.trim() === "") {
        alert(`Student ${i + 1}: Name is required.`);
        return false;
      }
      if (!student.class || student.class.trim() === "") {
        alert(`Student ${i + 1}: Class is required.`);
        return false;
      }
      if (!student.division || student.division.trim() === "") {
        alert(`Student ${i + 1}: Division is required.`);
        return false;
      }
      if (!student.branch || student.branch.trim() === "") {
        alert(`Student ${i + 1}: Branch is required.`);
        return false;
      }
      if (!student.rollNo || student.rollNo.trim() === "") {
        alert(`Student ${i + 1}: Roll Number is required.`);
        return false;
      }
      if (!student.mobileNo || !/^\d{10}$/.test(student.mobileNo.trim())) {
        alert(`Student ${i + 1}: Valid 10-digit Mobile Number is required.`);
        return false;
      }
    }
  
    // Validate expenses array
    if (!formData.expenses || formData.expenses.length === 0) {
      alert("Please add at least one expense detail.");
      return false;
    }
    for (let i = 0; i < formData.expenses.length; i++) {
      const expense = formData.expenses[i];
      if (!expense.description || expense.description.trim() === "") {
        alert(`Expense ${i + 1}: Description is required.`);
        return false;
      }
      if (
        expense.amount === undefined ||
        expense.amount === null ||
        expense.amount === "" ||
        isNaN(expense.amount) ||
        Number(expense.amount) <= 0
      ) {
        alert(`Expense ${i + 1}: Amount must be a positive number.`);
        return false;
      }
    }
  
    // Validate bank details
    const bank = formData.bankDetails || {};
    if (!bank.beneficiary || bank.beneficiary.trim() === "") {
      alert("Bank Beneficiary name, address and mobile number is required.");
      return false;
    }
    if (!bank.ifsc || !/^[A-Za-z]{4}\d{7}$/.test(bank.ifsc.trim())) {
      alert("Valid IFSC code is required.");
      return false;
    }
    if (!bank.bankName || bank.bankName.trim() === "") {
      alert("Bank name is required.");
      return false;
    }
    if (!bank.branch || bank.branch.trim() === "") {
      alert("Bank branch is required.");
      return false;
    }
    if (!bank.accountType || bank.accountType.trim() === "") {
      alert("Account type is required.");
      return false;
    }
    if (
      !bank.accountNumber ||
      !/^\d{9,18}$/.test(bank.accountNumber.trim())
    ) {
      alert("Valid bank account number is required (9 to 18 digits).");
      return false;
    }
  
    // Validate files
  
    // bills (array, max 5 PDFs)
    if (!files.bills || files.bills.length === 0) {
      alert("Please upload at least one Bill PDF file.");
      return false;
    }
    if (files.bills.length > 5) {
      alert("You can upload maximum 5 Bill PDF files.");
      return false;
    }
    for (let file of files.bills) {
      if (file.type !== "application/pdf") {
        alert(`Bill file ${file.name} must be a PDF.`);
        return false;
      }
    }
  
    // zips (array, max 2 ZIP files)
    if (files.zips && files.zips.length > 2) {
      alert("You can upload maximum 2 ZIP files.");
      return false;
    }
    for (let file of files.zips || []) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        alert(`ZIP file ${file.name} must have .zip extension.`);
        return false;
      }
    }
  
    // studentSignature (required image)
    if (!files.studentSignature) {
      alert("Please upload Student Signature image.");
      return false;
    }
    if (!files.studentSignature.type.startsWith("image/")) {
      alert("Student Signature must be an image file.");
      return false;
    }
  
    // guideSignature (required image)
    if (!files.guideSignature) {
      alert("Please upload Guide Signature image.");
      return false;
    }
    if (!files.guideSignature.type.startsWith("image/")) {
      alert("Guide Signature must be an image file.");
      return false;
    }
  
    // All validations passed
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (viewOnly) return;
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

    // Check if svvNetId is available before attempting to submit
    if (!svvNetId) {
      setUserMessage({ text: "Authentication error: User ID (svvNetId) not found. Please log in.", type: "error" });
      return;
    }
    try {
      const formPayload = new FormData();
      formPayload.append('svvNetId',svvNetId);
      // Append flat string fields
      [
        "projectTitle", "teamName", "guideName", "department", "date",
        "hodRemarks", "organizingInstitute", "amountClaimed", "status",
        "amountRecommended", "comments", "finalAmount"
      ].forEach(key => {
        formPayload.append(key, formData[key] || '');
      });
  
      // Append structured fields
      formPayload.append("bankDetails", JSON.stringify(formData.bankDetails));
      formPayload.append("studentDetails", JSON.stringify(formData.studentDetails));
      formPayload.append("expenses", JSON.stringify(formData.expenses));
  
      // Append files
      (files.bills || []).slice(0, 10).forEach(file => {
        formPayload.append("bills", file);
      });
  
      if (files.studentSignature) formPayload.append("studentSignature", files.studentSignature);
      if (files.guideSignature) formPayload.append("guideSignature", files.guideSignature);
  
      // Debug payload keys and values (files will just show file names)
      for (let [key, value] of formPayload.entries()) {
        console.log(key, value);
      }
  
      const response = await axios.post(
        "http://localhost:5000/api/pg2aform/submit",
        formPayload,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
  
      alert("PG2A Form submitted successfully!");
    } catch (error) {
      if (error.response) {
        console.error("Backend error response data:", error.response.data);
        alert(`Failed to submit PG2A form: ${error.response.data.message || JSON.stringify(error.response.data)}`);
      } else {
        console.error("Error submitting PG2A form:", error);
        alert("Failed to submit PG2A form. Please check your data and try again.");
      }
    }
  };
  
  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Post Graduate Form 2A - Project Competition</h1>
      
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
            disabled={viewOnly}
            className="w-full p-2 border border-gray-300 rounded"
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
            disabled={viewOnly}
            className="w-full p-2 border border-gray-300 rounded"
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
            disabled={viewOnly}
            className="w-full p-2 border border-gray-300 rounded"
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
            disabled={viewOnly}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        {/* Department */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">Department:</label>
          <input
            type="text"
            name="department"
            value={formData.department}
            onChange={handleChange}
            disabled={viewOnly}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        {/* Student Details Table */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Student Details</h3>
          <table className="w-full mb-4 border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border border-gray-300">Name of the student</th>
                <th className="p-2 border border-gray-300">Class</th>
                <th className="p-2 border border-gray-300">Div</th>
                <th className="p-2 border border-gray-300">Branch</th>
                <th className="p-2 border border-gray-300">Roll No.</th>
                <th className="p-2 border border-gray-300">Mobile No.</th>
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
                        disabled={viewOnly}
                        className="w-full p-1 border border-gray-300 rounded"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!viewOnly && (
            <button onClick={addStudent} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Add Student
            </button>
          )}
        </div>

        {/* Expenses */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Details of expenses (attach bills in order):</h3>
          <table className="w-full mb-4 border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border border-gray-300">Sr. No.</th>
                <th className="p-2 border border-gray-300">Description</th>
                <th className="p-2 border border-gray-300">Amount (Rs.)</th>
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
                      disabled={viewOnly}
                      className="w-full p-1 border border-gray-300 rounded"
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="number"
                      value={expense.amount}
                      onChange={(e) => handleExpenseChange(index, 'amount', e.target.value)}
                      disabled={viewOnly}
                      className="w-full p-1 border border-gray-300 rounded"
                      min="0"
                      step="0.01"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="p-2 border border-gray-300 font-semibold">Total</td>
                <td className="p-2 border border-gray-300"></td>
                <td className="p-2 border border-gray-300">
                  {formData.expenses
                    .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0)
                    .toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
          {!viewOnly && (
            <button onClick={addExpense} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Add Expense
            </button>
          )}
        </div>

        {/* Bank Details */}
        <table className="w-full mb-6 border border-gray-300">
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
                    disabled={viewOnly}
                    className="w-full p-1 border border-gray-300 rounded"
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
            <div className="flex items-center">
              <label
                className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer ${
                  viewOnly ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-600'
                }`}
              >
                Choose PDFs
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  multiple
                  disabled={viewOnly}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
                    if (selected.length + files.bills.length > 5) {
                      alert('You can upload a maximum of 5 PDF files.');
                      return;
                    }
                    handleFileChange('bills', {
                      ...e,
                      target: { ...e.target, files: selected }
                    });
                  }}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.bills.length > 0 ? `${files.bills.length} PDF file${files.bills.length > 1 ? 's' : ''} chosen` : 'No files chosen'}
              </span>
            </div>
          </div>

          {/* ZIP Files (max 2) */}
          <div>
            <label className="block font-semibold mb-2">Attach additional ZIP files – Max 2:</label>
            <div className="flex items-center">
              <label
                className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer ${
                  viewOnly ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-600'
                }`}
              >
                Choose ZIPs
                <input
                  type="file"
                  className="hidden"
                  accept=".zip"
                  multiple
                  disabled={viewOnly}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files).filter(file => file.name.endsWith('.zip'));
                    if (selected.length + files.zips.length > 2) {
                      alert('You can upload a maximum of 2 ZIP files.');
                      return;
                    }
                    handleFileChange('zips', {
                      ...e,
                      target: { ...e.target, files: selected }
                    });
                  }}
                />
              </label>
              <span className="ml-2 text-sm">
                {files.zips.length > 0 ? `${files.zips.length} ZIP file${files.zips.length > 1 ? 's' : ''} chosen` : 'No files chosen'}
              </span>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4">
            {/* Student Signature */}
            <div>
              <label className="block font-semibold mb-2">Signature of Student</label>
              <div className="flex items-center">
                <label
                  className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer ${
                    viewOnly ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-600'
                  }`}
                >
                  Choose File
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={viewOnly}
                    onChange={(e) => handleFileChange('studentSignature', e)}
                  />
                </label>
                <span className="ml-2 text-sm">
                  {files.studentSignature ? files.studentSignature.name : 'No file chosen'}
                </span>
              </div>
            </div>

            {/* Guide Signature */}
            <div>
              <label className="block font-semibold mb-2">Signature of Guide</label>
              <div className="flex items-center">
                <label
                  className={`bg-blue-500 text-white px-4 py-2 rounded cursor-pointer ${
                    viewOnly ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-600'
                  }`}
                >
                  Choose File
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={viewOnly}
                    onChange={(e) => handleFileChange('guideSignature', e)}
                  />
                </label>
                <span className="ml-2 text-sm">
                  {files.guideSignature ? files.guideSignature.name : 'No file chosen'}
                </span>
              </div>
            </div>
          </div>
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

export default PG_2_A;