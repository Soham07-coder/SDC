import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import PG1Form from '../models/PG1Form.js'; // Assuming this path is correct
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

let gfsBucket;
const conn = mongoose.connection;

conn.once('open', () => {
    gfsBucket = new GridFSBucket(conn.db, { bucketName: 'pg1files' });
    console.log("✅ GridFSBucket initialized for 'pg1files'");
});

const uploadFields = upload.fields([
    { name: 'receiptCopy', maxCount: 1 },
    { name: 'additionalDocuments', maxCount: 1 }, // Assuming only one additional document
    { name: 'guideSignature', maxCount: 1 },
    { name: 'pdfDocuments', maxCount: 5 },
    { name: 'zipFiles', maxCount: 2 }, // Assuming multiple zip files are allowed
]);

// Helper to delete uploaded files in case of form submission failure (rollback)
const rollbackUploadedFiles = async (fileIds) => {
    if (!gfsBucket) {
        console.warn("GridFSBucket not initialized for rollback, skipping file deletion.");
        return;
    }
    for (const fileId of fileIds) {
        try {
            // Ensure fileId is a valid ObjectId before attempting deletion
            if (mongoose.Types.ObjectId.isValid(fileId)) {
                await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
                console.log(`🧹 Rolled back uploaded file: ${fileId}`);
            } else {
                console.warn(`⚠️ Invalid file ID format for rollback: ${fileId}`);
            }
        } catch (rollbackErr) {
            console.error(`⚠️ Rollback failed for file ${fileId}:`, rollbackErr.message);
        }
    }
};


// --- POST Route: Submit PG1 Form ---
router.post('/submit', uploadFields, async (req, res) => {
    const uploadedFileIds = []; // Track files uploaded to GridFS for rollback

    try {
        const {
            studentName,
            yearOfAdmission,
            feesPaid,
            sttpTitle,
            guideName,
            coGuideName,
            numberOfDays,
            dateFrom,
            dateTo,
            organization,
            reason,
            knowledgeUtilization,
            registrationFee,
            previousClaim,
            claimDate,
            amountReceived,
            amountSanctioned,
            svvNetId,
            department,
            // Assuming formId, status are also in req.body for update scenario
            formId // For update operations
        } = req.body;

        // Ensure svvNetId is a single string
        let cleanedSvvNetId = svvNetId;
        if (Array.isArray(svvNetId)) {
            cleanedSvvNetId = svvNetId.find(id => typeof id === "string" && id.trim() !== "") || "";
        }
        if (!cleanedSvvNetId || typeof cleanedSvvNetId !== "string") {
            return res.status(400).json({ message: "svvNetId is required and must be a string." });
        }

        const bankDetails = req.body.bankDetails ? JSON.parse(req.body.bankDetails) : {};

        if (!gfsBucket) {
            throw new Error("GridFSBucket not initialized.");
        }

        // Helper function to upload a single file to GridFS
        const uploadFile = (file) => {
            return new Promise((resolve, reject) => {
                if (!file) return resolve(null); // Resolve with null if no file is provided

                const stream = gfsBucket.openUploadStream(file.originalname, {
                    contentType: file.mimetype,
                    metadata: {
                        originalName: file.originalname,
                        size: file.size,
                    },
                });

                stream.end(file.buffer);

                stream.on("finish", () => {
                    uploadedFileIds.push(stream.id.toString()); // Push as string for consistent tracking
                    resolve({
                        id: stream.id, // ObjectId
                        filename: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size,
                    });
                });

                stream.on("error", (err) => {
                    console.error("Error during GridFS upload stream:", err);
                    reject(new Error(`Failed to upload file ${file.originalname}: ${err.message}`));
                });
            });
        };

        const receiptCopyFile = req.files?.receiptCopy?.[0];
        const guideSignatureFile = req.files?.guideSignature?.[0];
        const additionalDocumentsFile = req.files?.additionalDocuments?.[0]; // Assuming maxCount is 1
        const pdfDocumentsFiles = req.files?.pdfDocuments || [];
        const zipFilesFiles = req.files?.zipFiles || [];

        // Mandatory file check for initial submission
        if (!formId && (!receiptCopyFile || !guideSignatureFile)) {
             // If it's a new form and these are missing, error.
            return res.status(400).json({
                error: "Required files missing: receipt copy and guide signature are mandatory for new submissions.",
            });
        }

        let formToSave;
        if (formId) {
            // --- Update Existing Form Logic ---
            if (!mongoose.Types.ObjectId.isValid(formId)) {
                return res.status(400).json({ message: 'Invalid form ID format for update.' });
            }
            formToSave = await PG1Form.findById(formId);
            if (!formToSave) {
                return res.status(404).json({ message: 'Form not found for update.' });
            }

            // Extract existing file IDs to potentially keep
            const existingReceiptCopyId = formToSave.files?.receiptCopy?.id?.toString();
            const existingGuideSignatureId = formToSave.files?.guideSignature?.id?.toString();
            const existingAdditionalDocumentsId = formToSave.files?.additionalDocuments?.id?.toString();
            const existingPdfDocumentIds = formToSave.files?.pdfDocuments?.map(f => f.id.toString()) || [];
            const existingZipFileIds = formToSave.files?.zipFiles?.map(f => f.id.toString()) || [];

            // Identify files to be deleted (removed or replaced)
            const filesToDelete = [];

            // Process receiptCopy
            let receiptCopyData = formToSave.files?.receiptCopy;
            if (receiptCopyFile) { // New file provided, replace old one
                if (existingReceiptCopyId) filesToDelete.push(existingReceiptCopyId);
                receiptCopyData = await uploadFile(receiptCopyFile);
            } else if (req.body.receiptCopyRemoved === 'true' && existingReceiptCopyId) {
                // Explicitly removed by frontend
                filesToDelete.push(existingReceiptCopyId);
                receiptCopyData = null;
            }
            // If not replaced and not explicitly removed, keep existing receiptCopyData

            // Process guideSignature
            let guideSignatureData = formToSave.files?.guideSignature;
            if (guideSignatureFile) {
                if (existingGuideSignatureId) filesToDelete.push(existingGuideSignatureId);
                guideSignatureData = await uploadFile(guideSignatureFile);
            } else if (req.body.guideSignatureRemoved === 'true' && existingGuideSignatureId) {
                filesToDelete.push(existingGuideSignatureId);
                guideSignatureData = null;
            }

            // Process additionalDocuments (assuming maxCount: 1, if a new one comes, replace)
            let additionalDocumentsData = formToSave.files?.additionalDocuments;
            if (additionalDocumentsFile) {
                if (existingAdditionalDocumentsId) filesToDelete.push(existingAdditionalDocumentsId);
                additionalDocumentsData = await uploadFile(additionalDocumentsFile);
            } else if (req.body.additionalDocumentsRemoved === 'true' && existingAdditionalDocumentsId) {
                filesToDelete.push(existingAdditionalDocumentsId);
                additionalDocumentsData = null;
            }


            // Process pdfDocuments (these need more complex handling for individual removal/addition)
            let currentPdfDocumentsData = formToSave.files?.pdfDocuments || [];
            let newPdfDocumentsData = [];
            // Handle existing PDFs that were explicitly kept by the frontend (by sending their IDs)
            const keptPdfIds = req.body.keptPdfIds ? JSON.parse(req.body.keptPdfIds) : [];
            for (const existingPdf of currentPdfDocumentsData) {
                if (keptPdfIds.includes(existingPdf.id.toString())) {
                    newPdfDocumentsData.push(existingPdf);
                } else {
                    filesToDelete.push(existingPdf.id.toString()); // If not kept, mark for deletion
                }
            }
            // Upload new pdfs
            const newlyUploadedPdfs = await Promise.all(pdfDocumentsFiles.map(uploadFile));
            newPdfDocumentsData = newPdfDocumentsData.concat(newlyUploadedPdfs.filter(Boolean)); // filter(Boolean) removes nulls


            // Process zipFiles (similar to pdfs, handle kept and new)
            let currentZipFilesData = formToSave.files?.zipFiles || [];
            let newZipFilesData = [];
            const keptZipIds = req.body.keptZipIds ? JSON.parse(req.body.keptZipIds) : [];
            for (const existingZip of currentZipFilesData) {
                if (keptZipIds.includes(existingZip.id.toString())) {
                    newZipFilesData.push(existingZip);
                } else {
                    filesToDelete.push(existingZip.id.toString());
                }
            }
            const newlyUploadedZips = await Promise.all(zipFilesFiles.map(uploadFile));
            newZipFilesData = newZipFilesData.concat(newlyUploadedZips.filter(Boolean));


            // Perform actual deletions of old files AFTER new files are uploaded
            if (filesToDelete.length > 0) {
                await rollbackUploadedFiles(filesToDelete); // Reuse rollback function for deletion
            }

            // Update form fields
            formToSave.set({
                svvNetId: cleanedSvvNetId,
                studentName,
                department,
                yearOfAdmission,
                feesPaid,
                sttpTitle,
                guideName,
                coGuideName,
                numberOfDays,
                dateFrom,
                dateTo,
                organization,
                reason,
                knowledgeUtilization,
                bankDetails,
                registrationFee,
                previousClaim,
                claimDate,
                amountReceived,
                amountSanctioned,
                files: {
                    receiptCopy: receiptCopyData,
                    guideSignature: guideSignatureData,
                    additionalDocuments: additionalDocumentsData,
                    pdfDocuments: newPdfDocumentsData,
                    zipFiles: newZipFilesData,
                },
                status: req.body.status || formToSave.status, // Allow status update
                updatedAt: new Date(), // Add an update timestamp
            });

        } else {
            // --- Create New Form Logic ---
            // Upload all files for a new submission
            const receiptCopyData = await uploadFile(receiptCopyFile);
            const guideSignatureData = await uploadFile(guideSignatureFile);
            const additionalDocumentsData = additionalDocumentsFile ? await uploadFile(additionalDocumentsFile) : null;
            const pdfDocumentsData = await Promise.all(pdfDocumentsFiles.map(uploadFile));
            const zipFilesData = await Promise.all(zipFilesFiles.map(uploadFile));

            formToSave = new PG1Form({
                svvNetId: cleanedSvvNetId,
                studentName,
                department,
                yearOfAdmission,
                feesPaid,
                sttpTitle,
                guideName,
                coGuideName,
                numberOfDays,
                dateFrom,
                dateTo,
                organization,
                reason,
                knowledgeUtilization,
                bankDetails,
                registrationFee,
                previousClaim,
                claimDate,
                amountReceived,
                amountSanctioned,
                files: {
                    receiptCopy: receiptCopyData,
                    guideSignature: guideSignatureData,
                    additionalDocuments: additionalDocumentsData,
                    pdfDocuments: pdfDocumentsData.filter(Boolean), // Filter out any nulls
                    zipFiles: zipFilesData.filter(Boolean),
                },
                status: req.body.status || "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        await formToSave.save();
        uploadedFileIds.length = 0; // Clear uploaded IDs on successful save to prevent rollback

        return res.status(200).json({ // Use 200 for update, 201 for create
            message: formId ? "PG1 form updated successfully!" : "PG1 form submitted successfully!",
            id: formToSave._id,
        });

    } catch (err) {
        console.error("❌ PG1 form submission/update error:", err); // Log full error object
        // Rollback any files uploaded during this attempt
        await rollbackUploadedFiles(uploadedFileIds);

        const statusCode = err.name === "ValidationError" || err.message.includes("is required") ? 400 : 500;
        return res.status(statusCode).json({
            error: "Form submission failed.",
            details: err.message,
        });
    }
});

// --- GET Route: Download a specific file by ID ---
// Changed from /download/:fileId to /file/:fileId as per request
router.get('/file/:fileId', async (req, res) => {
    try {
        const fileIdString = req.params.fileId;

        // Validate if fileIdString is a valid MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(fileIdString)) {
            console.error('Invalid file ID format received for download:', fileIdString);
            return res.status(400).json({ error: 'Invalid file ID format. Must be a 24-character hex string.' });
        }

        const fileId = new mongoose.Types.ObjectId(fileIdString);

        if (!mongoose.connection.readyState) {
            return res.status(500).json({ error: "MongoDB not connected." });
        }

        // Ensure gfsBucket is initialized, or initialize if not (should be via conn.once)
        const bucket = gfsBucket || new GridFSBucket(mongoose.connection.db, {
            bucketName: 'pg1files',
        });

        const files = await bucket.find({ _id: fileId }).toArray();
        if (!files.length) {
            return res.status(404).json({ error: "File not found." });
        }

        const file = files[0];

        res.set('Content-Type', file.contentType || 'application/octet-stream');
        // Changed Content-Disposition to 'inline' to allow viewing in browser
        res.set('Content-Disposition', `inline; filename="${file.filename}"`);

        const downloadStream = bucket.openDownloadStream(fileId);

        downloadStream.on('error', (err) => {
            console.error('Error in GridFS download stream for file:', fileId, err);
            res.status(500).json({ error: "Failed to stream file." });
        });

        downloadStream.pipe(res);

    } catch (error) {
        console.error("Download error:", error); // Log full error object
        if (error.name === "BSONTypeError") { // Already handled by isValid, but good fallback
            return res.status(400).json({ error: "Invalid file ID." });
        }
        return res.status(500).json({ error: "Server error while fetching file." });
    }
});

// --- GET Route: Get PG1 Form by ID for Frontend Display ---
router.get('/:id', async (req, res) => {
    try {
        const formId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(formId)) {
            return res.status(400).json({ message: 'Invalid form ID format.' });
        }

        const form = await PG1Form.findById(formId).lean(); // Use .lean() for faster retrieval

        if (!form) {
            return res.status(404).json({ message: 'Form not found.' });
        }

        // Helper to add download URLs to file data objects
        const addFileUrls = (fileData) => {
            if (!fileData) return null; // Handle null/undefined cases
            if (Array.isArray(fileData)) {
                return fileData.map(f => ({
                    ...f,
                    // Ensure f.id exists before creating URL
                    // Updated URL to use /api/pg1form/file/ instead of /api/pg1forms/download/
                    url: f.id ? `http://localhost:5000/api/pg1form/file/${f.id}` : null,
                })).filter(Boolean); // Filter out any null entries if f.id was missing
            } else {
                return {
                    ...fileData,
                    // Updated URL to use /api/pg1form/file/ instead of /api/pg1forms/download/
                    url: fileData.id ? `http://localhost:5000/api/pg1form/file/${fileData.id}` : null,
                };
            }
        };

        const formattedForm = {
            ...form,
            files: {
                receiptCopy: addFileUrls(form.files?.receiptCopy),
                additionalDocuments: addFileUrls(form.files?.additionalDocuments),
                guideSignature: addFileUrls(form.files?.guideSignature),
                pdfDocuments: addFileUrls(form.files?.pdfDocuments) || [],
                zipFiles: addFileUrls(form.files?.zipFiles) || [],
            },
        };

        res.status(200).json(formattedForm);

    } catch (error) {
        console.error("❌ Error fetching PG1 form by ID:", error);
        res.status(500).json({ message: 'Server error fetching form data.', error: error.message });
    }
});

export default router;