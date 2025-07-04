// ug3aFormRoutes.js
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import UG3AForm from '../models/UG3AForm.js'; // Your Mongoose model
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Initialize GridFSBucket globally for this file for consistency (for uploads/rollbacks)
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
    gfsBucket = new GridFSBucket(conn.db, { bucketName: 'uploads' }); // Assuming UG3A files go to 'uploads' bucket
    console.log("✅ GridFSBucket for UG3A forms initialized (using 'uploads' bucket)");
});


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
                console.error('Multer: Invalid zip type for uploadedZipFile:', file.mimetype);
                cb(new Error('Invalid file type. Only ZIP allowed for uploadedZipFile.'));
            }
        } else if (file.fieldname === 'uploadedPdfs') { // Matches frontend 'uploadedPdfs'
             if (file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                console.error('Multer: Invalid PDF type for uploadedPdfs:', file.mimetype);
                cb(new Error('Invalid file type. Only PDF allowed for uploadedPdfs.'));
            }
        }
         else {
            // Allow other fields without specific file type checks for now, or add specific checks
            cb(null, true);
        }
    }
});

const uploadFields = upload.fields([
    { name: 'uploadedImage', maxCount: 1 },
    { name: 'uploadedPdfs', maxCount: 5 },
    { name: 'uploadedZipFile', maxCount: 1 },
    // Add other file fields if any (e.g., signatures)
]);

// POST route to handle form submission and file uploads
router.post('/submit', uploadFields, async (req, res) => {
    const uploadedFileIds = []; // To track uploaded file IDs for rollback

    try {
        const {
            svvNetId,
            organizingInstitute,
            projectTitle,
            students,
            expenses,
            bankDetails,
            totalAmount, // Assuming totalAmount is sent from frontend or calculated
        } = req.body;

        const files = req.files;

        // Helper function to upload a file to GridFS
        const uploadFile = async (file) => {
            if (!file) return null;
            return new Promise((resolve, reject) => {
                if (!gfsBucket) { // Use the globally initialized bucket
                    return reject(new Error("GridFSBucket not initialized for uploads."));
                }
                const uploadStream = gfsBucket.openUploadStream(file.originalname, {
                    contentType: file.mimetype,
                });
                const fileId = uploadStream.id;
                uploadedFileIds.push(fileId); // Add the ObjectId directly to rollback list
                uploadStream.end(file.buffer);
                uploadStream.on('finish', () => resolve({
                    fileId: fileId, // <--- CORRECTED LINE: Mapped 'id' from GridFS to 'fileId' for schema
                    filename: file.originalname,
                    originalname: file.originalname, // Store original name
                    mimetype: file.mimetype,
                    size: file.size,
                }));
                uploadStream.on('error', reject);
            });
        };

        // Upload files
        const uploadedImageData = files.uploadedImage ? await uploadFile(files.uploadedImage[0]) : null;
        const uploadedPdfsData = files.uploadedPdfs ? await Promise.all(files.uploadedPdfs.map(uploadFile)) : [];
        const uploadedZipFileData = files.uploadedZipFile ? await uploadFile(files.uploadedZipFile[0]) : null;

        // Parse JSON strings from req.body
        const parsedStudents = typeof students === 'string' ? JSON.parse(students) : students;
        const parsedExpenses = typeof expenses === 'string' ? JSON.parse(expenses) : expenses;
        const parsedBankDetails = typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;
        
        // Robust totalAmount parsing
        let parsedTotalAmount = parseFloat(totalAmount);
        if (isNaN(parsedTotalAmount)) {
            parsedTotalAmount = 0; // Default to 0 if totalAmount from frontend is NaN or not provided
        }

        const newForm = new UG3AForm({
            svvNetId: svvNetId ? String(svvNetId).trim() : '',
            organizingInstitute,
            projectTitle,
            students: parsedStudents,
            totalAmount: parsedTotalAmount, // Use the parsed and validated totalAmount
            expenses: parsedExpenses,
            bankDetails: parsedBankDetails,
            uploadedImage: uploadedImageData,
            uploadedPdfs: uploadedPdfsData,
            uploadedZipFile: uploadedZipFileData,
            status: 'pending', // Default status. Ensure your schema allows 'pending' (lowercase).
        });

        await newForm.save();
        uploadedFileIds.length = 0; // Clear rollback list upon successful save
        res.status(201).json({ message: 'UG3A form submitted successfully!', id: newForm._id });

    } catch (error) {
       console.error('UG3A form submission error:', error);
        // Rollback: Delete uploaded files if an error occurred
        for (const fileId of uploadedFileIds) { // Iterate directly over ObjectIds
            if (fileId && gfsBucket) { // Check if fileId and gfsBucket are defined
                try {
                    await gfsBucket.delete(fileId); // Use fileId directly
                    console.log(`🧹 Deleted uploaded file due to error: ${fileId}`);
                } catch (deleteErr) {
                    console.error(`❌ Failed to delete file ${fileId} during rollback:`, deleteErr.message);
                }
            }
        }
        res.status(500).json({ error: 'Failed to submit UG3A form.', details: error.message });
    }
});

// GET all UG3A forms
router.get('/all', async (req, res) => {
    try {
        const forms = await UG3AForm.find({});
        res.status(200).json(forms);
    } catch (error) {
        console.error("Error fetching all UG3A forms:", error);
        res.status(500).json({ message: "Server error fetching forms." });
    }
});

// GET UG3A form by ID
router.get('/:formId', async (req, res) => {
    try {
        const form = await UG3AForm.findById(req.params.formId);
        if (!form) return res.status(404).json({ message: "UG3A form not found." });
        res.status(200).json(form);
    } catch (error) {
        console.error("Error fetching UG3A form by ID:", error);
        res.status(500).json({ message: "Server error fetching form." });
    }
});

// PUT (update) UG3A form status
router.put('/:formId/review', async (req, res) => {
    const { formId } = req.params;
    const { status, remarks } = req.body;

    try {
        const form = await UG3AForm.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "UG3A form not found." });
        }

        form.status = status || form.status;
        form.remarks = remarks || form.remarks; // Assuming a remarks field
        await form.save();

        res.status(200).json({ message: "UG3A form review updated successfully." });
    } catch (error) {
        console.error("Error updating UG3A form review:", error);
        res.status(500).json({ message: "Server error updating form review." });
    }
});

router.get('/file/:id', async (req, res) => {
    try {
        if (!gfsBucket) {
            return res.status(500).json({ error: 'GridFSBucket not initialized.' });
        }

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const files = await gfsBucket.find({ _id: fileId }).toArray();

        if (!files || files.length === 0) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const file = files[0];
        res.set('Content-Type', file.contentType);
        const readStream = gfsBucket.openDownloadStream(fileId);
        readStream.pipe(res);
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ error: 'Error fetching file.' });
    }
});

export default router;