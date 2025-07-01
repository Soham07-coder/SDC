import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import PG1Form from '../models/PG1Form.js';
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
  { name: 'additionalDocuments', maxCount: 1 },
  { name: 'guideSignature', maxCount: 1 },
  { name: 'pdfDocuments', maxCount: 5 },
  { name: 'zipFiles', maxCount: 2 },
]);

router.post('/submit', uploadFields, async (req, res) => {
  const uploadedFileIds = [];

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
    } = req.body;

    // ✅ Clean and validate svvNetId
    let cleanedSvvNetId = svvNetId;
    if (Array.isArray(svvNetId)) {
      cleanedSvvNetId = svvNetId.find(id => typeof id === "string" && id.trim() !== "") || "";
    }

    if (!cleanedSvvNetId || typeof cleanedSvvNetId !== "string") {
      return res.status(400).json({ message: "svvNetId is required and must be a string." });
    }
    // ✅ Parse bankDetails
    const bankDetails = req.body.bankDetails ? JSON.parse(req.body.bankDetails) : {};

    if (!gfsBucket) {
      throw new Error("GridFSBucket not initialized.");
    }

    // ✅ Upload file to GridFS
    const uploadFile = (file) => {
      return new Promise((resolve, reject) => {
        if (!file) return resolve(null);

        const stream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            size: file.size,
          },
        });

        stream.end(file.buffer);

        stream.on("finish", () => {
          uploadedFileIds.push(stream.id);
          resolve({
            id: stream.id,
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
        });

        stream.on("error", reject);
      });
    };

    // ✅ Required files
    const receiptCopy = req.files?.receiptCopy?.[0];
    const guideSignature = req.files?.guideSignature?.[0];

    if (!receiptCopy || !guideSignature) {
      return res.status(400).json({
        error: "Required files missing: receiptCopy and guideSignature are mandatory.",
      });
    }

    // ✅ Upload all files
    const receiptCopyData = await uploadFile(receiptCopy);
    const guideSignatureData = await uploadFile(guideSignature);
    const additionalDocumentsData = await Promise.all((req.files?.additionalDocuments || []).map(uploadFile));
    const pdfDocumentsData = await Promise.all((req.files?.pdfDocuments || []).map(uploadFile));
    const zipFilesData = await Promise.all((req.files?.zipFiles || []).map(uploadFile));

    // ✅ Create new PG1 form entry
    const newForm = new PG1Form({
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
        pdfDocuments: pdfDocumentsData,
        zipFiles: zipFilesData,
      },
      status: req.body.status || "pending",
    });

    await newForm.save();
    uploadedFileIds.length = 0;

    return res.status(201).json({
      message: "PG1 form submitted successfully!",
      id: newForm._id,
    });
  } catch (err) {
    console.error("❌ PG1 form submission error:", err.message);

    // 🧹 Rollback uploaded files
    for (const fileId of uploadedFileIds) {
      try {
        await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
        console.log(`🧹 Rolled back uploaded file: ${fileId}`);
      } catch (rollbackErr) {
        console.error(`⚠️ Rollback failed for file ${fileId}:`, rollbackErr.message);
      }
    }

    return res.status(500).json({
      error: "Form submission failed.",
      details: err.message,
    });
  }
});

router.get('/file/:fileId', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);

    if (!mongoose.connection.readyState) {
      return res.status(500).json({ error: "MongoDB not connected." });
    }

    const bucket = gfsBucket || new GridFSBucket(mongoose.connection.db, {
      bucketName: 'pg1files',
    });

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files.length) {
      return res.status(404).json({ error: "File not found." });
    }

    const file = files[0];

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).json({ error: "Failed to stream file." });
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error("Download error:", error.message);
    if (error.name === "BSONTypeError") {
      return res.status(400).json({ error: "Invalid file ID." });
    }
    return res.status(500).json({ error: "Server error while fetching file." });
  }
});

export default router;
