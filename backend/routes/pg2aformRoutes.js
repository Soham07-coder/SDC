// backend/routes/pg2aformRoutes.js
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { GridFSBucket } from 'mongodb';
import PG2AForm from '../models/PG2AForm.js';

const router = express.Router();

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Fields setup: multiple bills, zips, single signature files
const uploadFields = upload.fields([
  { name: 'bills', maxCount: 10 },
  { name: 'zips', maxCount: 2 },
  { name: 'studentSignature', maxCount: 1 },
  { name: 'guideSignature', maxCount: 1 },
]);

router.post('/submit', uploadFields, async (req, res) => {
  try {
    const conn = mongoose.connection;
    const bucket = new GridFSBucket(conn.db, { bucketName: 'pg2afiles' });

    const uploadFile = (file) => {
      if (!file) return null;
      return new Promise((resolve, reject) => {
        const stream = bucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
        });
        stream.end(file.buffer);
        stream.on('finish', () => resolve(stream.id));
        stream.on('error', reject);
      });
    };

    // Parse structured fields
    const bankDetails = JSON.parse(req.body.bankDetails || '{}');
    const studentDetails = JSON.parse(req.body.studentDetails || '[]');
    const expenses = JSON.parse(req.body.expenses || '[]');

    // Required files
    const bills = req.files?.bills || [];
    const zips = req.files?.zips || [];
    const studentSignature = req.files?.studentSignature?.[0];
    const guideSignature = req.files?.guideSignature?.[0];

    if (!bills.length || !studentSignature || !guideSignature) {
      return res.status(400).json({ error: 'One or more required files are missing' });
    }

    // Upload files to GridFS
    const billFileIds = await Promise.all(bills.map(uploadFile));
    const zipFileIds = await Promise.all(zips.map(uploadFile));
    const studentSignatureId = await uploadFile(studentSignature);
    const guideSignatureId = await uploadFile(guideSignature);

    const newForm = new PG2AForm({
      svvNetId: req.body.svvNetId,
      organizingInstitute: req.body.organizingInstitute,
      projectTitle: req.body.projectTitle,
      teamName: req.body.teamName,
      guideName: req.body.guideName,
      department: req.body.department,
      date: req.body.date,
      hodRemarks: req.body.hodRemarks,
      studentDetails,
      expenses,
      bankDetails,
      files: {
        bills: billFileIds,
        zips: zipFileIds,
        studentSignature: studentSignatureId,
        guideSignature: guideSignatureId,
      },
      status: req.body.status || 'pending',
    });

    await newForm.save();
    res.json({ message: 'PG2A form submitted successfully!' });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to submit PG2A form' });
  }
});

export default router;
