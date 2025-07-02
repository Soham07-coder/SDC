import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import UG3AForm from '../models/UG3AForm.js'; // Your Mongoose model
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB individual file size limit
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'uploadedImage') {
            if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid image type for uploadedImage:', file.mimetype);
                cb(new Error('Invalid image type. Only JPEG/PNG allowed for uploadedImage.'));
            }
        } else if (file.fieldname === 'uploadedZipFile') {
            if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid file type for uploadedZipFile:', file.mimetype);
                cb(new Error('Invalid file type. Only ZIP files allowed for uploadedZipFile.'));
            }
        } else if (file.fieldname === 'uploadedPdfs') {
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid PDF type for uploadedPdfs:', file.mimetype);
                cb(new Error('Invalid PDF type. Only PDF files allowed for uploadedPdfs.'));
            }
        } else {
            cb(null, true); // Accept other files if any (consider if this is desired behavior)
        }
    }
});

// Helper function to upload a file buffer to GridFS and return its metadata
const uploadToGridFS = (bucket, file) => {
    return new Promise((resolve, reject) => {
        if (!file || !file.buffer) { // Ensure file and its buffer exist
            resolve(null); // Resolve with null if no file or buffer
            return;
        }
        const { buffer, originalname, mimetype, size } = file;

        if (!bucket) {
            return reject(new Error("GridFSBucket is not initialized."));
        }

        const stream = bucket.openUploadStream(originalname, {
            contentType: mimetype,
            metadata: { originalname, mimetype, size }
        });

        stream.end(buffer);

        stream.on("finish", () => {
            console.log(`✅ GridFS Upload Success: ${originalname} (ID: ${stream.id})`); // Log inside GridFS helper
            resolve({
                filename: originalname,
                fileId: stream.id,
                mimetype: mimetype,
                size: size
            });
        });

        stream.on("error", (error) => {
            console.error("GridFS upload error:", error);
            reject(error);
        });
    });
};

// 🔹 Submit UG3A Form (Updated for GridFS and matching frontend field names)
router.post("/submit", upload.fields([
    { name: "uploadedImage", maxCount: 1 },
    { name: "uploadedPdfs", maxCount: 5 },
    { name: "uploadedZipFile", maxCount: 1 }
]), async (req, res) => {
    try {
        const { organizingInstitute, projectTitle, students, expenses, bankDetails, svvNetId } = req.body;

        if (!svvNetId) {
            return res.status(400).json({ message: "svvNetId is required for form submission." });
        }

        const parsedStudents = students ? JSON.parse(students) : [];
        const parsedExpenses = expenses ? JSON.parse(expenses) : [];
        const parsedBankDetails = bankDetails ? JSON.parse(bankDetails) : {};

        const totalAmount = parsedExpenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        if (!mongoose.connection.readyState) {
            console.error("MongoDB connection not established.");
            return res.status(500).json({ error: "Database connection not ready." });
        }
        const db = mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: "uploads" });

        // Initialize file detail variables
        let uploadedImageDetails = null;
        const uploadedPdfDetails = [];
        let uploadedZipFileDetails = null;

        // Process uploaded files BEFORE creating the newForm instance
        if (req.files && req.files.uploadedImage && req.files.uploadedImage.length > 0) {
            const imageFile = req.files.uploadedImage[0];
            uploadedImageDetails = await uploadToGridFS(bucket, imageFile); // Pass bucket to helper
            console.log(`✅ Image Uploaded and Linked:`, uploadedImageDetails.filename);
        }

        if (req.files && req.files.uploadedPdfs && req.files.uploadedPdfs.length > 0) {
            for (const file of req.files.uploadedPdfs) {
                const pdfData = await uploadToGridFS(bucket, file); // Pass bucket to helper
                if (pdfData) {
                    uploadedPdfDetails.push(pdfData);
                }
            }
            console.log(`✅ PDFs Uploaded and Linked:`, uploadedPdfDetails.map(d => d.filename).join(', '));
        }

        if (req.files && req.files.uploadedZipFile && req.files.uploadedZipFile.length > 0) {
            const zipFile = req.files.uploadedZipFile[0];
            uploadedZipFileDetails = await uploadToGridFS(bucket, zipFile); // Pass bucket to helper
            console.log(`✅ ZIP File Uploaded and Linked:`, uploadedZipFileDetails.filename);
        }

        // Now create the newForm instance with all processed file details
        const newForm = new UG3AForm({
            svvNetId: svvNetId,
            organizingInstitute,
            projectTitle,
            students: parsedStudents,
            expenses: parsedExpenses,
            totalAmount,
            bankDetails: parsedBankDetails,
            uploadedImage: uploadedImageDetails,
            uploadedPdfs: uploadedPdfDetails,
            uploadedZipFile: uploadedZipFileDetails
        });

        await newForm.save();
        console.log("UG3A Form saved to DB:", newForm._id); // Log after saving the complete form
        res.status(201).json({ message: "UG3A Form submitted successfully. Files stored in GridFS.", data: newForm });

    } catch (error) {
        console.error("UG3A Form Submission Error:", error);
        if (error instanceof SyntaxError) {
            return res.status(400).json({ error: "Invalid JSON data in form fields." });
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        res.status(500).json({ error: "An error occurred while submitting the form." });
    }
});

// --- Route for Retrieving Files from GridFS (Fix: Add validation for fileId) ---
router.get('/file/:fileId', async (req, res) => {
    try {
        const fileIdString = req.params.fileId;

        // Validate if fileIdString is a valid MongoDB ObjectId format (24 hex characters)
        if (!mongoose.Types.ObjectId.isValid(fileIdString)) {
            console.error('Invalid file ID format received:', fileIdString);
            return res.status(400).json({ error: 'Invalid file ID format. Must be a 24-character hex string.' });
        }

        const fileId = new mongoose.Types.ObjectId(fileIdString); // Create ObjectId only after validation

        if (!mongoose.connection.readyState) {
            return res.status(500).json({ error: "Database connection not ready." });
        }
        const db = mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: 'uploads' });

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
            res.status(500).json({ error: 'Error retrieving file from GridFS.' });
        });

        downloadStream.pipe(res);

    } catch (error) {
        console.error('Error retrieving file from GridFS:', error);
        // The BSONTypeError is now handled by the explicit isValid check, but keep a general catch-all
        res.status(500).json({ error: 'Server error while retrieving file.' });
    }
});

export default router;