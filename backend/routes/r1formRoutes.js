import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { GridFSBucket } from 'mongodb';
import R1Form from '../models/R1Form.js'; // Assuming R1Form model schema is correct
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// === GridFSBucket Initialization ===
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
    gfsBucket = new GridFSBucket(conn.db, { bucketName: 'r1files' });
    console.log("✅ GridFSBucket for R1 forms initialized (using 'r1files' bucket)");
});

// === Multer Setup ===
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // Max file size limit
});

const uploadFields = upload.fields([
    { name: 'proofDocument', maxCount: 1 },         // Single file for proof
    { name: 'studentSignature', maxCount: 1 },
    { name: 'guideSignature', maxCount: 1 },
    { name: 'hodSignature', maxCount: 1 },
    { name: 'sdcChairpersonSignature', maxCount: 1 }, // Optional signature
    { name: 'pdfs', maxCount: 5 },                   // Multiple PDF attachments
    { name: 'zipFile', maxCount: 1 },               // Single ZIP file
]);

// === Helper to Upload File Buffer to GridFS ===
// Returns a Promise that resolves with full metadata object if successful, or null if no file.
const uploadFileToGridFS = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }

        if (!gfsBucket) {
            return reject(new Error("GridFSBucket is not initialized. Cannot upload file."));
        }

        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
            contentType: file.mimetype,
            metadata: { originalName: file.originalname, size: file.size }
        });

        uploadStream.end(file.buffer);

        uploadStream.on('finish', () => {
            resolve({
                id: uploadStream.id, // This is the Mongoose ObjectId, but as a BSON ObjectId object
                filename: file.originalname,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            });
        });

        uploadStream.on('error', (error) => {
            console.error("GridFS upload stream error:", error);
            reject(error);
        });
    });
};

// === POST /submit route for R1Form ===
router.post('/submit', uploadFields, async (req, res) => {
    // Array to keep track of uploaded file metadata objects for potential rollback
    const uploadedFileMetadataForRollback = [];

    try {
        console.log('R1 Form: Received body keys:', Object.keys(req.body));
        console.log('R1 Form: Received files keys BEFORE processing:', Object.keys(req.files || {}));

        // Destructure text fields from req.body
        const {
            svvNetId,
            guideName,
            coGuideName,
            employeeCodes,
            studentName,
            yearOfAdmission,
            branch,
            rollNo,
            mobileNo,
            feesPaid,
            receivedFinance, // This should be 'Yes' or 'No' string from frontend
            financeDetails,
            paperTitle,
            paperLink,
            sttpTitle,
            organizers,
            reasonForAttending,
            numberOfDays,
            dateFrom,
            dateTo,
            registrationFee,
            amountClaimed,
            finalAmountSanctioned,
            status,
            dateOfSubmission,
            remarksByHod,
        } = req.body;

        // --- Basic Validation for svvNetId ---
        if (!svvNetId || typeof svvNetId !== 'string' || svvNetId.trim() === '') {
            return res.status(400).json({ message: "svvNetId is required and must be a non-empty string for form submission." });
        }

        // Parse JSON fields from strings if they were stringified on the frontend
        const authors = req.body.authors ? JSON.parse(req.body.authors) : [];
        const bankDetails = req.body.bankDetails ? JSON.parse(req.body.bankDetails) : null;
        const parsedEmployeeCodes = employeeCodes ? (typeof employeeCodes === 'string' ? JSON.parse(employeeCodes) : employeeCodes) : [];


        // Extract file arrays/objects from req.files (Multer's output structure)
        const {
            proofDocument,
            studentSignature,
            guideSignature,
            hodSignature,
            sdcChairpersonSignature,
            pdfs = [],
            zipFile,
        } = req.files || {};

        // --- Required Files Validation (Pre-upload) ---
        if (!studentSignature?.[0]) return res.status(400).json({ error: 'Student signature is required.' });
        if (!guideSignature?.[0]) return res.status(400).json({ error: 'Guide signature is required.' });
        if (!hodSignature?.[0]) return res.status(400).json({ error: 'HOD signature is required.' });

        // Proof document can be a single 'proofDocument' or one or more 'pdfs'
        if (!proofDocument?.[0] && pdfs.length === 0) {
            return res.status(400).json({ error: 'At least one proof document (e.g., single PDF or multiple PDFs) is required.' });
        }

        // --- Upload Files to GridFS and Collect Metadata ---
        // Store full metadata objects in `uploadedFileMetadataForRollback`
        const uploadedStudentSignature = await uploadFileToGridFS(studentSignature[0]);
        if (uploadedStudentSignature) uploadedFileMetadataForRollback.push(uploadedStudentSignature);

        const uploadedGuideSignature = await uploadFileToGridFS(guideSignature[0]);
        if (uploadedGuideSignature) uploadedFileMetadataForRollback.push(uploadedGuideSignature);

        const uploadedHodSignature = await uploadFileToGridFS(hodSignature[0]);
        if (uploadedHodSignature) uploadedFileMetadataForRollback.push(uploadedHodSignature);

        const uploadedProofDocument = proofDocument?.[0] ? await uploadFileToGridFS(proofDocument[0]) : null;
        if (uploadedProofDocument) uploadedFileMetadataForRollback.push(uploadedProofDocument);

        const uploadedSdcChairpersonSignature = sdcChairpersonSignature?.[0] ? await uploadFileToGridFS(sdcChairpersonSignature[0]) : null;
        if (uploadedSdcChairpersonSignature) uploadedFileMetadataForRollback.push(uploadedSdcChairpersonSignature);

        // Map over `pdfs` array and upload each, collecting their metadata
        const uploadedPdfs = await Promise.all(pdfs.map(file => uploadFileToGridFS(file)));
        uploadedPdfs.forEach(meta => { if(meta) uploadedFileMetadataForRollback.push(meta); });

        const uploadedZipFile = zipFile?.[0] ? await uploadFileToGridFS(zipFile[0]) : null;
        if (uploadedZipFile) uploadedFileMetadataForRollback.push(uploadedZipFile);


        // --- Create and Save R1Form Document ---
        const newForm = new R1Form({
            svvNetId: svvNetId, // Assign the validated svvNetId
            guideName,
            coGuideName: coGuideName || '',
            employeeCodes: parsedEmployeeCodes,
            studentName,
            yearOfAdmission,
            branch,
            rollNo,
            mobileNo,
            feesPaid,
            receivedFinance: receivedFinance, // Use string directly (e.g., 'Yes' or 'No')
            financeDetails: financeDetails || '',

            paperTitle: paperTitle || '',
            paperLink: paperLink || '',
            authors: authors,

            sttpTitle: sttpTitle || '',
            organizers: organizers || '',
            reasonForAttending: reasonForAttending || '',
            numberOfDays: numberOfDays ? Number(numberOfDays) : 0,
            dateFrom: dateFrom ? new Date(dateFrom) : null,
            dateTo: dateTo ? new Date(dateTo) : null,
            registrationFee: registrationFee || '',

            bankDetails: bankDetails,

            amountClaimed: amountClaimed || '',
            finalAmountSanctioned: finalAmountSanctioned || '',
            status: status || 'pending',

            // --- IMPORTANT FIXES: Assign only the `id` from the metadata object ---
            // For single files, assign `id` or null
            proofDocumentFileId: uploadedProofDocument?.id || uploadedPdfs[0]?.id || null, // Assign single proof, or first PDF if no dedicated proofDocument
            studentSignatureFileId: uploadedStudentSignature?.id || null,
            guideSignatureFileId: uploadedGuideSignature?.id || null,
            hodSignatureFileId: uploadedHodSignature?.id || null,
            sdcChairpersonSignatureFileId: uploadedSdcChairpersonSignature?.id || null,

            // For arrays of files, map to an array of `id`s
            pdfFileIds: uploadedPdfs.filter(Boolean).map(f => f.id), // Filter out any nulls from Promise.all
            zipFileId: uploadedZipFile?.id || null, // Assign `id` or null

            dateOfSubmission: dateOfSubmission ? new Date(dateOfSubmission) : null,
            remarksByHod: remarksByHod || '',
            // Ensure sdcChairpersonDate is handled if it's in your schema
            // sdcChairpersonDate: req.body.sdcChairpersonDate ? new Date(req.body.sdcChairpersonDate) : null,
        });

        // Save the form document to MongoDB
        await newForm.save();

        // Clear the rollback list upon successful save
        uploadedFileMetadataForRollback.length = 0;
        res.status(201).json({ message: '✅ R1 form submitted successfully!', id: newForm._id });

    } catch (error) {
        console.error('❌ R1 form submission error:', error);

        // --- Rollback: Delete uploaded files from GridFS in case of an error ---
        for (const fileMetadata of uploadedFileMetadataForRollback) {
            if (fileMetadata && fileMetadata.id && gfsBucket) {
                try {
                    // Use new mongoose.Types.ObjectId(fileMetadata.id) to ensure correct type for deletion
                    await gfsBucket.delete(new mongoose.Types.ObjectId(fileMetadata.id));
                    console.log(`🧹 Deleted uploaded file during rollback: ${fileMetadata.id}`);
                } catch (deleteErr) {
                    console.error(`❌ Failed to delete file ${fileMetadata.id} during rollback:`, deleteErr.message);
                }
            }
        }

        // --- Enhanced Error Handling ---
        if (error instanceof SyntaxError && (error.message.includes('JSON') || error.message.includes('Unexpected token'))) {
            return res.status(400).json({ error: "Invalid JSON format in submitted data (e.g., authors, bankDetails, employeeCodes)." });
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        // Mongoose validation errors (e.g., if a required field is missing or cast fails)
        if (error.name === 'ValidationError') {
            const errors = Object.keys(error.errors).map(key => error.errors[key].message);
            return res.status(400).json({ error: 'Form validation failed: ' + errors.join(', ') });
        }

        res.status(500).json({ error: 'Failed to submit R1 form', details: error.message });
    }
});

// === GET /file/:fileId Route for Serving Files ===
router.get('/file/:fileId', async (req, res) => {
    try {
        const fileId = new mongoose.Types.ObjectId(req.params.fileId);

        if (!mongoose.connection.readyState) {
            return res.status(503).json({ error: "Database connection not ready. Try again later." });
        }
        const bucket = gfsBucket || new GridFSBucket(mongoose.connection.db, { bucketName: 'r1files' });

        const files = await bucket.find({ _id: fileId }).toArray();
        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found in GridFS.' });
        }

        const file = files[0];

        res.set('Content-Type', file.contentType || 'application/octet-stream');
        res.set('Content-Disposition', `inline; filename="${file.filename}"`);

        const downloadStream = bucket.openDownloadStream(fileId);

        downloadStream.on('error', (err) => {
            console.error('Error in GridFS download stream:', err);
            res.status(500).json({ error: 'Error retrieving file from GridFS stream.' });
        });

        downloadStream.pipe(res);

    } catch (error) {
        console.error('Error in /file/:fileId route:', error);
        if (error.name === 'BSONTypeError') {
            return res.status(400).json({ error: 'Invalid file ID format provided.' });
        }
        res.status(500).json({ error: 'Server error while retrieving file.' });
    }
});

export default router;
