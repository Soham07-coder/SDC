import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage"; // Still imported, but not used for direct upload in routes below
import { GridFSBucket, ObjectId } from "mongodb";
import UG1Form from "../models/UG1Form.js";

const router = express.Router();
const conn = mongoose.connection;

let gfs;
// We'll keep the GridFsStorage setup for completeness, but use memoryStorage for direct uploads
let storage;
// This will now be a multer instance configured with memoryStorage for manual GridFS upload
let uploadMemoryMiddlewareInstance = null; // Initialize to null to prevent ReferenceError

// Initialize GridFSBucket and Multer GridFsStorage once the MongoDB connection is open.
conn.once("open", () => {
  try {
    gfs = new GridFSBucket(conn.db, { bucketName: "uploads" });

    // Original GridFsStorage setup (kept for reference, but not directly used by upload.single below)
    storage = new GridFsStorage({
      db: conn.db,
      file: (req, file) => {
        return {
          filename: `${Date.now()}-${file.originalname}`,
          bucketName: "uploads",
        };
      },
    });

    // Configure Multer with memoryStorage for direct file buffer access
    uploadMemoryMiddlewareInstance = multer({ storage: multer.memoryStorage() });

    console.log("✅ GridFS, Storage, and Multer middleware initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing GridFS, Storage, or Multer:", error);
  }
});

// Wrapper for multer middleware to ensure it's initialized before use.
// This now uses the `uploadMemoryMiddlewareInstance`.
const upload = {
  single: (fieldName) => (req, res, next) => {
    if (!uploadMemoryMiddlewareInstance) {
      console.error("❌ Upload middleware called before initialization. Database connection might not be open yet.");
      return res.status(503).json({ message: "File upload service is not ready. Please try again shortly." });
    }
    // Call the actual multer middleware instance configured with memoryStorage
    uploadMemoryMiddlewareInstance.single(fieldName)(req, res, (err) => {
      if (err) {
        console.error("❌ Multer upload error:", err);
        return res.status(500).json({ message: "File upload failed", error: err.message });
      }
      next(); // Proceed to the next middleware/route handler
    });
  },
};

/**
 * Helper function to delete a file from GridFS.
 */
const deleteGridFSFile = async (fileId) => {
  if (!gfs) {
    console.warn("GFS not initialized. Skipping file deletion.");
    return false;
  }
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    console.warn(`Invalid fileId for deletion: ${fileId}`);
    return false;
  }
  try {
    await gfs.delete(new mongoose.Types.ObjectId(fileId));
    console.log(`✅ Successfully deleted file ${fileId} from GridFS.`);
    return true;
  } catch (error) {
    if (error.message.includes('File not found')) {
      console.warn(`File ${fileId} not found in GridFS for deletion (might be already deleted).`);
      return true;
    }
    console.error(`❌ Error deleting file ${fileId} from GridFS:`, error);
    return false;
  }
};

router.post("/saveFormData", async (req, res) => {
  try {
    // --- START: Transform guideNames and employeeCodes into the 'guides' array of objects ---
    const guides = [];
    if (Array.isArray(req.body.guideNames) && Array.isArray(req.body.employeeCodes)) {
      const maxLength = Math.max(req.body.guideNames.length, req.body.employeeCodes.length);
      for (let i = 0; i < maxLength; i++) {
        const guideName = req.body.guideNames[i] || "";
        const employeeCode = req.body.employeeCodes[i] || "";

        if (guideName || employeeCode) {
          guides.push({ guideName, employeeCode });
        }
      }
    }
    // --- END: Transform guideNames and employeeCodes ---

    const dataToSave = {
      ...req.body,
      guides: guides,
      pdfFileIds: [],
    };

    delete dataToSave.guideNames;
    delete dataToSave.employeeCodes;
    delete dataToSave.pdfFiles;
    delete dataToSave.zipFileDetails;
    delete dataToSave.groupLeaderSignature;
    delete dataToSave.guideSignature;
    delete dataToSave.zipFileId;
    delete dataToSave.groupLeaderSignatureId;
    delete dataToSave.guideSignatureId;

    const newForm = new UG1Form(dataToSave);
    const savedForm = await newForm.save();
    res.status(201).json({ message: "Form data saved successfully!", formId: savedForm._id });
  } catch (error) {
    console.error("❌ Error saving new form data:", error.message);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Server error while saving form data", details: error.message });
  }
});

router.put("/updateFormData/:formId", async (req, res) => {
  
  const { formId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(formId)) {
    return res.status(400).json({ message: "Invalid form ID format" });
  }

  try {
    // --- START: Transform guideNames and employeeCodes into the 'guides' array of objects for update ---
    const guides = [];
    if (Array.isArray(req.body.guideNames) && Array.isArray(req.body.employeeCodes)) {
      const maxLength = Math.max(req.body.guideNames.length, req.body.employeeCodes.length);
      for (let i = 0; i < maxLength; i++) {
        const guideName = req.body.guideNames[i] || "";
        const employeeCode = req.body.employeeCodes[i] || "";
        if (guideName || employeeCode) {
          guides.push({ guideName, employeeCode });
        }
      }
    }
    // --- END: Transform guideNames and employeeCodes ---

    const updateData = {
      ...req.body,
      guides: guides,
    };
    delete updateData._id;
    delete updateData.guideNames;
    delete updateData.employeeCodes;
    delete updateData.pdfFileIds;
    delete updateData.zipFileId;
    delete updateData.groupLeaderSignatureId;
    delete updateData.guideSignatureId;
    delete updateData.pdfFiles;
    delete updateData.zipFileDetails;
    delete updateData.groupLeaderSignature;
    delete updateData.guideSignature;

    const updatedForm = await UG1Form.findByIdAndUpdate(formId, { $set: updateData }, { new: true, runValidators: true });

    if (!updatedForm) {
      console.log(`Form with ID ${formId} not found for update.`);
      return res.status(404).json({ message: "Form not found for update" });
    }
    res.status(200).json({ message: "Form data updated successfully!", formId: updatedForm._id, form: updatedForm });
  } catch (error) {
    console.error(`❌ Error updating form data for ${formId}:`, error.message);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: "Validation error during update", details: error.errors });
    }
    res.status(500).json({ error: "Server error while updating form data", details: error.message });
  }
});

router.post("/uploadPDF/:formId", upload.single("pdfFile"), async (req, res) => {
  try {
    const { formId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      console.error("❌ Invalid form ID format received for PDF upload.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }
    if (!req.file || !req.file.buffer) { // Check for buffer as we're using memoryStorage
      console.error("❌ File upload failed: No file buffer received after multer processing for PDF upload.");
      return res.status(400).json({ message: "No file uploaded or file buffer missing." });
    }
    // Generate a filename for GridFS
    const filename = `${Date.now()}-${req.file.originalname}`;
    // Manual upload to GridFS
    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
      // You can add more metadata here if needed, e.g., metadata: { originalname: req.file.originalname }
    });

    // Pipe the buffer to the GridFS upload stream
    uploadStream.end(req.file.buffer);

    // Wait for the upload to finish and get the file ID
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    console.log("✅ File received by Multer for PDF upload and uploaded to GridFS.");
    console.log("Uploaded file details:", {
      id: fileId.toString(),
      filename: filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const updatedForm = await UG1Form.findByIdAndUpdate(
      formId,
      { $addToSet: { pdfFileIds: fileId } },
      { new: true }
    );

    if (!updatedForm) {
      console.error(`❌ Form with ID ${formId} not found when attempting to add PDF ID.`);
      return res.status(404).json({ message: "Form not found when uploading PDF" });
    }
    console.log(`✅ PDF ID ${fileId} successfully added to form ${formId}.`);
    res.status(200).json({ message: "PDF uploaded successfully!", fileId: fileId.toString(), form: updatedForm });
  } catch (error) {
    console.error("❌ PDF Upload error:", error);
    res.status(500).json({ message: "Internal server error during PDF upload", error: error.message });
  }
});

router.post("/uploadZip/:formId", upload.single("pdfZip"), async (req, res) => {
  try {
    const { formId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      console.error("❌ Invalid form ID format received for ZIP upload.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }
    if (!req.file || !req.file.buffer) { // Check for buffer as we're using memoryStorage
      console.error("❌ File upload failed: No file buffer received after multer processing for ZIP upload.");
      return res.status(400).json({ message: "No zip file uploaded or file buffer missing." });
    }

    // Generate a filename for GridFS
    const filename = `${Date.now()}-${req.file.originalname}`;

    // Manual upload to GridFS
    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });

    // Pipe the buffer to the GridFS upload stream
    uploadStream.end(req.file.buffer);

    // Wait for the upload to finish and get the file ID
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    console.log("✅ File received by Multer for ZIP upload and uploaded to GridFS.");
    console.log("Uploaded file details:", {
      id: fileId.toString(),
      filename: filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const form = await UG1Form.findById(formId);
    if (form && form.zipFileId) {
      console.log(`Found old ZIP ID ${form.zipFileId}, attempting to delete from GridFS.`);
      await deleteGridFSFile(form.zipFileId);
    }

    const updatedForm = await UG1Form.findByIdAndUpdate(
      formId,
      { zipFileId: fileId },
      { new: true }
    );

    if (!updatedForm) {
      console.error(`❌ Form with ID ${formId} not found when attempting to set ZIP ID.`);
      return res.status(404).json({ message: "Form not found when uploading ZIP" });
    }
    console.log(`✅ ZIP ID ${fileId} successfully set for form ${formId}.`);
    res.status(200).json({ message: "ZIP uploaded successfully!", fileId: fileId.toString(), form: updatedForm });
  } catch (error) {
    console.error("❌ ZIP Upload error:", error);
    res.status(500).json({ message: "Internal server error during ZIP upload", error: error.message });
  }
});

router.post("/uploadSignature/:formId/:type", upload.single("file"), async (req, res) => {
  try {
    const { formId, type } = req.params;
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      console.error("❌ Invalid form ID format received for signature upload.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }
    if (!req.file || !req.file.buffer) { // Check for buffer as we're using memoryStorage
      console.error("❌ File upload failed: No file buffer received after multer processing for signature upload.");
      return res.status(400).json({ message: "No file uploaded or file buffer missing." });
    }

    // Generate a filename for GridFS
    const filename = `${Date.now()}-${req.file.originalname}`;

    // Manual upload to GridFS
    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });

    // Pipe the buffer to the GridFS upload stream
    uploadStream.end(req.file.buffer);

    // Wait for the upload to finish and get the file ID
    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
    });

    console.log("✅ File received by Multer for signature upload and uploaded to GridFS.");
    console.log("Uploaded file details:", {
      id: fileId.toString(),
      filename: filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    let updateFieldKey;
    let oldFileIdField;

    if (type === "groupLeader") {
      updateFieldKey = "groupLeaderSignatureId";
      oldFileIdField = "groupLeaderSignatureId";
    } else if (type === "guide") {
      updateFieldKey = "guideSignatureId";
      oldFileIdField = "guideSignatureId";
    } else {
      console.error(`❌ Invalid signature type specified: ${type}`);
      return res.status(400).json({ message: "Invalid signature type" });
    }

    const form = await UG1Form.findById(formId);
    if (form && form[oldFileIdField]) {
      console.log(`Found old ${type} signature ID ${form[oldFileIdField]}, attempting to delete from GridFS.`);
      await deleteGridFSFile(form[oldFileIdField]);
    }

    const update = { [updateFieldKey]: fileId }; // Use the manually obtained fileId
    const updatedForm = await UG1Form.findByIdAndUpdate(formId, update, { new: true });

    if (!updatedForm) {
      console.error(`❌ Form with ID ${formId} not found when attempting to set ${type} signature ID.`);
      return res.status(404).json({ message: "Form not found when uploading signature" });
    }

    console.log(`✅ ${type} signature ID ${fileId} successfully set for form ${formId}.`);
    res.status(200).json({
      message: `${type} signature uploaded successfully!`,
      fileId: fileId.toString(),
      form: updatedForm,
    });
  } catch (error) {
    console.error(`❌ Error clearing ${req.params.type} signature:`, error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/ug1form/:id", async (req, res) => {
  console.log(`--- GET /ug1form/${req.params.id} ---`);
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("❌ Invalid form ID format received for fetching single form.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }
    const form = await UG1Form.findById(id);
    if (!form) {
      console.log(`Form with ID ${id} not found.`);
      return res.status(404).json({ message: "Form not found" });
    }

    const formWithDetails = await populateFormWithFileDetails(form);
    console.log(`✅ Successfully fetched UG1 form ${id} with file details.`);
    res.status(200).json(formWithDetails);
  } catch (error) {
    console.error('❌ Error fetching single UG1 form:', error);
    res.status(500).json({ message: "Server error while fetching form", error: error.message });
  }
});

router.get('/ug1form/pending', async (req, res) => {
  console.log("--- GET /ug1form/pending ---");
  try {
    const pendingForms = await UG1Form.find({ status: 'pending' });
    if (!pendingForms || pendingForms.length === 0) {
      console.log("No pending UG1 forms found.");
      return res.status(200).json([]);
    }
    const formsWithDetails = await Promise.all(
      pendingForms.map(form => populateFormWithFileDetails(form))
    );
    console.log(`✅ Successfully fetched ${formsWithDetails.length} pending UG1 forms with file details.`);
    res.status(200).json(formsWithDetails);
  }
  catch (error) {
    console.error('❌ Error fetching pending UG1 forms:', error);
    res.status(500).json({ message: 'Server error while fetching pending forms', error: error.message });
  }
});

router.get("/user/:svvNetId", async (req, res) => {
  console.log(`--- GET /user/${req.params.svvNetId} ---`);
  try {
    const { svvNetId } = req.params;
    if (!svvNetId) {
      console.error("❌ svvNetId parameter is required for fetching user forms.");
      return res.status(400).json({ message: "Invalid svvNetId parameter." });
    }
    const forms = await UG1Form.find({ svvNetId });
    if (!forms || forms.length === 0) {
      console.log(`No forms found for user with svvNetId: ${svvNetId}.`);
      return res.status(404).json({ message: "No forms found for this user." });
    }
    const formsWithDetails = await Promise.all(
      forms.map(form => populateFormWithFileDetails(form))
    );
    console.log(`✅ Successfully fetched ${formsWithDetails.length} forms for user ${svvNetId} with file details.`);
    res.status(200).json(formsWithDetails);
  } catch (error) {
    console.error("❌ Error fetching user forms by svvNetId:", error);
    res.status(500).json({ error: "Internal server error while fetching user forms", details: error.message });
  }
});

/**
 * @route   PUT /api/ug1form/clearPdfFiles/:formId
 * @desc    Clear (and delete from GridFS) all individual PDF files for a form.
 * @access  Public (adjust as per your auth)
 */
router.put("/clearPdfFiles/:formId", async (req, res) => {
  console.log(`--- PUT /clearPdfFiles/${req.params.formId} ---`);
  try {
    const { formId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      console.error("❌ Invalid form ID format received for clearing PDF files.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }

    const form = await UG1Form.findById(formId);
    if (!form) {
      console.error(`❌ Form with ID ${formId} not found for clearing PDF files.`);
      return res.status(404).json({ message: "Form not found" });
    }

    if (form.pdfFileIds && form.pdfFileIds.length > 0) {
      console.log(`Clearing ${form.pdfFileIds.length} PDF files for form ${formId}.`);
      const deletionResults = await Promise.allSettled(
        form.pdfFileIds.map(fileId => deleteGridFSFile(fileId))
      );
      deletionResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Deletion of PDF file ${form.pdfFileIds[index]} failed:`, result.reason);
        }
      });
    } else {
      console.log(`No PDF files to clear for form ${formId}.`);
    }

    const updatedForm = await UG1Form.findByIdAndUpdate(
      formId,
      { $set: { pdfFileIds: [] } },
      { new: true }
    );
    console.log(`✅ PDF file references cleared and files deleted for form ${formId}.`);
    res.status(200).json({ message: "PDF file references cleared and files deleted!", form: updatedForm });
  } catch (error) {
    console.error("❌ Error clearing PDF files:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

router.put("/:formId/faculty-review", async (req, res) => {
  const { formId } = req.params;
  const { status, remarks } = req.body;

  try {
    const form = await UG1Form.findById(formId);
    if (!form) return res.status(404).json({ error: "Form not found" });

    form.status = status || form.status;
    form.remarks = remarks || form.remarks;

    await form.save();

    console.log(`✅ Updated UG1 form ${formId} with status: ${status}, remarks: ${remarks}`);
    res.json({ message: "Form reviewed successfully" });
  } catch (err) {
    console.error("❌ Error updating form:", err);
    res.status(500).json({ error: "Server error while reviewing form" });
  }
});

/**
 * @route   PUT /api/ug1form/clearZipFile/:formId
 * @desc    Clear (and delete from GridFS) the ZIP file for a form.
 * @access  Public (adjust as per your auth)
 */
router.put("/clearZipFile/:formId", async (req, res) => {
  console.log(`--- PUT /clearZipFile/${req.params.formId} ---`);
  try {
    const { formId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      console.error("❌ Invalid form ID format received for clearing ZIP file.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }

    const form = await UG1Form.findById(formId);
    if (!form) {
      console.error(`❌ Form with ID ${formId} not found for clearing ZIP file.`);
      return res.status(404).json({ message: "Form not found" });
    }

    if (form.zipFileId) {
      console.log(`Clearing ZIP file ID ${form.zipFileId} for form ${formId}.`);
      await deleteGridFSFile(form.zipFileId);
    } else {
      console.log(`No ZIP file to clear for form ${formId}.`);
    }

    const updatedForm = await UG1Form.findByIdAndUpdate(
      formId,
      { $unset: { zipFileId: 1 } },
      { new: true }
    );
    console.log(`✅ ZIP file reference cleared and file deleted for form ${formId}.`);
    res.status(200).json({ message: "ZIP file reference cleared and file deleted!", form: updatedForm });
  } catch (error) {
    console.error("❌ Error clearing ZIP file:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * @route   PUT /api/ug1form/clearSignature/:formId/:type
 * @desc    Clear (and delete from GridFS) a specific Signature for a form.
 * @access  Public (adjust as per your auth)
 */
router.put("/clearSignature/:formId/:type", async (req, res) => {
  console.log(`--- PUT /clearSignature/${req.params.formId}/${req.params.type} ---`);
  try {
    const { formId, type } = req.params;
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      console.error("❌ Invalid form ID format received for clearing signature.");
      return res.status(400).json({ message: "Invalid form ID format" });
    }

    const form = await UG1Form.findById(formId);
    if (!form) {
      console.error(`❌ Form with ID ${formId} not found for clearing signature.`);
      return res.status(404).json({ message: "Form not found" });
    }

    let fieldToUnset;
    let fileIdToDelete;

    if (type === "groupLeader") {
      fieldToUnset = "groupLeaderSignatureId";
      fileIdToDelete = form.groupLeaderSignatureId;
    } else if (type === "guide") {
      fieldToUnset = "guideSignatureId";
      fileIdToDelete = form.guideSignatureId;
    } else {
      console.error(`❌ Invalid signature type specified for clearing: ${type}`);
      return res.status(400).json({ message: "Invalid signature type" });
    }

    if (fileIdToDelete) {
      console.log(`Clearing ${type} signature ID ${fileIdToDelete} for form ${formId}.`);
      await deleteGridFSFile(fileIdToDelete);
    } else {
      console.log(`No ${type} signature to clear for form ${formId}.`);
    }

    const updatedForm = await UG1Form.findByIdAndUpdate(
      formId,
      { $unset: { [fieldToUnset]: 1 } },
      { new: true }
    );
    console.log(`✅ ${type} signature cleared and file deleted for form ${formId}.`);
    res.status(200).json({ message: `${type} signature cleared and file deleted!`, form: updatedForm });
  } catch (error) {
    console.error(`❌ Error clearing ${req.params.type} signature:`, error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

/**
 * @route   GET /api/ug1form/uploads/files/:fileId
 * @desc    Serve files directly from GridFS. This route is crucial for accessing uploaded files.
 * @access  Public (adjust as per your auth)
 */
router.get('/uploads/files/:fileId', async (req, res) => {
  console.log(`--- GET /uploads/files/${req.params.fileId} ---`);
  try {
    const { fileId } = req.params;
    if (!gfs) {
      console.error("❌ GFS not initialized in /uploads/files/:fileId route. Database connection might not be open.");
      return res.status(503).send('GridFS service is not available. Please try again shortly.');
    }
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      console.error(`❌ Invalid file ID format: ${fileId}`);
      return res.status(400).send('Invalid file ID format.');
    }

    const readStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(fileId));

    readStream.on('file', (file) => {
      res.set('Content-Type', file.contentType || 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
      console.log(`✅ Serving file: ${file.filename} (ID: ${fileId}, Type: ${file.contentType})`);
    });

    readStream.on('error', (err) => {
      if (err.message.includes('File not found')) {
        console.error(`❌ File ${fileId} not found in GridFS.`);
        return res.status(404).send('File not found in GridFS.');
      }
      console.error("❌ GridFS stream error in /uploads/files/:fileId :", err);
      res.status(500).send('Error streaming file.');
    });

    readStream.pipe(res);
  } catch (error) {
    console.error("❌ Error in file download route /uploads/files/:fileId :", error);
    res.status(500).send('Server error during file download.');
  }
});

export default router;