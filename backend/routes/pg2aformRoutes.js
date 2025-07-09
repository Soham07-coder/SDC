// pg2aformRoutes.js
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

// Initialize GridFSBucket globally in this file for consistency and efficiency
let gfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
  gfsBucket = new GridFSBucket(conn.db, { bucketName: 'pg2afiles' });
  console.log("✅ GridFSBucket for PG2A forms initialized (using 'pg2afiles' bucket)");
});


router.post('/submit', uploadFields, async (req, res) => {
  const uploadedFileIds = []; // To store IDs for potential rollback

  try {
    const {
      svvNetId,
      organizingInstitute,
      projectTitle,
      teamName,
      guideName,
      department,
      date,
      hodRemarks,
      studentDetails,
      expenses,
      bankDetails,
      status, // Capturing status if sent from frontend
    } = req.body;

    const { files } = req;
    const bills = files?.bills || [];
    const zips = files?.zips || [];
    const studentSignature = files?.studentSignature?.[0];
    const guideSignature = files?.guideSignature?.[0];

    if (!bills.length || !studentSignature || !guideSignature) {
      return res.status(400).json({ error: 'One or more required files (bills, student/guide signatures) are missing' });
    }

    // Helper to upload a file to GridFS
    const uploadFile = (file) => {
      if (!file) return null;
      return new Promise((resolve, reject) => {
        if (!gfsBucket) { // Use the globally initialized bucket
            return reject(new Error("GridFSBucket not initialized for uploads."));
        }
        const stream = gfsBucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
        });
        const fileId = stream.id;
        uploadedFileIds.push(fileId); // Add to rollback list
        stream.end(file.buffer);
        stream.on('finish', () => resolve(fileId));
        stream.on('error', reject);
      });
    };

    // Upload files to GridFS
    const billFileIds = await Promise.all(bills.map(uploadFile));
    const zipFileIds = await Promise.all(zips.map(uploadFile));
    const studentSignatureId = await uploadFile(studentSignature);
    const guideSignatureId = await uploadFile(guideSignature);

    const newForm = new PG2AForm({
      svvNetId: svvNetId ? String(svvNetId).trim() : '',
      organizingInstitute,
      projectTitle,
      teamName,
      guideName,
      department,
      date: date ? new Date(date) : undefined, // Parse date
      hodRemarks,
      studentDetails: JSON.parse(studentDetails), // Assuming these are stringified JSON
      expenses: JSON.parse(expenses),
      bankDetails: JSON.parse(bankDetails),
      files: {
        bills: billFileIds,
        zips: zipFileIds,
        studentSignature: studentSignatureId,
        guideSignature: guideSignatureId,
      },
      status: status || 'pending',
    });

    await newForm.save();
    uploadedFileIds.length = 0; // Clear rollback list upon successful save
    res.status(201).json({ message: 'PG2A form submitted successfully!', id: newForm._id });
  } catch (error) {
    console.error('PG2A form submission error:', error);
    // Rollback: Delete uploaded files if an error occurred during form processing or saving
    for (const fileId of uploadedFileIds) {
      if (gfsBucket) { // Ensure gfsBucket is defined before attempting deletion
        try {
          await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
          console.log(`🧹 Deleted uploaded file due to error: ${fileId}`);
        } catch (deleteErr) {
          console.error(`❌ Failed to delete file ${fileId} during rollback:`, deleteErr.message);
        }
      }
    }
    res.status(500).json({ error: 'Failed to submit PG2A form.', details: error.message });
  }
});


// Existing GET /all and GET /:formId routes
router.get('/all', async (req, res) => {
  try {
    const forms = await PG2AForm.find({});
    res.status(200).json(forms);
  } catch (error) {
    console.error("Error fetching all PG2A forms:", error);
    res.status(500).json({ message: "Server error fetching forms." });
  }
});

router.get('/:formId', async (req, res) => {
  try {
    const form = await PG2AForm.findById(req.params.formId);
    if (!form) return res.status(404).json({ message: "PG2A form not found." });
    res.status(200).json(form);
  } catch (error) {
    console.error("Error fetching PG2A form by ID:", error);
    res.status(500).json({ message: "Server error fetching form." });
  }
});

// Existing PUT /:formId/review route
router.put('/:formId/review', async (req, res) => {
  const { formId } = req.params;
  const { status, hodRemarks } = req.body; // Adjusted to match schema

  try {
    const form = await PG2AForm.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "PG2A form not found." });
    }

    form.status = status || form.status;
    form.hodRemarks = hodRemarks || form.hodRemarks; // Assuming a hodRemarks field
    await form.save();

    res.status(200).json({ message: "PG2A form review updated successfully." });
  } catch (error) {
    console.error("Error updating PG2A form review:", error);
    res.status(500).json({ message: "Server error updating form review." });
  }
});

// File Fetch Route
router.get('/file/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    if (!gfsBucket) {
      return res.status(500).json({ message: "GridFSBucket not initialized." });
    }

    const _id = new mongoose.Types.ObjectId(fileId);

    const files = await gfsBucket.find({ _id }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found." });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);

    const stream = gfsBucket.openDownloadStream(_id);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Error streaming file:', err);
      res.status(500).json({ message: 'Error streaming file.' });
    });

  } catch (err) {
    console.error("Error fetching file from PG2A bucket:", err);
    res.status(500).json({ message: 'Server error fetching file.' });
  }
});


export default router;