// ug3bFormRoutes.js (Updated)
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import UG3BForm from '../models/UG3BForm.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const upload = multer(); // memory storage

// Initialize GridFSBucket
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
    gfsBucket = new GridFSBucket(conn.db, { bucketName: 'ug3bFiles' });
    console.log("✅ GridFSBucket for UG3B forms initialized (using 'ug3bFiles' bucket)");
});

// Submit Route
router.post('/submit', upload.fields([
    { name: 'paperCopy', maxCount: 1 },
    { name: 'groupLeaderSignature', maxCount: 1 },
    { name: 'additionalDocuments', maxCount: 1 },
    { name: 'guideSignature', maxCount: 1 },
    { name: 'pdfDocuments', maxCount: 5 },
    { name: 'zipFiles', maxCount: 2 }
]), async (req, res) => {
    const uploadedFileIds = [];

    try {
        const { files } = req;
        const body = req.body;

        const uploadFile = (file) => {
            if (!file) return null;
            return new Promise((resolve, reject) => {
                if (!gfsBucket) {
                    return reject(new Error("GridFSBucket not initialized for uploads."));
                }
                const uploadStream = gfsBucket.openUploadStream(file.originalname, {
                    contentType: file.mimetype,
                    metadata: { originalName: file.originalname } // Optional: Store original name in metadata
                });
                const fileId = uploadStream.id;
                uploadedFileIds.push(fileId);
                uploadStream.end(file.buffer);

                uploadStream.on('finish', () => {
                    resolve({
                        id: fileId.toString(), // ✅ IMPORTANT: Store GridFS ID here
                        filename: file.originalname,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size,
                    });
                });
                uploadStream.on('error', reject);
            });
        };

        const paperCopyData = files.paperCopy ? await uploadFile(files.paperCopy[0]) : null;
        const groupLeaderSignatureData = files.groupLeaderSignature ? await uploadFile(files.groupLeaderSignature[0]) : null;
        const additionalDocumentsData = files.additionalDocuments ? await uploadFile(files.additionalDocuments[0]) : null;
        const guideSignatureData = files.guideSignature ? await uploadFile(files.guideSignature[0]) : null;
        const pdfDocumentsData = files.pdfDocuments ? await Promise.all(files.pdfDocuments.map(uploadFile)) : [];
        const zipFilesData = files.zipFiles ? await Promise.all(files.zipFiles.map(uploadFile)) : [];

        const authorsArray = typeof body.authors === 'string' ? JSON.parse(body.authors) : body.authors;
        const parsedBankDetails = typeof body.bankDetails === 'string' ? JSON.parse(body.bankDetails) : body.bankDetails;
        const svvNetIdClean = body.svvNetId ? String(body.svvNetId).trim() : '';

        const newEntry = new UG3BForm({
            svvNetId: svvNetIdClean,
            department: body.department,
            studentName: body.studentName,
            yearOfAdmission: body.yearOfAdmission,
            feesPaid: body.feesPaid,
            projectTitle: body.projectTitle,
            guideName: body.guideName,
            employeeCode: body.employeeCode,
            conferenceDate: body.conferenceDate,
            organization: body.organization,
            publisher: body.publisher,
            paperLink: body.paperLink,
            authors: authorsArray,
            bankDetails: parsedBankDetails,
            registrationFee: body.registrationFee,
            previousClaim: body.previousClaim,
            claimDate: body.claimDate,
            amountReceived: body.amountReceived,
            amountSanctioned: body.amountSanctioned,
            paperCopy: paperCopyData,
            groupLeaderSignature: groupLeaderSignatureData,
            additionalDocuments: additionalDocumentsData,
            guideSignature: guideSignatureData,
            pdfDocuments: pdfDocumentsData,
            zipFiles: zipFilesData,
        });

        await newEntry.save();
        uploadedFileIds.length = 0;

        res.status(201).json({ message: 'UG3B form submitted successfully!', id: newEntry._id });

    } catch (error) {
        console.error('UG3B form submission error:', error);

        for (const fileId of uploadedFileIds) {
            if (fileId && gfsBucket) {
                try {
                    await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
                    console.log(`🧹 Deleted uploaded file due to error: ${fileId}`);
                } catch (deleteErr) {
                    console.error(`❌ Failed to delete file ${fileId} during rollback:`, deleteErr.message);
                }
            }
        }

        res.status(500).json({ error: "Form submission failed.", details: error.message });
    }
});

// File Retrieval Route
router.get('/file/:id', async (req, res) => {
    try {
        if (!gfsBucket) return res.status(500).json({ error: 'GridFSBucket not initialized.' });

        const fileId = new mongoose.Types.ObjectId(req.params.id);
        const files = await gfsBucket.find({ _id: fileId }).toArray();

        if (!files || files.length === 0) return res.status(404).json({ error: 'File not found.' });

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