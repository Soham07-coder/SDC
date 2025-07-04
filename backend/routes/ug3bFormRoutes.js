// ug3bFormRoutes.js
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import UG3BForm from '../models/UG3BForm.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const upload = multer(); // memory storage

// Initialize GridFSBucket outside the route handler for uploads/rollbacks
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
    gfsBucket = new GridFSBucket(conn.db, { bucketName: 'ug3bFiles' }); // Ensure this bucketName matches your setup
    console.log("✅ GridFSBucket for UG3B forms initialized (using 'ug3bFiles' bucket)");
});


router.post('/submit', upload.fields([
  { name: 'paperCopy', maxCount: 1 },
  { name: 'groupLeaderSignature', maxCount: 1 },
  { name: 'additionalDocuments', maxCount: 1 }, // This might be a single general document
  { name: 'guideSignature', maxCount: 1 },
  { name: 'pdfDocuments', maxCount: 5 },       // New: multiple PDFs
  { name: 'zipFiles', maxCount: 2 }            // New: multiple ZIPs
]), async (req, res) => {
  const uploadedFileIds = []; // To store IDs for potential rollback

  try {
    const { files } = req;
    const {
      studentName,
      yearOfAdmission,
      feesPaid,
      projectTitle,
      guideName,
      employeeCode,
      conferenceDate,
      organization,
      publisher,
      paperLink,
      authors,
      bankDetails,
      registrationFee,
      previousClaim,
      claimDate,
      amountReceived,
      amountSanctioned,
      svvNetId, // Ensure svvNetId is captured
    } = req.body;

    // Helper to upload a single file
    const uploadFile = (file) => {
      if (!file) return null;
      return new Promise((resolve, reject) => {
        // Ensure gfsBucket is initialized before attempting to use it
        if (!gfsBucket) {
            return reject(new Error("GridFSBucket not initialized for uploads."));
        }
        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
        });
        const fileId = uploadStream.id;
        uploadedFileIds.push(fileId); // Add to rollback list
        uploadStream.end(file.buffer);
        uploadStream.on('finish', () => {
          resolve({
            id: fileId,
            filename: file.originalname,
            originalname: file.originalname, // Store original name
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
    
    // Handle multiple PDFs
    const pdfDocumentsData = files.pdfDocuments ? await Promise.all(files.pdfDocuments.map(uploadFile)) : [];
    // Handle multiple ZIPs
    const zipFilesData = files.zipFiles ? await Promise.all(files.zipFiles.map(uploadFile)) : [];


    // Safely parse JSON strings
    const authorsArray = typeof authors === 'string' ? JSON.parse(authors) : authors;
    const parsedBankDetails = typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;
    const svvNetIdClean = svvNetId ? String(svvNetId).trim() : '';

    const newEntry = new UG3BForm({
      svvNetId: svvNetIdClean,
      studentName,
      yearOfAdmission,
      feesPaid,
      projectTitle,
      guideName,
      employeeCode,
      conferenceDate,
      organization,
      publisher,
      paperLink,
      authors: authorsArray,
      bankDetails: {
        beneficiary: parsedBankDetails.beneficiary,
        ifsc: parsedBankDetails.ifsc,
        bankName: parsedBankDetails.bankName,
        branch: parsedBankDetails.branch,
        accountType: parsedBankDetails.accountType,
        accountNumber: parsedBankDetails.accountNumber,
      },
      registrationFee,
      previousClaim,
      claimDate,
      amountReceived,
      amountSanctioned,
      paperCopy: paperCopyData,
      groupLeaderSignature: groupLeaderSignatureData,
      additionalDocuments: additionalDocumentsData,
      guideSignature: guideSignatureData,
      pdfDocuments: pdfDocumentsData,
      zipFiles: zipFilesData,
    });

    await newEntry.save();
    uploadedFileIds.length = 0; // Clear rollback list upon successful save
    res.status(201).json({ message: 'UG3B form submitted successfully!', id: newEntry._id }); // Return the ID
  } catch (error) {
    console.error('UG3B form submission error:', error);
    
    // Rollback: Delete uploaded files if an error occurred during form processing or saving
    for (const fileIdMeta of uploadedFileIds) { // fileIdMeta is an object { id: ObjectId, ... }
      if (fileIdMeta && fileIdMeta.id && gfsBucket) { // Ensure gfsBucket is defined
        try {
          // Use delete method with ObjectId
          await gfsBucket.delete(new mongoose.Types.ObjectId(fileIdMeta.id));
          console.log(`🧹 Deleted uploaded file due to error: ${fileIdMeta.id}`);
        } catch (deleteErr) {
          console.error(`❌ Failed to delete file ${fileIdMeta.id} during rollback:`, deleteErr.message);
        }
      }
    }

    return res.status(500).json({
      error: "Form submission failed.",
      details: error.message,
    });
  }
});


// Existing GET /ug3b-forms and GET /ug3b-forms/:id routes remain unchanged.
// Review route also remains unchanged.
router.get('/ug3b-forms', async (req, res) => {
  try {
    const forms = await UG3BForm.find({});
    res.status(200).json(forms);
  } catch (error) {
    console.error("Error fetching UG3B forms:", error);
    res.status(500).json({ message: "Server error fetching forms." });
  }
});

router.get('/ug3b-forms/:id', async (req, res) => {
  try {
    const form = await UG3BForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "UG3B form not found." });
    }
    res.status(200).json(form);
  } catch (error) {
    console.error("Error fetching UG3B form by ID:", error);
    res.status(500).json({ message: "Server error fetching form." });
  }
});

router.put('/ug3b-forms/:formId/review', async (req, res) => {
  const { formId } = req.params;
  const { status, remarks } = req.body;

  try {
    const form = await UG3BForm.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "UG3B form not found." });
    }

    form.status = status || form.status;
    form.remarks = remarks || form.remarks;
    await form.save();

    res.status(200).json({ message: "UG3B form review updated successfully." });
  } catch (error) {
    console.error("Error updating UG3B form review:", error);
    res.status(500).json({ message: "Server error updating form review." });
  }
});


export default router;