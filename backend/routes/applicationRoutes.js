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
    "UG_3_B": "/api/ug3bform/uploads/files",
    "PG_1": "/api/pg1form/uploads/files",
    "PG_2_A": "/api/pg2aform/uploads/files",
    "PG_2_B": "/api/pg2bform/uploads/files",
    "R1": "/api/r1form/uploads/files",
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
const getFileDetailsAndUrl = async (fileId, baseUrlForServingFile, gfsBucket) => {
    console.log(`\n🔍 getFileDetailsAndUrl Called`);
    console.log(`🔑 Received fileId: ${fileId}`);
    console.log(`🌐 Base URL: ${baseUrlForServingFile}`);

    // Check 1: fileId validity
    if (!fileId) {
        console.warn(`❌ fileId is null/undefined for baseUrl: ${baseUrlForServingFile}.`);
        return null;
    }

    // Check 2: gfsBucket existence
    if (!gfsBucket) {
        console.warn(`❌ gfsBucket is not initialized.`);
        return null;
    }

    // Check 3: ObjectId validation
    const isValidObjectId = mongoose.Types.ObjectId.isValid(fileId);
    console.log(`✅ ObjectId valid: ${isValidObjectId}`);

    if (!isValidObjectId) {
        console.warn(`❌ Invalid ObjectId format: ${fileId}`);
        return null;
    }

    try {
        console.log(`🔍 Searching in GridFS with ID: ${fileId}...`);
        const files = await gfsBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();

        console.log(`📂 Files found:`, files);

        if (files.length > 0) {
            const fileData = files[0];
            console.log(`✅ File found: "${fileData.filename}" with ID: "${fileId}".`);

            return {
                id: fileData._id.toString(),
                originalName: fileData.metadata?.originalName || fileData.filename,
                filename: fileData.filename,
                mimetype: fileData.contentType,
                size: fileData.length,
                url: `${baseUrlForServingFile}/${fileData._id.toString()}`,
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
const processFormForDisplay = async (form, formType, userBranchFromRequest, gfsBucket) => { // Added gfsBucket parameter
    let processedForm = { ...form };

    const getObjectIdString = (idField) => {
        if (typeof idField === 'string') {
            return idField;
        }
        if (idField && typeof idField === 'object' && idField.$oid) {
            return idField.$oid;
        }
        if (idField && mongoose.Types.ObjectId.isValid(idField)) {
            return idField.toString();
        }
        return null; // Return null if the ID is not a valid string, $oid object, or ObjectId
    };
    // Handle MongoDB ObjectId conversion for _id
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

    // Base URL for retrieving files (assuming your backend serves them from here)
    const fileBaseUrl = fileBaseUrlMapper[formType] || "/api/uploads/files";

    // Initialize all file-related fields to null or empty arrays
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

    // --- Specific file and field processing based on formType ---
    switch (formType) {
        case "UG_1":
            if (form.pdfFileIds && form.pdfFileIds.length > 0) {
                const pdfFileDetailsPromises = form.pdfFileIds.map(id => getFileDetailsAndUrl(id, fileBaseUrl, gfsBucket));
                processedForm.pdfFileUrls = (await Promise.all(pdfFileDetailsPromises)).filter(Boolean);
            }
            if (form.groupLeaderSignatureId) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignatureId, fileBaseUrl, gfsBucket);
            }
            if (form.guideSignatureId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignatureId, fileBaseUrl, gfsBucket);
            }
            processedForm.guideNames = form.guides ? form.guides.map(g => g.guideName || "") : [];
            processedForm.employeeCodes = form.guides ? form.guides.map(g => g.employeeCode || "") : [];
            break;

        case "UG_2":
            // Note: Your UG_2 case uses form.groupLeaderSignature.fileId and form.guideSignature.fileId,
            // implying these might already be objects in the raw form.
            // Ensure this matches your UG_2 schema.
            if (form.groupLeaderSignature?.fileId) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignature.fileId, fileBaseUrl, gfsBucket);
            }
            if (form.guideSignature?.fileId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignature.fileId, fileBaseUrl, gfsBucket);
            }
            if (form.uploadedFiles && form.uploadedFiles.length > 0) {
                const uploadedFileDetailsPromises = form.uploadedFiles.map(fileMeta => getFileDetailsAndUrl(fileMeta.fileId, fileBaseUrl, gfsBucket));
                processedForm.uploadedFiles = (await Promise.all(uploadedFileDetailsPromises)).filter(Boolean);
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
            // Handle uploadedImage
            const uploadedImageId = getObjectIdString(form.uploadedImage?.fileId);
            if (uploadedImageId) {
                processedForm.uploadedImage = await getFileDetailsAndUrl(uploadedImageId, fileBaseUrl, gfsBucket);
            }

            // Handle uploadedPdfs
            if (form.uploadedPdfs && form.uploadedPdfs.length > 0) {
                const pdfDetailsPromises = form.uploadedPdfs.map(pdfMeta => {
                    const pdfFileId = getObjectIdString(pdfMeta.fileId);
                    return pdfFileId ? getFileDetailsAndUrl(pdfFileId, fileBaseUrl, gfsBucket) : null;
                });
                processedForm.uploadedPdfs = (await Promise.all(pdfDetailsPromises)).filter(Boolean);
            }

            console.log('Raw uploadedZipFile:', form.uploadedZipFile);
            const uploadedZipFileId = getObjectIdString(form.uploadedZipFile?.fileId || form.uploadedZipFile?.id);

            if (uploadedZipFileId) {
                console.log(`📦 Processing uploadedZipFile with ID: ${uploadedZipFileId}`);
                processedForm.zipFile = await getFileDetailsAndUrl(uploadedZipFileId, fileBaseUrl, gfsBucket);
            } else {
                console.warn('❌ No valid fileId found for uploadedZipFile.');
            }
            // Remaining fields (no change needed here as they don't involve file IDs)
            processedForm.organizingInstitute = form.organizingInstitute;
            processedForm.projectTitle = form.projectTitle;
            processedForm.students = form.students;
            processedForm.expenses = form.expenses;
            processedForm.totalAmount = form.totalAmount;
            processedForm.bankDetails = form.bankDetails;
            break;

        case "UG_3_B":
            if (form.pdfDocuments && form.pdfDocuments.length > 0) {
                const pdfDetails = await Promise.all(form.pdfDocuments.map(fileMeta => {
                    if (fileMeta?.id) return getFileDetailsAndUrl(fileMeta.id, fileBaseUrl, gfsBucket);
                    return null; // Return null for invalid entries
                }));
                processedForm.pdfFileUrls = pdfDetails.filter(Boolean);
            }
            if (form.zipFiles && form.zipFiles.length > 0) {
                const zipDetails = await Promise.all(form.zipFiles.map(fileMeta => {
                    if (fileMeta?.id) return getFileDetailsAndUrl(fileMeta.id, fileBaseUrl, gfsBucket);
                    return null;
                }));
                processedForm.zipFile = zipDetails.filter(Boolean)[0] || null; // Assuming one zip
            }
            if (form.groupLeaderSignature?.id) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignature.id, fileBaseUrl, gfsBucket);
                processedForm.studentSignature = processedForm.groupLeaderSignature; // Assigning to studentSignature if same
            }
            if (form.guideSignature?.id) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignature.id, fileBaseUrl, gfsBucket);
            }
            if (form.paperCopy?.id) {
                processedForm.paperCopy = await getFileDetailsAndUrl(form.paperCopy.id, fileBaseUrl, gfsBucket);
            }
            if (form.additionalDocuments && form.additionalDocuments.length > 0) {
                const additionalDocDetails = await Promise.all(form.additionalDocuments.map(fileMeta => {
                    if (fileMeta?.id) return getFileDetailsAndUrl(fileMeta.id, fileBaseUrl, gfsBucket);
                    return null;
                }));
                processedForm.additionalDocuments = additionalDocDetails.filter(Boolean);
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
            processedForm.topic =
                form.sttpTitle ||
                form.projectTitle ||
                form.paperTitle ||
                form.topic ||
                "Untitled Project";

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
                if (form.files.receiptCopy?.id) { // Use receiptCopy for student signature
                    processedForm.studentSignature = await getFileDetailsAndUrl(form.files.receiptCopy.id, fileBaseUrl, gfsBucket);
                }
                if (form.files.guideSignature?.id) {
                    processedForm.guideSignature = await getFileDetailsAndUrl(form.files.guideSignature.id, fileBaseUrl, gfsBucket);
                }
                if (form.files.additionalDocuments && form.files.additionalDocuments.length > 0) {
                    const additionalDocPromises = form.files.additionalDocuments.map(fileMeta => getFileDetailsAndUrl(fileMeta.id, fileBaseUrl, gfsBucket));
                    processedForm.additionalDocuments = (await Promise.all(additionalDocPromises)).filter(Boolean);
                } else {
                    processedForm.additionalDocuments = [];
                }
                if (form.files.pdfDocuments && form.files.pdfDocuments.length > 0) {
                    const pdfDocPromises = form.files.pdfDocuments.map(fileMeta => getFileDetailsAndUrl(fileMeta.id, fileBaseUrl, gfsBucket));
                    processedForm.pdfFileUrls = (await Promise.all(pdfDocPromises)).filter(Boolean);
                } else {
                    processedForm.pdfFileUrls = [];
                }
                if (form.files.zipFiles && form.files.zipFiles.length > 0) {
                    const zipFilePromises = form.files.zipFiles.map(fileMeta => getFileDetailsAndUrl(fileMeta.id, fileBaseUrl, gfsBucket));
                    processedForm.zipFile = (await Promise.all(zipFilePromises)).filter(Boolean)[0] || null;
                } else {
                    processedForm.zipFile = null;
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
                    const billFilePromises = form.files.bills.map(id => getFileDetailsAndUrl(id, fileBaseUrl, gfsBucket));
                    processedForm.bills = (await Promise.all(billFilePromises)).filter(Boolean);
                } else {
                    processedForm.bills = [];
                }
                if (form.files.zips && form.files.zips.length > 0) {
                    const zipFilePromises = form.files.zips.map(id => getFileDetailsAndUrl(id, fileBaseUrl, gfsBucket));
                    processedForm.zipFile = (await Promise.all(zipFilePromises)).filter(Boolean)[0] || null;
                } else {
                    processedForm.zipFile = null;
                }
                if (form.files.studentSignature) {
                    processedForm.studentSignature = await getFileDetailsAndUrl(form.files.studentSignature, fileBaseUrl, gfsBucket);
                }
                if (form.files.guideSignature) {
                    processedForm.guideSignature = await getFileDetailsAndUrl(form.files.guideSignature, fileBaseUrl, gfsBucket);
                }
                if (form.files.groupLeaderSignature) {
                    processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.files.groupLeaderSignature, fileBaseUrl, gfsBucket);
                }
            }
            break;

        case "PG_2_B":
            if (form.paperCopy) {
                processedForm.paperCopy = await getFileDetailsAndUrl(form.paperCopy, fileBaseUrl, gfsBucket);
            }
            if (form.groupLeaderSignature) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignature, fileBaseUrl, gfsBucket);
                processedForm.studentSignature = processedForm.groupLeaderSignature;
            }
            if (form.guideSignature) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignature, fileBaseUrl, gfsBucket);
            }
            if (form.additionalDocuments && form.additionalDocuments.length > 0) {
                const additionalDocPromises = form.additionalDocuments.map(doc => getFileDetailsAndUrl(doc, fileBaseUrl, gfsBucket));
                processedForm.additionalDocuments = (await Promise.all(additionalDocPromises)).filter(Boolean);
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
                processedForm.studentSignature = await getFileDetailsAndUrl(form.studentSignatureFileId, fileBaseUrl, gfsBucket);
            }
            if (form.guideSignatureFileId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignatureFileId, fileBaseUrl, gfsBucket);
            }
            if (form.hodSignatureFileId) {
                processedForm.hodSignature = await getFileDetailsAndUrl(form.hodSignatureFileId, fileBaseUrl, gfsBucket);
            }
            if (form.sdcChairpersonSignatureFileId) {
                processedForm.sdcChairpersonSignature = await getFileDetailsAndUrl(form.sdcChairpersonSignatureFileId, fileBaseUrl, gfsBucket);
            }
            if (form.proofDocumentFileId) {
                processedForm.proofDocument = await getFileDetailsAndUrl(form.proofDocumentFileId, fileBaseUrl, gfsBucket);
            }
            if (form.pdfFileIds && form.pdfFileIds.length > 0) {
                const pdfFileDetailsPromises = form.pdfFileIds.map(id => getFileDetailsAndUrl(id, fileBaseUrl, gfsBucket));
                processedForm.pdfFileUrls = (await Promise.all(pdfFileDetailsPromises)).filter(Boolean);
            }
            if (form.zipFileId) {
                processedForm.zipFile = await getFileDetailsAndUrl(form.zipFileId, fileBaseUrl, gfsBucket);
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
            console.warn(`No specific processing defined for form type: ${formType}. Returning raw form data with generic name/branch.`);
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

        // Define the base filter for the application
        let findFilter = { _id: id };
        const allowedRolesToViewAll = ['validator', 'admin', 'coordinator']; // Define roles with broad view access

        if (!allowedRolesToViewAll.includes(role.toLowerCase())) {
            // If the user's role is NOT in the allowedRolesToViewAll, then apply the svvNetId filter.
            findFilter.svvNetId = svvNetId;
            console.log(`Access restricted: User role '${role}' requires svvNetId match.`);
        } else {
            console.log(`Access granted: User role '${role}' allows viewing any application by ID.`);
        }
        // --- END AUTHORIZATION LOGIC ---

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

        // Assuming processFormForDisplay is defined elsewhere in your application.
        // It's not part of this file snippet, so ensure it's imported or defined.
        const processedApplication = await processFormForDisplay(application, foundType, userBranch, gfsBucket);
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

// General file serving route for GridFS files
router.get('/file/:fileId', async (req, res) => {
    // Ensure gfsBucket is initialized globally in this file (which it is, from applicationRoutes.js)
    if (!gfsBucket) { // Directly use the gfsBucket variable initialized in this module
        return res.status(503).json({ message: "GridFS is not initialized or connected." });
    }
    try {
        const fileId = req.params.fileId;
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            return res.status(400).json({ message: "Invalid file ID." });
        }

        const files = await gfsBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ message: "File not found." });
        }

        const file = files[0];

        res.set('Content-Type', file.contentType);
        res.set('Content-Disposition', `inline; filename="${file.filename}"`); // 'inline' to display in browser, 'attachment' to download

        const downloadStream = gfsBucket.openDownloadStream(file._id);
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