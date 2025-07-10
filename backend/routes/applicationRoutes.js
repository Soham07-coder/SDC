import express from "express";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb"; // Import GridFSBucket

// Import all your form models here
import UG1Form from "../models/UG1Form.js";
import UGForm2 from "../models/UGForm2.js";
import UG3AForm from "../models/UG3AForm.js"; // IMPORT UG3AForm
import UG3BForm from "../models/UG3BForm.js";
import PG1Form from "../models/PG1Form.js";
import PG2AForm from "../models/PG2AForm.js";
import PG2BForm from "../models/PG2BForm.js";
import R1Form from "../models/R1Form.js"; // Import R1Form

const router = express.Router();
const conn = mongoose.connection;

let gfsBucket; // Consistent naming for GridFSBucket instance

const fileBaseUrlMapper = {
    "UG_1": "/api/ug1form/uploads/files",
    "UG_2": "/api/ug2form/uploads/files",
    "UG_3_A": "/api/ug3aform/file", 
    "UG_3_B": "/api/ug3bform/file",
    "PG_1": "/api/pg1form/uploads/files",
    "PG_2_A": "/api/pg2aform/file",
    "PG_2_B": "/api/pg2bform/files",
    "R1": "/api/r1form/uploads/files",
};

const bucketMapper = {
    "UG_1": "uploads",
    "UG_2": "uploads",
    "UG_3_A": "uploads",
    "UG_3_B": "ug3bFiles", // UG3B has a dedicated bucket
    "PG_1": "pg1files",
    "PG_2_A": "pg2afiles",
    "PG_2_B": "pg2bfiles",
    "R1": "r1files",
};

// Initialize GridFSBucket once the MongoDB connection is open
conn.once("open", () => {
    // IMPORTANT: Ensure this bucketName matches where your files are actually stored.
    // If your R1Form backend uses 'r1files' bucket, you'll need to adapt this,
    // or ensure all forms write to 'uploads'. Consistency is key.
    gfsBucket = new GridFSBucket(conn.db, { bucketName: "uploads" });
    console.log("✅ GridFSBucket initialized in application routes (using 'uploads' bucket)");
});

/**
 * Helper: Fetches file details from GridFS and constructs its URL.
 * This function uses the 'gfsBucket' instance to query the 'uploads.files' collection
 * to find file metadata by ID and then constructs a URL for serving the file.
 * @param {mongoose.Types.ObjectId | string} fileId - The GridFS file ID.
 * @param {string} baseUrlForServingFile - The base URL for serving files from this endpoint (e.g., "/api/application/file").
 * @param {Object} gfsBucket - The GridFS bucket instance for file operations.
 * @returns {Promise<{id: string, originalName: string, filename: string, mimetype: string, size: number, url: string} | null>} - File details or null.
 */
const getFileDetailsAndUrl = async (fileId, baseUrlForServingFile, formType, mongooseConnection) => {
    console.log(`\n🔍 getFileDetailsAndUrl Called`);
    console.log(`🔑 Received fileId: ${fileId}`);
    console.log(`🌐 Base URL: ${baseUrlForServingFile}`);
    console.log(`🗂️ Form Type: ${formType}`);

    if (!fileId) {
        console.warn(`❌ fileId is null/undefined for baseUrl: ${baseUrlForServingFile}.`);
        return null;
    }

    const isValidObjectId = mongoose.Types.ObjectId.isValid(fileId);
    console.log(`✅ ObjectId valid: ${isValidObjectId}`);

    if (!isValidObjectId) {
        console.warn(`❌ Invalid ObjectId format: ${fileId}`);
        return null;
    }

    // Select correct bucket based on form type
    const bucketName = bucketMapper[formType] || 'uploads';
    console.log(`🪣 Using GridFS bucket: ${bucketName}`);

    const gfsBucket = new mongoose.mongo.GridFSBucket(mongooseConnection.db, { bucketName });

    try {
        //console.log(`🔍 Searching in GridFS with ID: ${fileId}...`);
        const files = await gfsBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();

        //console.log(`📂 Files found:`, files);

        if (files.length > 0) {
            const fileData = files[0];
            //console.log(`✅ File found: "${fileData.filename}" with ID: "${fileId}".`);

            return {
                id: fileData._id.toString(),
                originalName: fileData.metadata?.originalName || fileData.filename,
                filename: fileData.filename,
                mimetype: fileData.contentType,
                size: fileData.length,
                url: `${baseUrlForServingFile}/${fileData._id.toString()}?bucket=${bucketName}`, // ✅ Attach bucket name in URL
            };
        } else {
            console.warn(`❌ File with ID "${fileId}" not found in the GridFS bucket.`);
        }
    } catch (error) {
        console.error(`🚨 Error while fetching file with ID "${fileId}":`, error);
    }

    return null;
};
/**
 * Helper: Processes a raw form object to include file URLs and standardizes fields for display.
 * @param {Object} form - The raw Mongoose document (after .lean() or .toObject())
 * @param {string} formType - The type of the form (e.g., "UG_1", "UG_2", "UG_3_A", "R1")
 * @param {string} [userBranchFromRequest] - Optional: The branch of the currently logged-in user, passed from the frontend.
 * @param {Object} gfsBucket - The GridFS bucket instance for file operations.
 * @returns {Promise<Object>} - The processed form object with URLs and standardized fields.
 */
const processFormForDisplay = async (form, formType, userBranchFromRequest,gfsBucket, userRole) => {
    let processedForm = { ...form };

    const ACCESS_LEVELS = {
        STUDENT: 'student',
        VALIDATOR: 'validator',
        ADMIN: 'admin',
        PRINCIPAL: 'principal',
        HOD: 'hod',
        INSTITUTE_COORDINATOR: 'institute coordinator',
        DEPARTMENT_COORDINATOR: 'department coordinator' // <-- ADD THIS
    };

    const isStudent = (userRole || "").toLowerCase() === "student";

    const getObjectIdString = (idField) => {
        if (typeof idField === 'string') return idField;
        if (idField && typeof idField === 'object' && idField.$oid) return idField.$oid;
        if (idField && mongoose.Types.ObjectId.isValid(idField)) return idField.toString();
        return null;
    };


    processedForm._id = form._id?.$oid || form._id?.toString() || form._id;

    processedForm.topic = form.projectTitle || form.paperTitle || form.topic || "Untitled Project";
    processedForm.name = form.studentName || form.applicantName || (form.students?.[0]?.name) || (form.studentDetails?.[0]?.studentName) || "N/A";
    processedForm.branch = userBranchFromRequest || form.branch || form.department || (form.students?.[0]?.branch) || (form.studentDetails?.[0]?.branch) || "N/A";

    processedForm.submitted = form.createdAt?.$date || form.createdAt || form.submittedAt || new Date();
    if (typeof processedForm.submitted === 'string' && !isNaN(new Date(processedForm.submitted))) {
        processedForm.submitted = new Date(processedForm.submitted);
    } else if (!(processedForm.submitted instanceof Date)) {
        processedForm.submitted = new Date();
    }

    processedForm.status = form.status || "pending";
    processedForm.formType = formType;

    const fileBaseUrl = fileBaseUrlMapper[formType] || "/api/uploads/files";

    processedForm.groupLeaderSignature = null;
    processedForm.studentSignature = null;
    processedForm.guideSignature = null;
    processedForm.hodSignature = null;
    processedForm.sdcChairpersonSignature = null;
    processedForm.paperCopy = null;
    processedForm.additionalDocuments = [];
    processedForm.uploadedFiles = [];
    processedForm.pdfFileUrls = [];
    processedForm.zipFile = null;
    processedForm.uploadedImage = null;
    processedForm.uploadedPdfs = [];
    processedForm.bills = [];

    processedForm.guideNames = [];
    processedForm.employeeCodes = [];

    const getFile = async (id) => {
        if (isStudent) {
            console.log(`File access denied for student role for ID: ${id}`);
            return null;
        }
        const isValid = mongoose.Types.ObjectId.isValid(id);
        console.log(`🔎 getFile - ID: ${id}, Valid: ${isValid}`);
        return await getFileDetailsAndUrl(id, fileBaseUrl, formType, mongoose.connection);
    };

    const getMultipleFiles = async (fileList) => {
        if (isStudent) {
            console.log(`Multiple file access denied for student role for file list.`);
            return [];
        }

        const filePromises = fileList.map(fileMeta => {
            if (!fileMeta) return null;

            // Case: { id: ObjectId }
            if (fileMeta.id && typeof fileMeta.id === 'string') {
                return getFile(fileMeta.id);
            }

            // Case: raw ObjectId string
            if (typeof fileMeta === 'string') {
                return getFile(fileMeta);
            }

            // Case: fileMeta is an ObjectId directly
            if (mongoose.Types.ObjectId.isValid(fileMeta)) {
                return getFile(fileMeta.toString());
            }

            // Case: unknown format (log and ignore)
            console.warn('⚠️ Unrecognized fileMeta format:', fileMeta);
            return null;
        });

        return (await Promise.all(filePromises)).filter(Boolean);
    };

    switch (formType) {
        case "UG_1":
            if (form.pdfFileIds && form.pdfFileIds.length > 0) {
                processedForm.pdfFileUrls = await getMultipleFiles(form.pdfFileIds);
            }
            if (form.groupLeaderSignatureId) {
                processedForm.groupLeaderSignature = await getFile(form.groupLeaderSignatureId);
            }
            if (form.guideSignatureId) {
                processedForm.guideSignature = await getFile(form.guideSignatureId);
            }
            processedForm.guideNames = form.guides ? form.guides.map(g => g.guideName || "") : [];
            processedForm.employeeCodes = form.guides ? form.guides.map(g => g.employeeCode || "") : [];
            break;

        case "UG_2":
            if (form.groupLeaderSignature?.fileId) {
                processedForm.groupLeaderSignature = await getFile(form.groupLeaderSignature.fileId);
            }
            if (form.guideSignature?.fileId) {
                processedForm.guideSignature = await getFile(form.guideSignature.fileId);
            }
            if (form.uploadedFiles && form.uploadedFiles.length > 0) {
                processedForm.uploadedFiles = await getMultipleFiles(form.uploadedFiles.map(f => f.fileId));
            }
            processedForm.projectDescription = form.projectDescription;
            processedForm.utility = form.utility;
            processedForm.receivedFinance = form.receivedFinance;
            processedForm.financeDetails = form.financeDetails;
            processedForm.guideName = form.guideName;
            processedForm.employeeCode = form.employeeCode;
            processedForm.students = form.students;
            processedForm.expenses = form.expenses;
            processedForm.totalBudget = form.totalBudget;
            break;

        case "UG_3_A":
            const uploadedImageId = getObjectIdString(form.uploadedImage?.fileId);
            if (uploadedImageId) processedForm.uploadedImage = await getFile(uploadedImageId);

            if (form.uploadedPdfs && form.uploadedPdfs.length > 0) {
                processedForm.uploadedPdfs = await getMultipleFiles(form.uploadedPdfs.map(f => f.fileId));
            }

            const uploadedZipFileId = getObjectIdString(form.uploadedZipFile?.fileId || form.uploadedZipFile?.id);
            if (uploadedZipFileId) {
                processedForm.zipFile = await getFile(uploadedZipFileId);
            }

            processedForm.organizingInstitute = form.organizingInstitute;
            processedForm.projectTitle = form.projectTitle;
            processedForm.students = form.students;
            processedForm.expenses = form.expenses;
            processedForm.totalAmount = form.totalAmount;
            processedForm.bankDetails = form.bankDetails;
            break;

        case "UG_3_B":
            if (form.pdfDocuments && form.pdfDocuments.length > 0) {
                processedForm.pdfFileUrls = await getMultipleFiles(form.pdfDocuments);
            }
            if (form.zipFiles && form.zipFiles.length > 0) {
                const zipFiles = await getMultipleFiles(form.zipFiles);
                processedForm.zipFile = zipFiles[0] || null;
            }
            if (form.groupLeaderSignature?.id) {
                processedForm.groupLeaderSignature = await getFile(form.groupLeaderSignature.id);
                processedForm.studentSignature = processedForm.groupLeaderSignature;
            }
            if (form.guideSignature?.id) {
                processedForm.guideSignature = await getFile(form.guideSignature.id);
            }
            if (form.paperCopy?.id) {
                processedForm.paperCopy = await getFile(form.paperCopy.id);
            }
            if (form.additionalDocuments && form.additionalDocuments.length > 0) {
                processedForm.additionalDocuments = await getMultipleFiles(form.additionalDocuments);
            }

            processedForm.students = form.students || [];
            processedForm.projectTitle = form.projectTitle;
            processedForm.bankDetails = form.bankDetails || {};
            processedForm.publisher = form.publisher || {};
            processedForm.authors = form.authors || [];
            processedForm.registrationFee = form.registrationFee || '';
            processedForm.previousClaimStatus = form.previousClaimStatus || '';
            processedForm.amountReceived = form.amountReceived || '';
            processedForm.amountSanctioned = form.amountSanctioned || '';
            break;

        case "PG_1":
            processedForm.name = form.studentName || "N/A";
            processedForm.topic = form.sttpTitle || form.projectTitle || form.paperTitle || form.topic || "Untitled Project";

            processedForm.department = form.department || "N/A";
            processedForm.guideName = form.guideName || "N/A";
            processedForm.employeeCode = form.employeeCode || "N/A";
            processedForm.authors = form.authors || [];

            processedForm.bankDetails = form.bankDetails || {};
            processedForm.organizingInstitute = form.organizingInstitute || "N/A";
            processedForm.yearOfAdmission = form.yearOfAdmission || "N/A";
            processedForm.rollNo = form.rollNo || "N/A";
            processedForm.mobileNo = form.mobileNo || "N/A";
            processedForm.registrationFee = form.registrationFee || "N/A";

            if (form.files) {
                if (form.files.receiptCopy?.id) {
                    processedForm.studentSignature = await getFile(form.files.receiptCopy.id);
                }
                if (form.files.guideSignature?.id) {
                    processedForm.guideSignature = await getFile(form.files.guideSignature.id);
                }
                if (form.files.additionalDocuments && form.files.additionalDocuments.length > 0) {
                    processedForm.additionalDocuments = await getMultipleFiles(form.files.additionalDocuments);
                }
                if (form.files.pdfDocuments && form.files.pdfDocuments.length > 0) {
                    processedForm.pdfFileUrls = await getMultipleFiles(form.files.pdfDocuments);
                }
                if (form.files.zipFiles && form.files.zipFiles.length > 0) {
                    const zipFiles = await getMultipleFiles(form.files.zipFiles);
                    processedForm.zipFile = zipFiles[0] || null;
                }
            }
            break;

        case "PG_2_A":
            processedForm.topic = form.projectTitle || form.paperTitle || form.topic || "Untitled Project";
            processedForm.name = form.studentDetails?.[0]?.name || "N/A";
            processedForm.department = form.department || "NA";
            processedForm.studentDetails = form.studentDetails || [];
            processedForm.expenses = form.expenses || [];
            processedForm.bankDetails = form.bankDetails || {};
            processedForm.organizingInstitute = form.organizingInstitute || "N/A";
            processedForm.guideNames = form.guideName ? [form.guideName] : [];
            processedForm.employeeCodes = form.employeeCode ? [form.employeeCode] : [];

            if (form.files) {
                if (form.files.bills && form.files.bills.length > 0) {
                    processedForm.bills = await getMultipleFiles(form.files.bills);
                }
                if (form.files.zips && form.files.zips.length > 0) {
                    const zipFiles = await getMultipleFiles(form.files.zips);
                    processedForm.zipFile = zipFiles[0] || null;
                }
                if (form.files.studentSignature) {
                    processedForm.studentSignature = await getFile(form.files.studentSignature);
                }
                if (form.files.guideSignature) {
                    processedForm.guideSignature = await getFile(form.files.guideSignature);
                }
                if (form.files.groupLeaderSignature) {
                    processedForm.groupLeaderSignature = await getFile(form.files.groupLeaderSignature);
                }
            }
            break;

        case "PG_2_B":
            const groupSigId = getObjectIdString(form.groupLeaderSignature?.id);
            if (groupSigId) {
                processedForm.groupLeaderSignature = await getFile(groupSigId);
                processedForm.studentSignature = processedForm.groupLeaderSignature;
            }

            const guideSigId = getObjectIdString(form.guideSignature?.id);
            if (guideSigId) {
                processedForm.guideSignature = await getFile(guideSigId);
            }

            if (form.additionalDocuments && form.additionalDocuments.length > 0) {
                const additionalDocIds = form.additionalDocuments.map(doc => getObjectIdString(doc.id)).filter(Boolean);
                processedForm.additionalDocuments = await getMultipleFiles(additionalDocIds);
            }
            processedForm.name = form.studentName || "N/A";
            processedForm.projectTitle = form.projectTitle;
            processedForm.guideName = form.guideName;
            processedForm.coGuideName = form.coGuideName;
            processedForm.employeeCode = form.employeeCode;
            processedForm.yearOfAdmission = form.yearOfAdmission;
            processedForm.rollNo = form.rollNo;
            processedForm.mobileNo = form.mobileNo;
            processedForm.registrationFee = form.registrationFee;
            processedForm.department = form.department;
            processedForm.bankDetails = form.bankDetails || {};
            processedForm.authors = form.authors || [];
            processedForm.paperLink = form.paperLink;
            processedForm.conferenceDate = form.conferenceDate;
            processedForm.organization = form.organization;
            processedForm.publisher = form.publisher;
            processedForm.previousClaim = form.previousClaim;
            processedForm.claimDate = form.claimDate;
            processedForm.amountReceived = form.amountReceived;
            processedForm.amountSanctioned = form.amountSanctioned;
            break;

        case "R1":
            if (form.studentSignatureFileId) {
                processedForm.studentSignature = await getFile(form.studentSignatureFileId);
            }
            if (form.guideSignatureFileId) {
                processedForm.guideSignature = await getFile(form.guideSignatureFileId);
            }
            if (form.hodSignatureFileId) {
                processedForm.hodSignature = await getFile(form.hodSignatureFileId);
            }
            if (form.sdcChairpersonSignatureFileId) {
                processedForm.sdcChairpersonSignature = await getFile(form.sdcChairpersonSignatureFileId);
            }
            if (form.proofDocumentFileId) {
                processedForm.proofDocument = await getFile(form.proofDocumentFileId);
            }
            if (form.pdfFileIds && form.pdfFileIds.length > 0) {
                processedForm.pdfFileUrls = await getMultipleFiles(form.pdfFileIds);
            }
            if (form.zipFileId) {
                processedForm.zipFile = await getFile(form.zipFileId);
            }

            processedForm.coGuideName = form.coGuideName;
            processedForm.employeeCodes = form.employeeCodes;
            processedForm.yearOfAdmission = form.yearOfAdmission;
            processedForm.rollNo = form.rollNo;
            processedForm.mobileNo = form.mobileNo;
            processedForm.feesPaid = form.feesPaid;
            processedForm.receivedFinance = form.receivedFinance;
            processedForm.financeDetails = form.financeDetails;
            processedForm.paperLink = form.paperLink;
            processedForm.authors = form.authors;
            processedForm.sttpTitle = form.sttpTitle;
            processedForm.organizers = form.organizers;
            processedForm.reasonForAttending = form.reasonForAttending;
            processedForm.numberOfDays = form.numberOfDays;
            processedForm.dateFrom = form.dateFrom;
            processedForm.dateTo = form.dateTo;
            processedForm.registrationFee = form.registrationFee;
            processedForm.bankDetails = form.bankDetails;
            processedForm.amountClaimed = form.amountClaimed;
            processedForm.finalAmountSanctioned = form.finalAmountSanctioned;
            processedForm.dateOfSubmission = form.dateOfSubmission;
            processedForm.remarksByHOD = form.remarksByHOD;
            break;

        default:
            console.warn(`No specific processing defined for form type: ${formType}. Returning raw form data.`);
            break;
    }

    return processedForm;
};
// --- API Endpoints ---

/**
 * @route GET /api/application/pending
 * @desc Fetch all pending applications from all form collections for the authenticated user
 * @access Private (requires authentication)
 * @queryParam {string} [userBranch] - Optional: The branch of the currently logged-in user.
 * @queryParam {string} svvNetId - Required: The svvNetId of the currently logged-in user.
 */
router.get("/pending", async (req, res) => {
    try {
        // Extract parameters from query
        const userBranch = req.query.userBranch;
        const svvNetId = req.query.svvNetId;
        // Validate svvNetId is provided
        if (!svvNetId) {
            return res.status(400).json({ 
                message: "svvNetId is required to fetch user-specific applications" 
            });
        }
        // Create filter object for user-specific data
        const userFilter = { 
            status: /^pending$/i,
            svvNetId: svvNetId // Filter by the authenticated user's svvNetId
        };
        const [
            ug1Forms,
            ug2Forms,
            ug3aForms,
            ug3bForms,
            pg1Forms,
            pg2aForms,
            pg2bForms,
            r1Forms
        ] = await Promise.all([
            UG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            UGForm2.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            R1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
        ]);

        const results = await Promise.all([
            ...ug1Forms.map(f => processFormForDisplay(f, "UG_1", userBranch)),
            ...ug2Forms.map(f => processFormForDisplay(f, "UG_2", userBranch)),
            ...ug3aForms.map(f => processFormForDisplay(f, "UG_3_A", userBranch)),
            ...ug3bForms.map(f => processFormForDisplay(f, "UG_3_B", userBranch)),
            ...pg1Forms.map(f => processFormForDisplay(f, "PG_1", userBranch)),
            ...pg2aForms.map(f => processFormForDisplay(f, "PG_2_A", userBranch)),
            ...pg2bForms.map(f => processFormForDisplay(f, "PG_2_B", userBranch)),
            ...r1Forms.map(f => processFormForDisplay(f, "R1", userBranch)),
        ]);

        res.json(results);
    } catch (error) {
        console.error("Error fetching pending applications:", error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @route GET /api/application/accepted
 * @desc Fetch all accepted applications for the authenticated user
 * @access Private (requires authentication)
 * @queryParam {string} [userBranch] - Optional: Branch of the user
 * @queryParam {string} svvNetId - Required: SVV Net ID of the user
 */
router.get("/accepted", async (req, res) => {
    try {
        const userBranch = req.query.userBranch;
        const svvNetId = req.query.svvNetId;

        if (!svvNetId) {
            return res.status(400).json({
                message: "svvNetId is required to fetch accepted applications"
            });
        }

        const userFilter = {
            status: { $in: [/^approved$/i, /^accepted$/i] }, // Accepts both words, case-insensitive
            svvNetId: svvNetId
        };

        const [
            ug1Forms,
            ug2Forms,
            ug3aForms,
            ug3bForms,
            pg1Forms,
            pg2aForms,
            pg2bForms,
            r1Forms
        ] = await Promise.all([
            UG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            UGForm2.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            R1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
        ]);

        const results = await Promise.all([
            ...ug1Forms.map(f => processFormForDisplay(f, "UG_1", userBranch)),
            ...ug2Forms.map(f => processFormForDisplay(f, "UG_2", userBranch)),
            ...ug3aForms.map(f => processFormForDisplay(f, "UG_3_A", userBranch)),
            ...ug3bForms.map(f => processFormForDisplay(f, "UG_3_B", userBranch)),
            ...pg1Forms.map(f => processFormForDisplay(f, "PG_1", userBranch)),
            ...pg2aForms.map(f => processFormForDisplay(f, "PG_2_A", userBranch)),
            ...pg2bForms.map(f => processFormForDisplay(f, "PG_2_B", userBranch)),
            ...r1Forms.map(f => processFormForDisplay(f, "R1", userBranch)),
        ]);

        res.json(results);
    } catch (error) {
        console.error("Error fetching accepted applications:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/rejected", async (req, res) => {
    try {
        const userBranch = req.query.userBranch;
        const svvNetId = req.query.svvNetId;

        if (!svvNetId) {
            return res.status(400).json({
                message: "svvNetId is required to fetch rejected applications"
            });
        }

        const userFilter = {
            status: { $in: [/^rejected$/i, /^declined$/i] }, // Accept both terms
            svvNetId: svvNetId
        };

        const [
            ug1Forms,
            ug2Forms,
            ug3aForms,
            ug3bForms,
            pg1Forms,
            pg2aForms,
            pg2bForms,
            r1Forms
        ] = await Promise.all([
            UG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            UGForm2.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            R1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
        ]);

        const results = await Promise.all([
            ...ug1Forms.map(f => processFormForDisplay(f, "UG_1", userBranch)),
            ...ug2Forms.map(f => processFormForDisplay(f, "UG_2", userBranch)),
            ...ug3aForms.map(f => processFormForDisplay(f, "UG_3_A", userBranch)),
            ...ug3bForms.map(f => processFormForDisplay(f, "UG_3_B", userBranch)),
            ...pg1Forms.map(f => processFormForDisplay(f, "PG_1", userBranch)),
            ...pg2aForms.map(f => processFormForDisplay(f, "PG_2_A", userBranch)),
            ...pg2bForms.map(f => processFormForDisplay(f, "PG_2_B", userBranch)),
            ...r1Forms.map(f => processFormForDisplay(f, "R1", userBranch)),
        ]);

        res.json(results);
    } catch (error) {
        console.error("Error fetching rejected applications:", error);
        res.status(500).json({ message: "Server error" });
    }
});
/**
 * @route GET /api/application/my-applications
 * @desc Fetch all applications (any status) for the authenticated user
 * @access Private (requires authentication)
 * @queryParam {string} [userBranch] - Optional: The branch of the currently logged-in user.
 * @queryParam {string} svvNetId - Required: The svvNetId of the currently logged-in user.
 */
router.get("/my-applications", async (req, res) => {
    try {
        const userBranch = req.query.userBranch;
        const svvNetId = req.query.svvNetId;

        if (!svvNetId) {
            return res.status(400).json({
                message: "svvNetId is required to fetch user-specific applications"
            });
        }
        // Filter for all applications by this user (any status)
        const userFilter = { svvNetId: svvNetId }; // Assuming svvNetId is the field linking applications to users
        const [
            ug1Forms,
            ug2Forms,
            ug3aForms,
            ug3bForms,
            pg1Forms,
            pg2aForms,
            pg2bForms,
            r1Forms
        ] = await Promise.all([
            UG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            UGForm2.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            UG3BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2AForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            PG2BForm.find(userFilter).sort({ createdAt: -1 }).lean(),
            R1Form.find(userFilter).sort({ createdAt: -1 }).lean(),
        ]);

        const results = await Promise.all([
            ...ug1Forms.map(f => processFormForDisplay(f, "UG_1", userBranch)),
            ...ug2Forms.map(f => processFormForDisplay(f, "UG_2", userBranch)),
            ...ug3aForms.map(f => processFormForDisplay(f, "UG_3_A", userBranch)),
            ...ug3bForms.map(f => processFormForDisplay(f, "UG_3_B", userBranch)),
            ...pg1Forms.map(f => processFormForDisplay(f, "PG_1", userBranch)),
            ...pg2aForms.map(f => processFormForDisplay(f, "PG_2_A", userBranch)),
            ...pg2bForms.map(f => processFormForDisplay(f, "PG_2_B", userBranch)),
            ...r1Forms.map(f => processFormForDisplay(f, "R1", userBranch)),
        ]);

        res.json(results);
    } catch (error) {
        console.error("Error fetching user applications:", error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @route POST /api/application/:id
 * @desc Fetch specific application by ID from all form collections (user must own OR be a validator)
 * @access Private (requires authentication)
 * @body {string} [userBranch] - Optional: The branch of the currently logged-in user.
 * @body {string} svvNetId - Required: The svvNetId of the currently logged-in user.
 * @body {string} role - Required: The role of the currently logged-in user (e.g., 'student', 'validator', 'admin').
 */
router.post("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // <<< Retrieve the role from the request body
        // IMPORTANT SECURITY NOTE: In a production environment, 'svvNetId' and 'role'
        // should be extracted from a securely authenticated user session (e.g., JWT payload),
        // NOT directly from the request body as they can be easily spoofed by a client.
        // For this exercise, we are assuming 'role' from the client is trustworthy.
        const { userBranch, svvNetId, role } = req.body;

        console.log(`Backend received POST request for Application ID: ${id}`);
        console.log(`Body parameters - userBranch: ${userBranch}, svvNetId: ${svvNetId}, role: ${role}`);

        if (!svvNetId || !role) { // Ensure role is also present
            return res.status(400).json({
                message: "svvNetId and role are required in the request body to access applications"
            });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid application ID format" });
        }

        const ACCESS_LEVELS = {
            STUDENT: 'student',
            VALIDATOR: 'validator',
            ADMIN: 'admin',
            PRINCIPAL: 'principal',
            HOD: 'hod',
            INSTITUTE_COORDINATOR: 'institute coordinator',
            DEPARTMENT_COORDINATOR: 'department coordinator' // <-- ADD THIS
        };
        // Admin, Validator, and PRINCIPAL now have global view access
        const ROLES_WITH_GLOBAL_VIEW_ACCESS = [
            ACCESS_LEVELS.VALIDATOR,
            ACCESS_LEVELS.ADMIN,
            ACCESS_LEVELS.PRINCIPAL,
            ACCESS_LEVELS.INSTITUTE_COORDINATOR,   // ✅ Ensure included
            ACCESS_LEVELS.HOD,                     // ✅ Ensure included
            ACCESS_LEVELS.DEPARTMENT_COORDINATOR   // ✅ Add this for global view access
        ];

        // No roles will have branch-specific view access for this route anymore,
        // as HOD and Institute Coordinator will now have student-level access for this endpoint.
        const ROLES_WITH_BRANCH_SPECIFIC_VIEW_ACCESS = [];

        let findFilter = { _id: id };
        const userRole = role.toLowerCase(); // Standardize role to lowercase once

        console.log(`Backend received request for Application ID: ${id}`);
        console.log(`User details - userBranch: ${userBranch}, svvNetId: ${svvNetId}, role: ${role}`);

        // Input validation (already present, but good to reiterate its importance)
        if (!svvNetId || !userRole) {
            return res.status(400).json({
                message: "svvNetId and role are required to access applications"
            });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid application ID format." });
        }

        // --- Refined Authorization Logic ---
        if (
            ROLES_WITH_GLOBAL_VIEW_ACCESS.includes(userRole) ||
            userRole === ACCESS_LEVELS.INSTITUTE_COORDINATOR || // institute coordinator = department coordinator
            userRole === ACCESS_LEVELS.HOD
        ) {
            // Grant department coordinator and HOD global view access (view-only)
            console.log(`Access granted (View Only): Role '${userRole}' can view any application. Filter:`, findFilter);
            // No need to append svvNetId
        } else {
            // Restrict to only their own applications
            findFilter.svvNetId = svvNetId;
            console.log(`Access restricted (User-Specific View): User role '${userRole}' requires svvNetId match. Filter:`, findFilter);
        }

        const collections = [
            { model: UG1Form, type: "UG_1" },
            { model: UGForm2, type: "UG_2" },
            { model: UG3AForm, type: "UG_3_A" },
            { model: UG3BForm, type: "UG_3_B" },
            { model: PG1Form, type: "PG_1" },
            { model: PG2AForm, type: "PG_2_A" },
            { model: PG2BForm, type: "PG_2_B" },
            { model: R1Form, type: "R1" }
        ];
        let application = null;
        let foundType = null;

        // Search for the application using the constructed filter
        for (const collection of collections) {
            console.log(`Searching in ${collection.type} with filter:`, findFilter);
            application = await collection.model.findOne(findFilter).lean();

            if (application) {
                foundType = collection.type;
                console.log(`Application found in ${collection.type}.`);
                break;
            }
        }

        if (!application) {
            console.log(`No application found with ID: ${id} and the given credentials across all collections.`);
            return res.status(404).json({
                message: "Application not found or you don't have permission to access it"
            });
        }

        // Pass the userRole to processFormForDisplay
        const processedApplication = await processFormForDisplay(application, foundType, userBranch, gfsBucket, userRole);
        res.json(processedApplication);
    } catch (error) {
        console.error("Error fetching application by ID (POST route):", error);
        if (error.name === 'CastError' && error.path === '_id') {
            return res.status(400).json({ message: 'Invalid Application ID format.' });
        }
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * @route PUT /api/application/:id/status
 * @desc Update application status (only for the owner)
 * @access Private (requires authentication)
 */
router.put("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        // IMPORTANT SECURITY NOTE: 'svvNetId' for ownership verification should be
        // extracted from a securely authenticated user session (e.g., JWT payload),
        // NOT directly from the request body.
        const { status, svvNetId } = req.body; // Assuming svvNetId is sent in body for PUT

        if (!svvNetId) {
            return res.status(400).json({
                message: "svvNetId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid application ID" });
        }

        if (!status || !['pending', 'approved', 'rejected'].includes(status.toLowerCase())) {
            return res.status(400).json({
                message: "Valid status is required (pending, approved, rejected)"
            });
        }

        const collections = [
            UG1Form, UGForm2, UG3AForm, UG3BForm,
            PG1Form, PG2AForm, PG2BForm, R1Form
        ];

        let updatedApplication = null;

        // Try to update in each collection
        for (const Model of collections) {
            updatedApplication = await Model.findOneAndUpdate(
                {
                    _id: id,
                    svvNetId: svvNetId // Ensure user owns this application
                },
                {
                    status: status.toLowerCase(),
                    updatedAt: new Date()
                },
                { new: true }
            ).lean();

            if (updatedApplication) {
                break;
            }
        }

        if (!updatedApplication) {
            return res.status(404).json({
                message: "Application not found or you don't have permission to update it"
            });
        }

        res.json({
            message: "Application status updated successfully",
            application: updatedApplication
        });
    } catch (error) {
        console.error("Error updating application status:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/:id/remarks", async (req, res) => {
  const { id } = req.params;
  let { remarks } = req.body;

  // Validation
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid application ID." });
  }

  if (!remarks || !remarks.trim()) {
    return res.status(400).json({ message: "Remarks cannot be empty." });
  }

  remarks = remarks.trim();

  const formCollections = [
    UG1Form, UGForm2, UG3AForm, UG3BForm,
    PG1Form, PG2AForm, PG2BForm, R1Form
  ];

  try {
    let updatedApp = null;

    for (const Model of formCollections) {
      updatedApp = await Model.findByIdAndUpdate(
        id,
        { remarks, updatedAt: new Date() },
        { new: true }
      ).lean();

      if (updatedApp) break;
    }

    if (!updatedApp) {
      return res.status(404).json({ message: "Application not found." });
    }

    return res.status(200).json({
      message: "Remarks updated successfully.",
      application: updatedApp
    });
  } catch (err) {
    console.error("❌ Error updating remarks:", err);
    res.status(500).json({ message: "Server error while updating remarks." });
  }
});

// General file serving route for GridFS files
router.get('/file/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const bucketName = req.query.bucket || 'uploads'; // Default to 'uploads' if bucket not specified

        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            return res.status(400).json({ message: "Invalid file ID." });
        }

        const dynamicBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName });

        console.log(`📦 Serving file from bucket: ${bucketName}`);

        const files = await dynamicBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();

        if (!files || files.length === 0) {
            return res.status(404).json({ message: "File not found in the bucket." });
        }

        const file = files[0];

        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `inline; filename="${file.filename}"`); // Inline to view, attachment to force download

        const downloadStream = dynamicBucket.openDownloadStream(file._id);
        downloadStream.pipe(res);

        downloadStream.on('error', (err) => {
            console.error(`Error streaming file ${fileId}:`, err);
            res.status(500).json({ message: "Error streaming file." });
        });

    } catch (error) {
        console.error("Error retrieving file from GridFS:", error);
        res.status(500).json({ message: "Server error." });
    }
});

export default router;