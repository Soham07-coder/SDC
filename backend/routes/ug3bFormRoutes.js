import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import UG3BForm from '../models/UG3BForm.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const upload = multer(); // memory storage

// ✅ Initialize GridFSBucket outside the route handler
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
      registrationFee,
      previousClaim,
      claimDate,
      amountReceived,
      amountSanctioned,
      svvNetId, // <--- Extract svvNetId from the request body
    } = req.body;

    // Sanitize svvNetId
    let svvNetIdClean = svvNetId;
    if (Array.isArray(svvNetIdClean)) {
      svvNetIdClean = svvNetIdClean.find(v => typeof v === 'string' && v.trim() !== '')?.trim();
    } else if (typeof svvNetIdClean === 'string') {
      svvNetIdClean = svvNetIdClean.trim();
    } else {
      svvNetIdClean = '';
    }

    if (!svvNetIdClean) {
      return res.status(400).json({ message: "svvNetId is required and must be a valid string." });
    }

    // Parse authors (assuming it's an array of strings)
    // The previous logic for authors parsing is retained
    const authors = Object.keys(req.body)
      .filter(key => key.startsWith('authors['))
      .sort((a, b) => {
        const indexA = parseInt(a.match(/\[(\d+)\]/)[1], 10);
        const indexB = parseInt(b.match(/\[(\d+)\]/)[1], 10);
        return indexA - indexB;
      })
      .map(key => req.body[key]);

    // Parse bankDetails (assuming it's a JSON string)
    const parsedBankDetails = typeof req.body.bankDetails === 'string'
      ? JSON.parse(req.body.bankDetails)
      : req.body.bankDetails;

    // Helper to upload a single file buffer to GridFS and return the file ID + metadata
    const uploadFile = (file) => {
      return new Promise((resolve, reject) => {
        if (!gfsBucket) {
            return reject(new Error("GridFSBucket is not initialized."));
        }
        const uploadStream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
          metadata: { originalName: file.originalname, size: file.size } // Store original name and size in metadata
        });
        uploadStream.end(file.buffer);
        uploadStream.on('finish', () => {
            uploadedFileIds.push(uploadStream.id); // Record for cleanup
            resolve({
                id: uploadStream.id,
                filename: file.originalname, // GridFS uses filename from uploadStream
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size
            });
        });
        uploadStream.on('error', reject);
      });
    };
    
    // Upload single files (if present)
    const paperCopyData = files.paperCopy ? await uploadFile(files.paperCopy[0]) : null;
    const groupLeaderSignatureData = files.groupLeaderSignature ? await uploadFile(files.groupLeaderSignature[0]) : null;
    const additionalDocumentsData = files.additionalDocuments ? await uploadFile(files.additionalDocuments[0]) : null;
    const guideSignatureData = files.guideSignature ? await uploadFile(files.guideSignature[0]) : null;

    // Upload multiple PDFs (max 5)
    const pdfDocumentsData = files.pdfDocuments
      ? await Promise.all(files.pdfDocuments.map(uploadFile))
      : [];

    // Upload multiple ZIPs (max 2)
    const zipFilesData = files.zipFiles
      ? await Promise.all(files.zipFiles.map(uploadFile))
      : [];

    // Create and save document
    const newEntry = new UG3BForm({
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
      svvNetId: svvNetIdClean,
    });

    await newEntry.save();
    uploadedFileIds.length = 0; // Clear rollback list upon successful save
    res.status(201).json({ message: 'UG3B form submitted successfully!', id: newEntry._id }); // Return the ID
  } catch (error) {
    console.error('UG3B form submission error:', error);
    
    // Rollback: Delete uploaded files if an error occurred during form processing or saving
    for (const fileId of uploadedFileIds) {
      if (fileId && gfsBucket) {
        try {
          // Use delete method with ObjectId
          await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
          console.log(`🧹 Deleted uploaded file due to error: ${fileId}`);
        } catch (deleteErr) {
          console.error(`❌ Failed to delete file ${fileId} during rollback:`, deleteErr.message);
        }
      }
    }
    res.status(500).json({ error: 'Failed to submit UG3B form', details: error.message });
  }
});

export default router;
