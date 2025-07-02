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
        originalName: fileData.metadata?.originalName || fileData.filename,
        filename: fileData.filename,
        mimetype: fileData.contentType,
        size: fileData.length,
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
    processedForm.formId = form._id.toString();
    processedForm.topic = form.projectTitle || form.paperTitle || form.topic || "Untitled Project";
    processedForm.name = form.studentName || form.applicantName || form.students?.[0]?.name || form.studentDetails?.[0]?.studentName || "N/A";
    processedForm.branch = userBranchFromRequest || form.branch || form.department || form.students?.[0]?.branch || form.studentDetails?.[0]?.branch || "N/A";
    processedForm.rollNumber = form.rollNumber || form.rollNo || form.students?.[0]?.rollNo || form.studentDetails?.[0]?.rollNumber || "N/A";
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
            if (form.groupLeaderSignature?.fileId) {
                processedForm.groupLeaderSignature = await getFileDetailsAndUrl(form.groupLeaderSignature.fileId, fileBaseUrl);
            }
            if (form.guideSignature?.fileId) {
                processedForm.guideSignature = await getFileDetailsAndUrl(form.guideSignature.fileId, fileBaseUrl);
            }

            if (form.uploadedFiles?.length > 0) {
                const allFiles = await Promise.all(
                    form.uploadedFiles.map(fileMeta => getFileDetailsAndUrl(fileMeta.fileId, fileBaseUrl))
                );

                const pdfs = [];
                let zip = null;

                for (const file of allFiles) {
                    if (!file) continue;
                    if (file.mimetype === "application/pdf") {
                        pdfs.push(file);
                    } else if (
                        file.mimetype === "application/zip" ||
                        file.mimetype === "application/x-zip-compressed"
                    ) {
                        zip = file;
                    }
                }

                processedForm.pdfFileUrls = pdfs;
                processedForm.zipFile = zip || null;
            }
            processedForm.projectDescription = form.projectDescription;
            processedForm.utility = form.utility;
            processedForm.receivedFinance = form.receivedFinance;
            processedForm.financeDetails = form.financeDetails;
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
            processedForm.branch = form.department || userBranchFromRequest || "N/A";
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
            if (form.studentDetails?.length > 0) {
                processedForm.name = form.studentDetails[0].name || "N/A";
                processedForm.rollNumber = form.studentDetails[0].rollNo || "N/A";
                processedForm.branch = form.studentDetails[0].branch || "N/A";
            }
            processedForm.department = form.department || "N/A";
            processedForm.expenses = form.expenses || [];
            processedForm.bankDetails = form.bankDetails || {};
            processedForm.organizingInstitute = form.organizingInstitute || "N/A";
            processedForm.guideNames = form.guideName ? [form.guideName] : [];
            processedForm.employeeCodes = form.employeeCode ? [form.employeeCode] : [];

            if (form.files) {
                if (form.files.bills?.length > 0) {
                    const billFilePromises = form.files.bills.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                    processedForm.bills = (await Promise.all(billFilePromises)).filter(Boolean);
                }
                if (form.files.zips?.length > 0) {
                    const zipFilePromises = form.files.zips.map(id => getFileDetailsAndUrl(id, fileBaseUrl));
                    processedForm.zipFile = (await Promise.all(zipFilePromises)).filter(Boolean)[0] || null;
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
/**
 * @route GET /api/application/pending
 * @desc Fetch all pending applications from all form collections for the authenticated user (all branches)
 * @access Private (requires authentication)
 * @queryParam {string} svvNetId - Required: The svvNetId of the currently logged-in user.
 */
router.get("/pending", async (req, res) => {
  try {
    const svvNetId = req.query.svvNetId;
    const userBranch = req.query.userBranch;
    const showAll = req.query.all === "true";

    // Default filter: only 'pending' applications
    const facultyFilter = {
      status: /^pending$/i,
    };

    // Optional: Filter by currentApprover if not showing all
    if (!showAll && svvNetId) {
      facultyFilter.currentApprover = svvNetId;
    }

    // Optional: Add flexible branch filter if provided and not showing all
    if (!showAll && userBranch) {
      const branchRegex = /^(COMPS|comp|computer\s*Engg|Comp\s*Engg)$/i;
      if (branchRegex.test(userBranch)) {
        facultyFilter.branch = {
          $regex: /COMPS|comp|computer\s*Engg|Comp\s*Engg/i,
          $options: "i",
        };
      }
    }

    // Fetch all forms with filters
    const [
      ug1Forms,
      ug2Forms,
      ug3aForms,
      ug3bForms,
      pg1Forms,
      pg2aForms,
      pg2bForms,
      r1Forms,
    ] = await Promise.all([
      UG1Form.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      UGForm2.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      UG3AForm.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      UG3BForm.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      PG1Form.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      PG2AForm.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      PG2BForm.find(facultyFilter).sort({ createdAt: -1 }).lean(),
      R1Form.find(facultyFilter).sort({ createdAt: -1 }).lean(),
    ]);

    // Tag with formType and format output
    const results = await Promise.all([
      ...ug1Forms.map((f) => processFormForDisplay(f, "UG_1")),
      ...ug2Forms.map((f) => processFormForDisplay(f, "UG_2")),
      ...ug3aForms.map((f) => processFormForDisplay(f, "UG_3_A")),
      ...ug3bForms.map((f) => processFormForDisplay(f, "UG_3_B")),
      ...pg1Forms.map((f) => processFormForDisplay(f, "PG_1")),
      ...pg2aForms.map((f) => processFormForDisplay(f, "PG_2_A")),
      ...pg2bForms.map((f) => processFormForDisplay(f, "PG_2_B")),
      ...r1Forms.map((f) => processFormForDisplay(f, "R1")),
    ]);

    res.json(results);
  } catch (error) {
    console.error("❌ Error in /facapplication/pending:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const statusQuery = {
      pending: { status: /^pending$/i },
      // FIX: Include both 'approved' and 'accepted' (case-insensitive)
      approved: { status: { $in: [/^approved$/i, /^accepted$/i] } },
      rejected: { status: /^rejected$/i },
    };

    const forms = [
      UG1Form, UGForm2, UG3AForm, UG3BForm,
      PG1Form, PG2AForm, PG2BForm, R1Form,
    ];

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const Form of forms) {
      const [p, a, r] = await Promise.all([
        Form.countDocuments(statusQuery.pending),
        Form.countDocuments(statusQuery.approved),
        Form.countDocuments(statusQuery.rejected),
      ]);
      pending += p;
      approved += a;
      rejected += r;
    }

    res.json({ pending, approved, rejected });
  } catch (err) {
    console.error("Stats fetch error:", err);
    res.status(500).json({ message: "Stats fetch error" });
  }
});

router.patch("/:id/update-status", async (req, res) => {
  const { id } = req.params; // Get the application ID from the URL parameter
  const { status, remarks } = req.body; // Get status and remarks from the request body

  // Basic input validation
  if (!id || !status || !remarks) {
    return res.status(400).json({ message: "Application ID, status, and remarks are required." });
  }
  if (!['approved', 'rejected', 'pending'].includes(status.toLowerCase())) {
    return res.status(400).json({ message: "Invalid status provided." });
  }

  // Define an array of all your form models
  const allFormModels = [
    UG1Form, UGForm2, UG3AForm, UG3BForm,
    PG1Form, PG2AForm, PG2BForm, R1Form
  ];

  try {
    let updatedForm = null;

    // Iterate through all models to find and update the form
    for (const Model of allFormModels) {
      // Find the document by its _id and update its status and remarks
      // { new: true } returns the updated document
      updatedForm = await Model.findByIdAndUpdate(
        id,
        { status: status, remarks: remarks },
        { new: true }
      );

      // If a form was found and updated in the current model, break the loop
      if (updatedForm) {
        break;
      }
    }

    if (!updatedForm) {
      return res.status(404).json({ message: "Application not found in any collection." });
    }

    console.log(`Application ${id} status updated to ${status} with remarks: "${remarks}"`);

    res.status(200).json({
      message: "Application status updated successfully",
      updatedApplication: processFormForDisplay(updatedForm, updatedForm.formType), // Process and send back
    });
  } catch (error) {
    console.error("Error updating application status:", error);
    res.status(500).json({ message: "Server error during status update." });
  }
});

router.get("/accepted", async (req, res) => {
  try {
    const userBranch = req.query.userBranch;
    const all = req.query.all === "true"; // from ?all=true

    const filter = {
      status: { $in: [/^approved$/i, /^accepted$/i] },
    };

    // Optional branch filter
    if (userBranch) {
      filter.branch = userBranch;
    }

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
      UG1Form.find(filter).sort({ createdAt: -1 }).lean(),
      UGForm2.find(filter).sort({ createdAt: -1 }).lean(),
      UG3AForm.find(filter).sort({ createdAt: -1 }).lean(),
      UG3BForm.find(filter).sort({ createdAt: -1 }).lean(),
      PG1Form.find(filter).sort({ createdAt: -1 }).lean(),
      PG2AForm.find(filter).sort({ createdAt: -1 }).lean(),
      PG2BForm.find(filter).sort({ createdAt: -1 }).lean(),
      R1Form.find(filter).sort({ createdAt: -1 }).lean(),
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
    const all = req.query.all === "true"; // optional, not used here but kept for consistency

    const filter = {
      status: /^rejected$/i,
    };

    // Optional branch filter
    if (userBranch) {
      filter.branch = userBranch;
    }

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
      UG1Form.find(filter).sort({ createdAt: -1 }).lean(),
      UGForm2.find(filter).sort({ createdAt: -1 }).lean(),
      UG3AForm.find(filter).sort({ createdAt: -1 }).lean(),
      UG3BForm.find(filter).sort({ createdAt: -1 }).lean(),
      PG1Form.find(filter).sort({ createdAt: -1 }).lean(),
      PG2AForm.find(filter).sort({ createdAt: -1 }).lean(),
      PG2BForm.find(filter).sort({ createdAt: -1 }).lean(),
      R1Form.find(filter).sort({ createdAt: -1 }).lean(),
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

router.post("/view/ug1", async (req, res) => {
  const { formId } = req.body;

  try {
    const form = await UG1Form.findById(formId);
    if (!form) return res.status(404).json({ error: "Form not found" });
    const processed = await processFormForDisplay(form, "UG_1");

    const guides = (form.guides || []).map((g) => ({
      guideName: g.guideName || "",
      employeeCode: g.employeeCode || "",
    }));

    const students = (form.studentDetails || []).map((s) => ({
      studentName: s.studentName || "",
      rollNumber: s.rollNumber || "",
      branch: s.branch || "",
      yearOfStudy: s.yearOfStudy || "",
    }));

    res.json({
      projectTitle: form.projectTitle,
      projectUtility: form.projectUtility,
      projectDescription: form.projectDescription,
      finance: form.finance,
      amountClaimed: form.amountClaimed || "",
      status: form.status,
      remarks: form.remarks || "",

      guides,
      students,

      pdfFiles: processed.pdfFileUrls || [],  // MATCHES `processFormForDisplay` output
      zipFileDetails: processed.zipFile || null, // optional
      groupLeaderSignature: processed.groupLeaderSignature || null,
      guideSignature: processed.guideSignature || null,
      
    });
  } catch (err) {
    console.error("Error fetching UG1 form for faculty view:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/view/ug2", async (req, res) => {
  const { formId } = req.body;

  try {
    const form = await UGForm2.findById(formId).lean(); // Use .lean() for plain JS objects, generally good practice for read-only ops
    if (!form) return res.status(404).json({ error: "Form not found" });

    const fileBaseUrl = `/api/application/file`;

    // === Signatures ===
    // CORRECTED: Access guideSignatureId directly
    const guideSignature = form.guideSignatureId
      ? await getFileDetailsAndUrl(form.guideSignatureId, fileBaseUrl)
      : null;

    // CORRECTED: Access groupLeaderSignatureId directly
    const groupLeaderSignature = form.groupLeaderSignatureId
      ? await getFileDetailsAndUrl(form.groupLeaderSignatureId, fileBaseUrl)
      : null;

    // === Uploaded Files ===
    let pdfFiles = [];
    let zipFileDetails = null;

    // CORRECTED: Access uploadedFilesIds directly
    if (Array.isArray(form.uploadedFilesIds) && form.uploadedFilesIds.length > 0) {
      const resolvedFiles = await Promise.all(
        // Map directly over the ObjectIDs in uploadedFilesIds
        form.uploadedFilesIds.map((fileObjectId) =>
          getFileDetailsAndUrl(fileObjectId, fileBaseUrl)
        )
      );

      for (const file of resolvedFiles) {
        if (!file) continue; // Skip if getFileDetailsAndUrl returned null (e.g., file not found in GridFS)
        if (file.mimetype === "application/pdf") {
          pdfFiles.push(file);
        } else if (
          file.mimetype === "application/zip" ||
          file.mimetype === "application/x-zip-compressed"
        ) {
          zipFileDetails = file;
        }
      }
    }

    // Prepare guide details for the frontend
    const guide = form.guideDetails?.[0] || {}; // Assuming guideDetails is an array and we take the first element

    const students = (form.students || []).map((s) => ({
        name: s.name || "",
        rollNo: s.rollNo || "",
        branch: s.branch || "",
        year: s.year || "",
        class: s.class || "",
        div: s.div || "",
        mobileNo: s.mobileNo || "",
    }));

    const expenses = (form.expenses || []).map((e) => ({
        category: e.category || "",
        amount: e.amount || 0,
        details: e.details || "",
    }));


    // === Send response ===
    res.json({
      title: form.projectTitle || "",
      description: form.projectDescription || "",
      utility: form.utility || "",
      receivedFinance: form.receivedFinance || false,
      financeDetails: form.financeDetails || "",

      // Send guide details in the format the frontend now expects (single object)
      guide: {
        guideName: guide.name || "",
        employeeCode: guide.employeeCode || "",
      },

      students,
      expenses,
      totalBudget: form.totalBudget || 0,
      status: form.status || "pending",
      remarks: form.remarks || "",

      // Send the processed file data
      pdfFiles, // Renamed in frontend to match this
      zipFileDetails, // Renamed in frontend to match this
      guideSignature, // Correctly matched
      leaderSignature: groupLeaderSignature, // Correctly matched in frontend
    });
  } catch (err) {
    console.error("❌ Error fetching UG2 form for faculty view:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/file/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    const _id = new mongoose.Types.ObjectId(fileId);
    const files = await gfsBucket.find({ _id }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = files[0];

    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${file.filename}"`,
    });

    const downloadStream = gfsBucket.openDownloadStream(_id);
    downloadStream.pipe(res);
  } catch (err) {
    console.error("Error serving file:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// routes/facapplication.js
router.post("/form/ug1", async (req, res) => {
  try {
    const applications = await UG1Form.find().sort({ createdAt: -1 });

    console.log("✅ UG_1 applications fetched:", applications.length);
    return res.status(200).json(applications);
  } catch (error) {
    console.error("❌ Error fetching UG_1 applications:", error);
    return res.status(500).json({ message: "Server error while fetching UG_1 forms" });
  }
});

// UG2 - Return ALL UG2 forms
router.post("/form/ug2", async (req, res) => {
  try {
    const applications = await UGForm2.find().sort({ createdAt: -1 });

    console.log("✅ UG_2 applications fetched:", applications.length);
    return res.status(200).json(applications);
  } catch (error) {
    console.error("❌ Error fetching UG_2 applications:", error);
    return res.status(500).json({ message: "Server error while fetching UG_2 forms" });
  }
});

// UG3A - Return ALL UG3A forms
router.post("/form/ug3a", async (req, res) => {
  try {
    const applications = await UG3AForm.find().sort({ createdAt: -1 });

    console.log("✅ UG_3A applications fetched:", applications.length);
    return res.status(200).json(applications);
  } catch (error) {
    console.error("❌ Error fetching UG_3A applications:", error);
    return res.status(500).json({ message: "Server error while fetching UG_3A forms" });
  }
});

// UG3B - Return ALL UG3B forms
router.post("/form/ug3b", async (req, res) => {
  try {
    const applications = await UG3BForm.find().sort({ createdAt: -1 });

    console.log("✅ UG_3B applications fetched:", applications.length);
    return res.status(200).json(applications);
  } catch (error) {
    console.error("❌ Error fetching UG_3B applications:", error);
    return res.status(500).json({ message: "Server error while fetching UG_3B forms" });
  }
});

// PG1 - Return ALL PG1 forms
router.post("/form/pg1", async (req, res) => {
  try {
    const applications = await PG1Form.find().sort({ createdAt: -1 });
    console.log("✅ PG_1 applications fetched:", applications.length);
    return res.status(200).json(applications);
  } catch (error) {
    console.error("❌ Error fetching PG_1 applications:", error);
    return res.status(500).json({ message: "Server error while fetching PG_1 forms" });
  }
});

// PG2A - Return ALL PG2A forms
router.post("/form/pg2a", async (req, res) => {
  try {
    const rawForms = await PG2AForm.find().sort({ createdAt: -1 });

    const userBranch = req.body.userBranch || null; // Optional filter
    const processedForms = await Promise.all(
      rawForms.map(form => processFormForDisplay(form.toObject(), "PG_2_A", userBranch))
    );

    console.log("✅ PG_2_A applications processed:", processedForms.length);
    return res.status(200).json(processedForms);
  } catch (error) {
    console.error("❌ Error fetching PG_2_A applications:", error);
    return res.status(500).json({ message: "Server error while fetching PG_2_A forms" });
  }
});
// PG2B - Return ALL PG2B forms
router.post("/form/pg2b", async (req, res) => {
  try {
    const applications = await PG2BForm.find().sort({ createdAt: -1 });
    console.log("✅ PG_2_B applications fetched:", applications.length);
    return res.status(200).json(applications);
  } catch (error) {
    console.error("❌ Error fetching PG_2_B applications:", error);
    return res.status(500).json({ message: "Server error while fetching PG_2_B forms" });
  }
});

router.post("/form/r1", async (req, res) => {
  try {
    const rawApplications = await R1Form.find().sort({ createdAt: -1 });
    console.log("✅ R1 applications fetched:", rawApplications.length);

    const processedApplications = await Promise.all(
      rawApplications.map((form) => processFormForDisplay(form.toObject(), "R1"))
    );

    return res.status(200).json(processedApplications);
  } catch (error) {
    console.error("❌ Error fetching R1 applications:", error);
    return res.status(500).json({ message: "Server error while fetching R1 forms" });
  }
});

router.post("/form/deptCoordDashboard", async (req, res) => {
  try {
    const [
      ug1Forms,
      ug2Forms,
      ug3aForms,
      ug3bForms,
      pg1Forms,
      pg2aForms,
      pg2bForms,
      r1Forms,
    ] = await Promise.all([
      UG1Form.find().sort({ createdAt: -1 }).lean(),
      UGForm2.find().sort({ createdAt: -1 }).lean(),
      UG3AForm.find().sort({ createdAt: -1 }).lean(),
      UG3BForm.find().sort({ createdAt: -1 }).lean(),
      PG1Form.find().sort({ createdAt: -1 }).lean(),
      PG2AForm.find().sort({ createdAt: -1 }).lean(),
      PG2BForm.find().sort({ createdAt: -1 }).lean(),
      R1Form.find().sort({ createdAt: -1 }).lean(),
    ]);

    const results = await Promise.all([
      ...ug1Forms.map((f) => processFormForDisplay(f, "UG_1")),
      ...ug2Forms.map((f) => processFormForDisplay(f, "UG_2")),
      ...ug3aForms.map((f) => processFormForDisplay(f, "UG_3_A")),
      ...ug3bForms.map((f) => processFormForDisplay(f, "UG_3_B")),
      ...pg1Forms.map((f) => processFormForDisplay(f, "PG_1")),
      ...pg2aForms.map((f) => processFormForDisplay(f, "PG_2_A")),
      ...pg2bForms.map((f) => processFormForDisplay(f, "PG_2_B")),
      ...r1Forms.map((f) => processFormForDisplay(f, "R1")),
    ]);

    console.log("✅ Total Applications fetched:", results.length);
    return res.json(results);

  } catch (error) {
    console.error("❌ Error in /form/deptCoordDashboard:", error);
    return res.status(500).json({ message: "Server error while fetching applications" });
  }
});


export default router;