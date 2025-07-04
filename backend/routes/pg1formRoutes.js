// pg1formRoutes.js
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
  gfsBucket = new GridFSBucket(conn.db, { bucketName: 'pg1files' }); // For uploads/rollbacks
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
      bankDetails,
      registrationFee,
      previousClaim,
      claimDate,
      amountReceived,
      amountSanctioned,
      svvNetId, // Ensure svvNetId is captured
      department,
      remarks,
    } = req.body;

    const uploadFile = (file) => {
      if (!file) return null;
      return new Promise((resolve, reject) => {
        if (!gfsBucket) { // Ensure gfsBucket is initialized
          return reject(new Error("GridFSBucket not initialized for uploads."));
        }
        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
        });
        const fileId = uploadStream.id;
        uploadedFileIds.push(fileId); // Add to rollback list
        uploadStream.end(file.buffer);
        uploadStream.on('finish', () => resolve({
          id: fileId,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }));
        uploadStream.on('error', reject);
      });
    };

    const receiptCopyData = req.files.receiptCopy ? await uploadFile(req.files.receiptCopy[0]) : null;
    const additionalDocumentsData = req.files.additionalDocuments ? await uploadFile(req.files.additionalDocuments[0]) : null;
    const guideSignatureData = req.files.guideSignature ? await uploadFile(req.files.guideSignature[0]) : null;

    const pdfDocumentsData = req.files.pdfDocuments ? await Promise.all(req.files.pdfDocuments.map(uploadFile)) : [];
    const zipFilesData = req.files.zipFiles ? await Promise.all(req.files.zipFiles.map(uploadFile)) : [];

    const parsedBankDetails = typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;
    const svvNetIdClean = svvNetId ? String(svvNetId).trim() : '';

    const newForm = new PG1Form({
      svvNetId: svvNetIdClean,
      studentName,
      department,
      remarks,
      yearOfAdmission,
      feesPaid: feesPaid === 'Yes' ? 'Yes' : 'No',
      sttpTitle,
      guideName,
      coGuideName,
      numberOfDays: parseInt(numberOfDays),
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      organization,
      reason,
      knowledgeUtilization,
      bankDetails: parsedBankDetails,
      registrationFee,
      previousClaim: previousClaim === 'Yes' ? 'Yes' : 'No',
      claimDate: claimDate ? new Date(claimDate) : null,
      amountReceived,
      amountSanctioned,
      files: {
        receiptCopy: receiptCopyData,
        additionalDocuments: additionalDocumentsData ? [additionalDocumentsData] : [], // Ensure array for consistency
        guideSignature: guideSignatureData,
        pdfDocuments: pdfDocumentsData,
        zipFiles: zipFilesData,
      },
      status: 'pending',
    });

    await newForm.save();
    uploadedFileIds.length = 0; // Clear rollback list upon successful save
    res.status(201).json({ message: 'PG1 form submitted successfully!', id: newForm._id });
  } catch (err) {
    console.error('PG1 form submission error:', err);
    // Rollback: Delete uploaded files if an error occurred
    for (const fileId of uploadedFileIds) {
      if (gfsBucket) { // Ensure gfsBucket is defined before attempting deletion
        try {
          await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
          console.log(`🧹 Rolled back (deleted) file: ${fileId}`);
        } catch (rollbackErr) {
          console.error(`❌ Rollback failed for file ${fileId}:`, rollbackErr.message);
        }
      }
    }

    return res.status(500).json({
      error: "Form submission failed.",
      details: err.message,
    });
  }
});


// Existing GET all PG1 forms
router.get('/all', async (req, res) => {
  try {
    const forms = await PG1Form.find({});
    res.status(200).json(forms);
  } catch (error) {
    console.error("Error fetching all PG1 forms:", error);
    res.status(500).json({ message: "Server error fetching forms." });
  }
});

// Existing GET PG1 form by ID
router.get('/:formId', async (req, res) => {
  try {
    const form = await PG1Form.findById(req.params.formId);
    if (!form) return res.status(404).json({ message: "PG1 form not found." });
    res.status(200).json(form);
  } catch (error) {
    console.error("Error fetching PG1 form by ID:", error);
    res.status(500).json({ message: "Server error fetching form." });
  }
});

// Existing PUT (update) PG1 form status
router.put('/:formId/review', async (req, res) => {
  const { formId } = req.params;
  const { status, remarks } = req.body;

  try {
    const form = await PG1Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "PG1 form not found." });
    }

    form.status = status || form.status;
    form.remarks = remarks || form.remarks;
    await form.save();

    res.status(200).json({ message: "PG1 form review updated successfully." });
  } catch (error) {
    console.error("Error updating PG1 form review:", error);
    res.status(500).json({ message: "Server error updating form review." });
  }
});

export default router;