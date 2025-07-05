import React, { useState , useEffect} from 'react';

const UG_3_B = ({ viewOnly = false, data = null }) => {
  const [formData, setFormData] = useState(() => {
    if (viewOnly && data) {
      return {
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        feesPaid: data.feesPaid || 'No',
        projectTitle: data.projectTitle || '',
        guideName: data.guideName || '',
        employeeCode: data.employeeCode || '',
        conferenceDate: data.conferenceDate || '',
        organization: data.organization || '',
        publisher: data.publisher || '',
        paperLink: data.paperLink || '',
        authors: data.authors || ['', '', '', ''],
        bankDetails: data.bankDetails || {
          beneficiary: '',
          ifsc: '',
          bankName: '',
          branch: '',
          accountType: '',
          accountNumber: ''
        },
        registrationFee: data.registrationFee || '',
        previousClaim: data.previousClaim || 'No',
        claimDate: data.claimDate || '',
        amountReceived: data.amountReceived || '',
        amountSanctioned: data.amountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
        department: data.department || '',
      };
    } else {
      return {
        studentName: '',
        yearOfAdmission: '',
        feesPaid: 'No',
        projectTitle: '',
        guideName: '',
        employeeCode: '',
        conferenceDate: '',
        organization: '',
        publisher: '',
        paperLink: '',
        authors: ['', '', '', ''],
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
        department: '', 
      };
    }
  });
  
  useEffect(() => {
    if (viewOnly && data) {
      setFormData({
        studentName: data.studentName || '',
        yearOfAdmission: data.yearOfAdmission || '',
        feesPaid: data.feesPaid || 'No',
        projectTitle: data.projectTitle || '',
        guideName: data.guideName || '',
        employeeCode: data.employeeCode || '',
        conferenceDate: data.conferenceDate || '',
        organization: data.organization || '',
        publisher: data.publisher || '',
        paperLink: data.paperLink || '',
        authors: data.authors || ['', '', '', ''],
        bankDetails: data.bankDetails || {
          beneficiary: '',
          ifsc: '',
          bankName: '',
          branch: '',
          accountType: '',
          accountNumber: ''
        },
        registrationFee: data.registrationFee || '',
        previousClaim: data.previousClaim || 'No',
        claimDate: data.claimDate || '',
        amountReceived: data.amountReceived || '',
        amountSanctioned: data.amountSanctioned || '',
        status: data.status || 'pending',
        svvNetId: data.svvNetId || '',
        department: data.department || '', 
      });
  
      setFiles({
        paperCopy: data.paperCopy || null,
        groupLeaderSignature: data.groupLeaderSignature || null,
        guideSignature: data.guideSignature || null,
        pdfFileUrls: data.pdfFileUrls || [],
        zipFile: data.zipFile || null
      });
    }
  }, [data, viewOnly]);
  
  const [files, setFiles] = useState({
    paperCopy: null,
    groupLeaderSignature: null,
    guideSignature: null,
    pdfFileUrls: [], // ✅ Rename this to match the backend processed field
    zipFile: null    // ✅ Single object, not an array
  });
  const [errors, setErrors] = useState({});
  
  const handleChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBankChange = (e) => {
    if (viewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: { ...prev.bankDetails, [name]: value }
    }));
  };
  
  const [userRole, setUserRole] = useState(null);
  const isStudent = userRole === 'student';
  const [userDepartment, setUserDepartment] = useState(null); // ✅ New
  // Fetch role from localStorage
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
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        setUserRole(user.role);
        setUserDepartment(user.branch || '');  // ✅ Fetch department
      } catch (err) {
        console.error("Failed to parse user data from local storage:", err);
      }
    }
  }, []);

  const handleAuthorChange = (index, value) => {
    if (viewOnly) return;
    const newAuthors = [...formData.authors];
    newAuthors[index] = value;
    setFormData(prev => ({ ...prev, authors: newAuthors }));
  };
  
  const handleFileChange = (field, e) => {
    if (viewOnly) return;
    const selectedFiles = Array.from(e.target.files);
  
    // Validate file sizes
    for (const file of selectedFiles) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Each file must be under 5MB");
        return;
      }
    }
  
    if (field === 'pdfDocuments') {
      if (selectedFiles.length > 5) {
        alert("You can upload a maximum of 5 PDF files");
        return;
      }
      setFiles(prev => ({ ...prev, [field]: selectedFiles }));
    } else if (field === 'zipFiles') {
      if (selectedFiles.length > 2) {
        alert("You can upload a maximum of 2 ZIP files");
        return;
      }
      setFiles(prev => ({ ...prev, [field]: selectedFiles }));
    } else {
      const file = selectedFiles[0];
      setFiles(prev => ({ ...prev, [field]: file }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
  
    // Required fields
    if (!formData.studentName.trim()) newErrors.studentName = 'Student name is required';
    if (!formData.yearOfAdmission.trim()) newErrors.yearOfAdmission = 'Year of admission is required';
    if (!formData.projectTitle.trim()) newErrors.projectTitle = 'Project title is required';
    if (!formData.guideName.trim()) newErrors.guideName = 'Guide name is required';
    if (!formData.employeeCode.trim()) newErrors.employeeCode = 'Employee code is required';
    if (!formData.conferenceDate.trim()) newErrors.conferenceDate = 'Conference date is required';
    if (!formData.organization.trim()) newErrors.organization = 'Organization name is required';
    if (!formData.publisher.trim()) newErrors.publisher = 'Publisher name is required';
    if (!formData.registrationFee.trim()) newErrors.registrationFee = 'Registration fee is required';
  
    if (
      formData.paperLink.trim() &&
      !/^https?:\/\/\S+\.\S+$/.test(formData.paperLink.trim()) &&
      formData.paperLink.trim().toLowerCase() !== 'no'
    ) {
      newErrors.paperLink = 'Invalid paper link URL';
    }
  
    // Author validation: at least one author is required
    const nonEmptyAuthors = formData.authors.filter(author => author.trim() !== '');
    if (nonEmptyAuthors.length === 0) {
      newErrors.author0 = 'At least one author name is required';
    }
  
    // Optional: log specific empty authors (only for debugging)
    formData.authors.forEach((author, idx) => {
      if (!author.trim() && idx < nonEmptyAuthors.length) {
        newErrors[`author${idx}`] = `Author ${idx + 1} name is required`;
      }
    });
  
    const { beneficiary, ifsc, bankName, branch, accountType, accountNumber } = formData.bankDetails;
    if (!beneficiary.trim()) newErrors.beneficiary = 'Beneficiary name is required';
    if (!ifsc.trim()) newErrors.ifsc = 'IFSC code is required';
    if (!bankName.trim()) newErrors.bankName = 'Bank name is required';
    if (!branch.trim()) newErrors.branch = 'Branch is required';
    if (!accountType.trim()) newErrors.accountType = 'Account type is required';
    if (!accountNumber.trim()) newErrors.accountNumber = 'Account number is required';
  
    if (formData.previousClaim === 'Yes') {
      if (!formData.claimDate.trim()) newErrors.claimDate = 'Claim date is required';
      if (!formData.amountReceived.trim()) newErrors.amountReceived = 'Amount received is required';
      if (!formData.amountSanctioned.trim()) newErrors.amountSanctioned = 'Amount sanctioned is required';
    }
  
    if (!files.paperCopy) newErrors.paperCopy = 'Paper copy is required';
    if (!files.groupLeaderSignature) newErrors.groupLeaderSignature = 'Group leader signature is required';
    if (!files.guideSignature) newErrors.guideSignature = 'Guide signature is required';
  
    // ✅ Log all validation errors to debug
    console.log("❌ Validation Errors:", newErrors);
  
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async () => {
    console.log('handleSubmit called');

    const valid = validateForm();
    console.log('validateForm result:', valid);
    if (!valid) return;

    if (viewOnly) {
      console.log('Form is view only, submission blocked');
      return;
    }

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

    if (!svvNetId) {
      setUserMessage({ text: "Authentication error: User ID (svvNetId) not found. Please log in.", type: "error" });
      return;
    }

    console.log('formData:', formData);
    console.log('files:', files);

    const submitData = new FormData();
    submitData.append('svvNetId', svvNetId); 
    submitData.append('department', userDepartment); // ✅ Only append once

    // Append regular fields
    for (const key in formData) {
      if (key === 'svvNetId' || key === 'department') continue; // ✅ Skip both

      if (key === 'authors') {
        formData.authors
          .filter(author => author.trim() !== '')
          .forEach(author => {
            submitData.append('authors', author);
          });
      } else if (key === 'bankDetails') {
        submitData.append('bankDetails', JSON.stringify(formData.bankDetails));
      } else {
        submitData.append(key, formData[key]);
      }
   }

    // Append single files
    ['paperCopy', 'groupLeaderSignature', 'guideSignature', 'additionalDocuments'].forEach(key => {
      if (files[key]) {
        console.log(`Appending file: ${key}`, files[key]);
        submitData.append(key, files[key]);
      }
    });

    // Append multiple files
    if (files.pdfDocuments && files.pdfDocuments.length > 0) {
      files.pdfDocuments.slice(0, 5).forEach(file => {
        console.log(`Appending pdfDocuments`, file);
        submitData.append('pdfDocuments', file);
      });
    }

    if (files.zipFiles && files.zipFiles.length > 0) {
      files.zipFiles.slice(0, 2).forEach(file => {
        console.log(`Appending zipFiles`, file);
        submitData.append('zipFiles', file);
      });
    }

    try {
      const response = await fetch('http://localhost:5000/api/ug3bform/submit', {
        method: 'POST',
        body: submitData,
      });

      if (response.ok) {
        alert('Form submitted successfully!');
        console.log(await response.json());
      } else {
        const errorText = await response.text();
        console.error('Server responded with error:', response.status, errorText);
        alert('Submission failed: ' + errorText);
      }
    } catch (error) {
      console.error('Form submission failed:', error);
      alert('Submission failed. Please try again.');
    }
  };

  const inputClasses = viewOnly 
    ? "w-full p-1 border border-gray-300 rounded bg-gray-100 cursor-not-allowed" 
    : "w-full p-1 border border-gray-300 rounded";

  const selectClasses = viewOnly 
    ? "w-full p-1 border border-gray-300 rounded bg-gray-100 cursor-not-allowed" 
    : "w-full p-1 border border-gray-300 rounded";

  return (
    <div className="form-container max-w-4xl mx-auto p-5 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Under Graduate Form 3B - Reputed Conference
        {viewOnly && <span className="text-red-600 ml-2">(Read Only)</span>}
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
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Year of Admission</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="yearOfAdmission"
                  value={formData.yearOfAdmission}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Whether Paid fees for Current Academic Year</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="feesPaid"
                  value={formData.feesPaid}
                  onChange={handleChange}
                  className={selectClasses}
                  disabled={viewOnly}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Title of the Project</th>
              <td colSpan="5" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="projectTitle"
                  value={formData.projectTitle}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Guide and Conference Information */}
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
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Employee Code:</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="employeeCode"
                  value={formData.employeeCode}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Date of Conference / Project Competition</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="date"
                  name="conferenceDate"
                  value={formData.conferenceDate}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Name and address of organization / institution</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Publisher Information */}
        <table className="w-full mb-6 border border-gray-300">
          <tbody>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Name and Address of the Publisher (For address one may give website address)</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="publisher"
                  value={formData.publisher}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">If paper is available online, then state link</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="url"
                  name="paperLink"
                  value={formData.paperLink}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Authors */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {formData.authors.map((author, index) => (
            <div key={index}>
              <label className="block font-semibold mb-1">Author {index + 1} Name</label>
              <input
                type="text"
                value={author}
                onChange={(e) => handleAuthorChange(index, e.target.value)}
                className={inputClasses}
                disabled={viewOnly}
              />
            </div>
          ))}
        </div>

        <p className="text-sm italic mb-6 text-gray-600">*Attach a copy of paper published / presented / proof of participation in project competition along with the Reimbursement Form</p>

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
                  className={inputClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  placeholder="Rs.___________"
                  disabled={viewOnly}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Have you claimed previously for any paper / project competition under this scheme:</th>
              <td className="p-2 border border-gray-300">
                <select
                  name="previousClaim"
                  value={formData.previousClaim}
                  onChange={handleChange}
                  className={selectClasses}
                  disabled={viewOnly}
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
                  className={inputClasses}
                  disabled={viewOnly}
                />
              </td>
              <th className="p-2 border border-gray-300 bg-gray-100">Amount Received</th>
              <td className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="amountReceived"
                  value={formData.amountReceived}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Rs.___________"
                  disabled={viewOnly}
                />
              </td>
            </tr>
            <tr>
              <th className="p-2 border border-gray-300 bg-gray-100">Amount sanctioned</th>
              <td colSpan="7" className="p-2 border border-gray-300">
                <input
                  type="text"
                  name="amountSanctioned"
                  value={formData.amountSanctioned}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Rs.___________"
                  disabled={viewOnly}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mb-6 text-gray-700">The participation by the BE / B. Tech student was relevant to their Final Year BE / B. Tech project and affiliation to the institute was clearly mentioned.</p>
        {/* File Uploads */}
        {!viewOnly && (
          <div className="mb-6 space-y-4">
            {/* Paper Copy */}
            <div>
              <label className="block font-semibold mb-2">*Attach proof documents:</label>
              <div className="flex items-center">
                <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                  Choose Paper Copy
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileChange('paperCopy', e)}
                  />
                </label>
                <span className="ml-2 text-sm">
                  {files.paperCopy ? files.paperCopy.name : "No file chosen"}
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Signature of Group Leader (JPEG Only)</label>
                <div className="flex items-center">
                  <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg"
                      onChange={(e) => handleFileChange('groupLeaderSignature', e)}
                    />
                  </label>
                  <span className="ml-2 text-sm">
                    {files.groupLeaderSignature ? files.groupLeaderSignature.name : "No file chosen"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-2">Signature of Guide (JPEG Only)</label>
                <div className="flex items-center">
                  <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg"
                      onChange={(e) => handleFileChange('guideSignature', e)}
                    />
                  </label>
                  <span className="ml-2 text-sm">
                    {files.guideSignature ? files.guideSignature.name : "No file chosen"}
                  </span>
                </div>
              </div>
            </div>

            {/* Multiple PDF Uploads */}
            <div>
              <label className="block font-semibold mb-2">Upload PDF Documents (Max 5 files)</label>
              <div className="flex items-center">
                <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                  Choose PDF Files
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    multiple
                    onChange={(e) => handleFileChange('pdfDocuments', e)}
                  />
                </label>
                <span className="ml-2 text-sm">
                  {files.pdfDocuments?.length
                    ? `${files.pdfDocuments.length} file(s) selected`
                    : "No files chosen"}
                </span>
              </div>
            </div>

            {/* Multiple ZIP Uploads */}
            <div>
              <label className="block font-semibold mb-2">Upload ZIP Files (Max 2 files)</label>
              <div className="flex items-center">
                <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
                  Choose ZIP Files
                  <input
                    type="file"
                    className="hidden"
                    accept=".zip"
                    multiple
                    onChange={(e) => handleFileChange('zipFiles', e)}
                  />
                </label>
                <span className="ml-2 text-sm">
                  {files.zipFiles?.length
                    ? `${files.zipFiles.length} file(s) selected`
                    : "No files chosen"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Readonly file display */}
        {viewOnly && (
          <div className="mb-6 space-y-4">
            <div>
              <label className="block font-semibold mb-2">Attached Documents:</label>

              {userRole !== 'student' ? (
                <div className="bg-gray-100 p-3 rounded border space-y-2">

                  {/* Paper Copy */}
                  {files.paperCopy && (
                    <p>
                      Paper Copy: <a href={files.paperCopy.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View File</a>
                    </p>
                  )}

                  {/* Group Leader Signature */}
                  {files.groupLeaderSignature && (
                    <p>
                      Group Leader Signature: <a href={files.groupLeaderSignature.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View File</a>
                    </p>
                  )}

                  {/* Guide Signature */}
                  {files.guideSignature && (
                    <p>
                      Guide Signature: <a href={files.guideSignature.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">View File</a>
                    </p>
                  )}

                  {/* PDF Files */}
                  {files.pdfFileUrls && files.pdfFileUrls.length > 0 && (
                    <div>
                      <p>PDF Documents:</p>
                      <ul className="list-disc ml-5">
                        {files.pdfFileUrls.map((file, idx) => (
                          <li key={idx}>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                              {file.originalName || file.filename}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ZIP File */}
                  {files.zipFile && (
                    <div>
                      <p>ZIP File:</p>
                      <ul className="list-disc ml-5">
                        <li>
                          <a href={files.zipFile.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                            {files.zipFile.originalName || files.zipFile.filename}
                          </a>
                        </li>
                      </ul>
                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded border">
                  <p className="text-sm text-gray-600">Document previews are not available for students in read-only mode.</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Form Actions */}
        <div className="flex justify-between">
          <button 
            onClick={() => window.history.back()} 
            className="back-btn bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
          >
            Back
          </button>
          {!viewOnly && (
            <button 
              onClick={handleSubmit} 
              className="submit-btn bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UG_3_B;