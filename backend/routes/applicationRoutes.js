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
const getGfsBucket = () => { // <--- This function is defined HERE
    if (!gfsBucket && mongoose.connection.readyState === 1) {
        gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'uploads'
        });
    }
    return gfsBucket;
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
 * @returns {Promise<{id: string, originalName: string, filename: string, mimetype: string, size: number, url: string} | null>} - File details or null.
 */
const getFileDetailsAndUrl = async (fileId, baseUrlForServingFile) => {
    // Validate fileId before attempting to convert to ObjectId
    if (!gfsBucket || !fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
        console.warn(`Invalid or missing fileId for GridFS lookup: ${fileId}`);
        return null;
    }
    try {
        const file = await gfsBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
        if (file.length > 0) {
            const fileData = file[0];
            return {
                id: fileData._id.toString(),
                originalName: fileData.metadata?.originalName || fileData.filename, // Prefer metadata.originalName if available
                filename: fileData.filename,
                mimetype: fileData.contentType,
                size: fileData.length,
                // IMPORTANT: Construct URL using the provided baseUrlForServingFile
                url: `${baseUrlForServingFile}/${fileData._id.toString()}`,
            };
        }
    } catch (error) {
        console.error(`Error fetching file details for ID ${fileId}:`, error);
    }
    return null;
};

/**
 * Helper: Processes a raw form object to include file URLs and standardizes fields for display.
 * @param {Object} form - The raw Mongoose document (after .lean())
 * @param {string} formType - The type of the form (e.g., "UG_1", "UG_2", "UG_3_A", "R1")
 * @param {string} [userBranchFromRequest] - Optional: The branch of the currently logged-in user, passed from the frontend.
 * @returns {Promise<Object>} - The processed form object with URLs and standardized fields.
 */
const processFormForDisplay = async (form, formType, userBranchFromRequest) => { // Added userBranchFromRequest parameter
   let processedForm = { ...form };

    processedForm._id = form._id.toString();
    processedForm.topic = form.projectTitle || form.paperTitle || form.topic || "Untitled Project";
    processedForm.name = form.studentName || form.applicantName || (form.students?.[0]?.name) || (form.studentDetails?.[0]?.studentName) || "N/A";
    processedForm.branch = userBranchFromRequest || form.branch || form.department || (form.students?.[0]?.branch) || (form.studentDetails?.[0]?.branch) || "N/A";

    processedForm.submitted = form.createdAt || form.submittedAt || new Date();
    if (typeof processedForm.submitted === 'string' && !isNaN(new Date(processedForm.submitted))) {
        processedForm.submitted = new Date(processedForm.submitted);
    } else if (!(processedForm.submitted instanceof Date)) {
        processedForm.submitted = new Date();
    }

    processedForm.status = form.status || "pending";
    processedForm.formType = formType;

    const fileBaseUrl = `/api/application/file`;

    processedForm.groupLeaderSignature = null;
    processedForm.studentSignature = null;
    processedForm.guideSignature = null;
    processedForm.hodSignature = null;
    processedForm.sdcChairpersonSignature = null;
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
                const pdfFileDetailsPromises = form.pdfFileIds.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                processedForm.pdfFileUrls = (await Promise.all(pdfFileDetailsPromises)).filter(Boolean);
            }
            if (form.groupLeaderSignatureId) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignatureId, fileBaseUrl);
            }
            if (form.guideSignatureId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignatureId, fileBaseUrl);
            }
            processedForm.guideNames = form.guides ? form.guides.map(g => g.guideName || "") : [];
            processedForm.employeeCodes = form.guides ? form.guides.map(g => g.employeeCode || "") : [];
            break;

        case "UG_2":
            if (form.groupLeaderSignature && form.groupLeaderSignature.fileId) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignature.fileId, fileBaseUrl);
            }
            if (form.guideSignature && form.guideSignature.fileId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignature.fileId, fileBaseUrl);
            }
            if (form.uploadedFiles && form.uploadedFiles.length > 0) {
                const uploadedFileDetailsPromises = form.uploadedFiles.map(fileMeta => getFileDetailsAndUrl(fileMeta.fileId, fileBaseUrl));
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
            if (form.uploadedImage && form.uploadedImage.fileId) {
                processedForm.uploadedImage = await getFileDetailsAndUrl(form.uploadedImage.fileId, fileBaseUrl);
            }
            if (form.uploadedPdfs && form.uploadedPdfs.length > 0) {
                const pdfDetailsPromises = form.uploadedPdfs.map(pdfMeta => getFileDetailsAndUrl(pdfMeta.fileId, fileBaseUrl));
                processedForm.uploadedPdfs = (await Promise.all(pdfDetailsPromises)).filter(Boolean);
            }
            if (form.uploadedZipFile && form.uploadedZipFile.fileId) {
                processedForm.zipFile = await getFileDetailsAndUrl(form.uploadedZipFile.fileId, fileBaseUrl);
            }
            processedForm.organizingInstitute = form.organizingInstitute;
            processedForm.projectTitle = form.projectTitle;
            processedForm.students = form.students;
            processedForm.expenses = form.expenses;
            processedForm.totalAmount = form.totalAmount;
            processedForm.bankDetails = form.bankDetails;
            break;

         case "UG_3_B":
            if (form.uploadedPdfs && form.uploadedPdfs.length > 0) {
                const pdfDetails = await Promise.all(form.uploadedPdfs.map(fileMeta => {
                    if (fileMeta?.fileId) return getFileDetailsAndUrl(fileMeta.fileId, fileBaseUrl);
                }));
                processedForm.uploadedPdfs = pdfDetails.filter(Boolean);
            }
            if (form.uploadedZipFile?.fileId) {
                processedForm.zipFile = await getFileDetailsAndUrl(form.uploadedZipFile.fileId, fileBaseUrl);
            }
            if (form.groupLeaderSignature?.fileId) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignature.fileId, fileBaseUrl);
            }
            if (form.guideSignature?.fileId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignature.fileId, fileBaseUrl);
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
                form.sttpTitle ||        // ← your STTP/Workshop title
                form.projectTitle ||
                form.paperTitle ||
                form.topic ||
                "Untitled Project";

            // Branch handling is already done above using userBranchFromRequest
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

            // File processing
            if (form.files) {
                if (form.files.studentSignature) {
                    processedForm.studentSignature = await getFileDetailsAndUrl(form.files.studentSignature, fileBaseUrl);
                }
                if (form.files.guideSignature) {
                    processedForm.guideSignature = await getFileDetailsAndUrl(form.files.guideSignature, fileBaseUrl);
                }
                if (form.files.bills && form.files.bills.length > 0) {
                    const billFilePromises = form.files.bills.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                    processedForm.bills = (await Promise.all(billFilePromises)).filter(Boolean);
                }
                if (form.files.zips && form.files.zips.length > 0) {
                    const zipFilePromises = form.files.zips.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                    processedForm.zipFile = (await Promise.all(zipFilePromises)).filter(Boolean)[0] || null;
                }
            }
            break;
        case "PG_2_A":
            processedForm.topic = form.projectTitle || form.paperTitle || form.topic || "Untitled Project";
            processedForm.name = form.studentDetails?.[0]?.name || "N/A";
            // The general branch line above will handle this unless explicitly overridden here.
            // processedForm.branch = userBranchFromRequest || form.department || (form.studentDetails?.[0]?.branch) || "N/A";

            processedForm.department = form.department || "NA";
            processedForm.studentDetails = form.studentDetails || [];
            processedForm.expenses = form.expenses || [];
            processedForm.bankDetails = form.bankDetails || {};
            processedForm.organizingInstitute = form.organizingInstitute || "N/A";
            processedForm.guideNames = form.guideName ? [form.guideName] : [];
            processedForm.employeeCodes = form.employeeCode ? [form.employeeCode] : [];

            if (form.files) {
                if (form.files.bills && form.files.bills.length > 0) {
                    const billFilePromises = form.files.bills.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                    processedForm.bills = (await Promise.all(billFilePromises)).filter(Boolean);
                } else {
                    processedForm.bills = [];
                }
                if (form.files.zips && form.files.zips.length > 0) {
                    const zipFilePromises = form.files.zips.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                    processedForm.zipFile = (await Promise.all(zipFilePromises)).filter(Boolean)[0] || null;
                } else {
                    processedForm.zipFile = null;
                }
                if (form.files.studentSignature) {
                    processedForm.studentSignature = await getFileDetailsAndUrl(form.files.studentSignature, fileBaseUrl);
                }
                if (form.files.guideSignature) {
                    processedForm.guideSignature = await getFileDetailsAndUrl(form.files.guideSignature, fileBaseUrl);
                }
                if (form.files.groupLeaderSignature) {
                    processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.files.groupLeaderSignature, fileBaseUrl);
                }
            }
            break;
            
        case "PG_2_B":
            if (form.files) {
                if (form.files.bills?.length > 0) {
                    const bills = await Promise.all(form.files.bills.map(id => {
                        if (id) return getFileDetailsAndUrl(id, fileBaseUrl);
                    }));
                    processedForm.bills = bills.filter(Boolean);
                }
                if (form.files.zips?.length > 0) {
                    const zips = await Promise.all(form.files.zips.map(id => {
                        if (id) return getFileDetailsAndUrl(id, fileBaseUrl);
                    }));
                    processedForm.zipFile = zips.filter(Boolean)[0] || null;
                }
                if (form.files.studentSignature) {
                    processedForm.studentSignature = await getFileDetailsAndUrl(form.files.studentSignature, fileBaseUrl);
                }
                if (form.files.guideSignature) {
                    processedForm.guideSignature = await getFileDetailsAndUrl(form.files.guideSignature, fileBaseUrl);
                }
            }
            processedForm.name = form.studentName || "N/A";
            processedForm.projectTitle = form.projectTitle;
            processedForm.guideName = form.guideName;
            processedForm.employeeCode = form.employeeCode;
            processedForm.yearOfAdmission = form.yearOfAdmission;
            processedForm.rollNo = form.rollNo;
            processedForm.mobileNo = form.mobileNo;
            processedForm.registrationFee = form.registrationFee;
            processedForm.department = form.department;
            processedForm.bankDetails = form.bankDetails || {};
            processedForm.authors = form.authors || [];
            processedForm.paperLink = form.paperLink;
            break;
        case "R1":
            // The general branch line above will handle this unless explicitly overridden here.
            // processedForm.branch = userBranchFromRequest || form.branch || "N/A";

            if (form.studentSignatureFileId) {
                processedForm.studentSignature = await getFileDetailsAndUrl(form.studentSignatureFileId, fileBaseUrl);
            }
            if (form.guideSignatureFileId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignatureFileId, fileBaseUrl);
            }
            if (form.hodSignatureFileId) {
                processedForm.hodSignature = await getFileDetailsAndUrl(form.hodSignatureFileId, fileBaseUrl);
            }
            if (form.sdcChairpersonSignatureFileId) {
                processedForm.sdcChairpersonSignature = await getFileDetailsAndUrl(form.sdcChairpersonSignatureFileId, fileBaseUrl);
            }
            if (form.proofDocumentFileId) { // For a single proof document
                processedForm.proofDocument = await getFileDetailsAndUrl(form.proofDocumentFileId, fileBaseUrl);
            }
            if (form.pdfFileIds && form.pdfFileIds.length > 0) { // For multiple PDF attachments
                const pdfFileDetailsPromises = form.pdfFileIds.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                processedForm.pdfFileUrls = (await Promise.all(pdfFileDetailsPromises)).filter(Boolean);
            }
            if (form.zipFileId) {
                processedForm.zipFile = await getFileDetailsAndUrl(form.zipFileId, fileBaseUrl);
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

        // --- AUTHORIZATION LOGIC BASED ON ROLE ---
        // IMPORTANT: In a production environment, you should verify the user's role
        // via a secure mechanism (e.g., JWT token verification) on the backend,
        // rather than solely trusting the 'role' sent from the client.
        // For this exercise, we are trusting the client-provided 'role'.

        // If the user is NOT a validator (or admin/coordinator), they can only view their own applications.
        // Adjust the roles array ['validator', 'admin', 'coordinator'] based on your actual roles
        // that are allowed to view all applications.
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

        const processedApplication = await processFormForDisplay(application, foundType, userBranch);
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
    const gfsBucket = getGfsBucket(); // Get the initialized gfsBucket
    if (!gfsBucket) {
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