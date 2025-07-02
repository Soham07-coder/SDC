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

// --- GET Route: Download a specific file by ID ---
router.get('/file/:fileId', async (req, res) => {
  try {
    const fileIdString = req.params.fileId;

    if (!mongoose.Types.ObjectId.isValid(fileIdString)) {
      console.error('Invalid file ID format received for download:', fileIdString);
      return res.status(400).json({ error: 'Invalid file ID format. Must be a 24-character hex string.' });
    }

    const fileId = new mongoose.Types.ObjectId(fileIdString);

    if (!mongoose.connection.readyState) {
      return res.status(500).json({ error: "MongoDB not connected." });
    }

    const bucket = gfsBucket || new GridFSBucket(mongoose.connection.db, {
      bucketName: 'pg2afiles', // Ensure this matches the bucket name used for uploads
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
      console.error('Error in GridFS download stream for file:', fileId, err);
      res.status(500).json({ error: "Failed to stream file." });
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error("Download error:", error);
    if (error.name === "BSONTypeError") {
      return res.status(400).json({ error: "Invalid file ID." });
    }
    return res.status(500).json({ error: "Server error while fetching file." });
  }
});

// --- GET Route: Get PG2A Form by ID for Frontend Display ---
router.get('/:id', async (req, res) => {
  try {
    const formId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(formId)) {
      return res.status(400).json({ message: 'Invalid form ID format.' });
    }

    const form = await PG2AForm.findById(formId).lean();

    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    // Helper to add download URLs to file data objects
    const addFileUrls = (fileData) => {
      if (!fileData) return null;
      if (Array.isArray(fileData)) {
        return fileData.map(f => ({
          ...f,
          url: f.id ? `http://localhost:5000/api/pg2aform/file/${f.id}` : null, // Updated URL
        })).filter(Boolean);
      } else {
        return {
          ...fileData,
          url: fileData.id ? `http://localhost:5000/api/pg2aform/file/${fileData.id}` : null, // Updated URL
        };
      }
    };

    const formattedForm = {
      ...form,
      files: {
        bills: addFileUrls(form.files?.bills) || [],
        zips: addFileUrls(form.files?.zips) || [],
        studentSignature: addFileUrls(form.files?.studentSignature),
        guideSignature: addFileUrls(form.files?.guideSignature),
      },
    };

    res.status(200).json(formattedForm);

  } catch (error) {
    console.error("❌ Error fetching PG2A form by ID:", error);
    res.status(500).json({ message: 'Server error fetching form data.', error: error.message });
  }
});

export default router;