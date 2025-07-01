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
        // console.log('Multer: Filtering file:', file.originalname, 'Mimetype:', file.mimetype);
        // Ensure you have valid types for all expected files
        // Match the field names as sent by the frontend: 'uploadedImage', 'uploadedPdfs', 'uploadedZipFile'
        if (file.fieldname === 'uploadedImage') { // Matches frontend 'uploadedImage'
            if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid image type for uploadedImage:', file.mimetype);
                cb(new Error('Invalid image type. Only JPEG/PNG allowed for uploadedImage.'));
            }
        } else if (file.fieldname === 'uploadedZipFile') { // Matches frontend 'uploadedZipFile'
            if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid file type for uploadedZipFile:', file.mimetype);
                cb(new Error('Invalid file type. Only ZIP files allowed for uploadedZipFile.'));
            }
        } else if (file.fieldname === 'uploadedPdfs') { // Matches frontend 'uploadedPdfs'
            if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid PDF type for uploadedPdfs:', file.mimetype);
                cb(new Error('Invalid PDF type. Only PDF files allowed for uploadedPdfs.'));
            }
        } else {
            cb(null, true); // Accept other files if any
        }
    }
});

// Helper function to upload a file buffer to GridFS and return its metadata
const uploadToGridFS = (bucket, file) => {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
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
// Note: This endpoint should handle the 'uploads' bucket as per the existing code.
router.post("/submit", upload.fields([
    { name: "uploadedImage", maxCount: 1 }, // NOW MATCHES FRONTEND 'uploadedImage'
    { name: "uploadedPdfs", maxCount: 5 },   // NOW MATCHES FRONTEND 'uploadedPdfs'
    { name: "uploadedZipFile", maxCount: 1 } // NOW MATCHES FRONTEND 'uploadedZipFile'
]), async (req, res) => {
    try {
        const { organizingInstitute, projectTitle, students, expenses, bankDetails, svvNetId } = req.body; // <--- Extract svvNetId

        // Basic validation for svvNetId
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
        const bucket = new GridFSBucket(db, { bucketName: "uploads" }); // Ensure this bucket matches where you store UG3A files

        let uploadedImageDetails = null;
        const uploadedPdfDetails = [];
        let uploadedZipFileDetails = null;

        // Process image upload - using the correct field name 'uploadedImage'
        if (req.files && req.files.uploadedImage && req.files.uploadedImage[0]) {
            uploadedImageDetails = await uploadToGridFS(bucket, req.files.uploadedImage[0]);
        }

        // Process PDF files upload - using the correct field name 'uploadedPdfs'
        if (req.files && req.files.uploadedPdfs && req.files.uploadedPdfs.length > 0) {
            for (const pdfFile of req.files.uploadedPdfs) {
                const pdfDetail = await uploadToGridFS(bucket, pdfFile);
                if (pdfDetail) {
                    uploadedPdfDetails.push(pdfDetail);
                }
            }
        }

        // Process ZIP file upload - using the correct field name 'uploadedZipFile'
        if (req.files && req.files.uploadedZipFile && req.files.uploadedZipFile[0]) {
            uploadedZipFileDetails = await uploadToGridFS(bucket, req.files.uploadedZipFile[0]);
        }

        const newForm = new UG3AForm({
            svvNetId: svvNetId, // <--- Add svvNetId to the Mongoose document
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

// --- Route for Retrieving Files from GridFS (remains the same) ---
router.get('/file/:fileId', async (req, res) => {
    try {
        const fileId = new mongoose.Types.ObjectId(req.params.fileId);

        if (!mongoose.connection.readyState) {
            return res.status(500).json({ error: "Database connection not ready." });
        }
        const db = mongoose.connection.db;
        const bucket = new GridFSBucket(db, { bucketName: 'uploads' }); // This bucket name should match the one used for storing files

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
        if (error.name === 'BSONTypeError') {
            return res.status(400).json({ error: 'Invalid file ID format.' });
        }
        res.status(500).json({ error: 'Server error while retrieving file.' });
    }
});

export default router;
