import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';
import { GridFSBucket } from 'mongodb';
import PG2BForm from '../models/PG2BForm.js';

dotenv.config();
const router = express.Router();

// Initialize GridFSBucket once the MongoDB connection is open
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
    // IMPORTANT: Ensure this bucketName matches where your PG2B files are actually stored.
    gfsBucket = new GridFSBucket(conn.db, { bucketName: 'pg2bfiles' });
    console.log("✅ GridFSBucket for PG2B forms initialized (using 'pg2bfiles' bucket)");
});

// Multer setup with memory storage to buffer files for GridFS upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Accept specific file fields
const uploadFields = upload.fields([
    { name: 'paperCopy', maxCount: 1 },
    { name: 'groupLeaderSignature', maxCount: 1 },
    { name: 'guideSignature', maxCount: 1 },
    { name: 'additionalDocuments', maxCount: 5 }, // Can be multiple documents
]);

// POST /submit
// 📤 POST /submit - Create PG2B form
router.post('/submit', uploadFields, async (req, res) => {
  const uploadedFileIds = [];

  try {
    const {
      svvNetId,
      studentName,
      yearOfAdmission,
      feesPaid,
      department, // ✅ Extract department
      projectTitle,
      guideName,
      coGuideName,
      conferenceDate,
      organization,
      publisher,
      paperLink,
      registrationFee,
      previousClaim,
      claimDate,
      amountReceived,
      amountSanctioned,
      status,
    } = req.body;

    // ✅ Validate svvNetId and department
    if (!svvNetId?.trim()) {
      return res.status(400).json({ message: "svvNetId is required." });
    }

    if (!department || typeof department !== "string" || department.trim() === "") {
      return res.status(400).json({ message: "department is required and must be a string." });
    }

    const authors = typeof req.body.authors === 'string'
      ? JSON.parse(req.body.authors)
      : req.body.authors || [];

    const bankDetails = typeof req.body.bankDetails === 'string'
      ? JSON.parse(req.body.bankDetails)
      : req.body.bankDetails || {};

    if (!gfsBucket) throw new Error("GridFSBucket is not initialized.");

    const uploadFile = (file) =>
      new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
          metadata: { originalName: file.originalname, size: file.size },
        });
        uploadStream.end(file.buffer);
        uploadStream.on('finish', () => {
          uploadedFileIds.push(uploadStream.id);
          resolve({
            id: uploadStream.id,
            filename: file.originalname,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
        });
        uploadStream.on('error', reject);
      });

    const paperCopyData = await uploadFile(req.files?.paperCopy?.[0]);
    const groupLeaderSignatureData = await uploadFile(req.files?.groupLeaderSignature?.[0]);
    const guideSignatureData = await uploadFile(req.files?.guideSignature?.[0]);

    if (!paperCopyData || !groupLeaderSignatureData || !guideSignatureData) {
      return res.status(400).json({ error: 'All required files must be uploaded.' });
    }

    const additionalDocumentsData = await Promise.all(
      (req.files?.additionalDocuments || []).map(uploadFile)
    );

    const newForm = new PG2BForm({
      svvNetId,
      studentName,
      yearOfAdmission,
      feesPaid,
      department, // ✅ Save department
      projectTitle,
      guideName,
      coGuideName,
      conferenceDate: new Date(conferenceDate),
      organization,
      publisher,
      paperLink,
      authors,
      bankDetails,
      registrationFee,
      previousClaim,
      claimDate: claimDate ? new Date(claimDate) : undefined,
      amountReceived,
      amountSanctioned,
      status: status || 'pending',
      paperCopy: paperCopyData,
      groupLeaderSignature: groupLeaderSignatureData,
      guideSignature: guideSignatureData,
      additionalDocuments: additionalDocumentsData,
    });

    await newForm.save();
    uploadedFileIds.length = 0;

    res.status(200).json({ message: 'PG2B form submitted', id: newForm._id });

  } catch (err) {
    console.error('Submission error:', err);

    for (const fileId of uploadedFileIds) {
      try {
        await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
        console.log(`🧹 Rolled back file: ${fileId}`);
      } catch (deleteErr) {
        console.error(`❌ Rollback failed for ${fileId}:`, deleteErr.message);
      }
    }

    const code = err instanceof SyntaxError || err instanceof multer.MulterError ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
});

// --- Route for Retrieving Files from GridFS (remains the same) ---
// This route uses the 'pg2bfiles' bucket for consistency.
router.get('/file/:fileId', async (req, res) => {
    try {
        const fileId = new mongoose.Types.ObjectId(req.params.fileId);

        if (!mongoose.connection.readyState) {
            return res.status(500).json({ error: "Database connection not ready." });
        }
        // Use the globally initialized gfsBucket for consistency
        const bucket = gfsBucket || new GridFSBucket(mongoose.connection.db, { bucketName: 'pg2bfiles' });

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
