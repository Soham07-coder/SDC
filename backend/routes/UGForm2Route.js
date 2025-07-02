import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { GridFSBucket } from "mongodb";
import UG2Form from "../models/UGForm2.js"; // Assuming your UG2 model is named UGForm2.js

const router = express.Router();
const conn = mongoose.connection;

let gfs;
let upload = null; // Will be initialized once connection is open

conn.once("open", () => {
    gfs = new GridFSBucket(conn.db, { bucketName: "uploads" });
    upload = multer({ storage: multer.memoryStorage() });
    console.log("✅ GridFS + Multer (memoryStorage) initialized for UG2Form routes");
});

// Helper function to delete a file from GridFS
const deleteGridFSFile = async (fileId) => {
    if (!fileId || !gfs || !mongoose.Types.ObjectId.isValid(fileId)) {
        console.warn(`Attempted to delete invalid or null fileId: ${fileId}`);
        return;
    }
    try {
        await gfs.delete(new mongoose.Types.ObjectId(fileId));
        console.log(`🗑️ Successfully deleted GridFS file: ${fileId}`);
    } catch (error) {
        if (error.message.includes("File not found")) {
            console.warn(`🤔 GridFS file not found for deletion: ${fileId}`);
        } else {
            console.error(`❌ Error deleting GridFS file ${fileId}:`, error);
        }
    }
};

// Helper function to upload a single file to GridFS
const uploadSingleFileToGridFS = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);

        const filename = `${Date.now()}-${file.originalname}`;
        const uploadStream = gfs.openUploadStream(filename, {
            contentType: file.mimetype,
            metadata: {
                originalName: file.originalname,
                size: file.size,
            },
        });
        uploadStream.end(file.buffer);

        uploadStream.on("finish", () => {
            resolve(uploadStream.id);
        });
        uploadStream.on("error", (err) => {
            console.error(`❌ GridFS upload stream error for ${file.originalname}:`, err);
            reject(err);
        });
    });
};


// --- EXISTING populateFormWithFileDetails (copied for context, ensure it's defined once) ---
const populateFormWithFileDetails = async (form) => {
    const formObject = form.toObject(); // Convert Mongoose document to plain JS object

    // Helper to get file details and URL
    const getFileDetails = async (fileId) => {
        if (!fileId || !gfs || !mongoose.Types.ObjectId.isValid(fileId)) return null;
        try {
            const files = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
            if (files.length > 0) {
                const file = files[0];
                const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'; // Adjust as per your backend URL
                return {
                    fileId: file._id,
                    originalName: file.filename, // Changed from 'filename' to 'originalName' to match frontend
                    mimetype: file.contentType, // Changed from 'contentType' to 'mimetype' to match frontend
                    url: `${BASE_URL}/api/ug2form/uploads/${file._id}`, // This links to your router.get("/uploads/:fileId")
                };
            }
        } catch (error) {
            console.error(`❌ Error fetching GridFS file metadata for ID ${fileId}:`, error);
        }
        return null;
    };

    // Populate PDF files (frontend expects `pdfFiles`)
    formObject.pdfFiles = await Promise.all(
        (formObject.uploadedFilesIds || []).map(id => getFileDetails(id))
    ).then(results => results.filter(Boolean)); // Filter out nulls/failures

    // Populate ZIP file (frontend expects `zipFileDetails`)
    formObject.zipFileDetails = await getFileDetails(formObject.zipFileId);

    // Populate Guide Signature
    formObject.guideSignature = await getFileDetails(formObject.guideSignatureId);

    // Populate Group Leader Signature (frontend expects `leaderSignature`)
    formObject.leaderSignature = await getFileDetails(formObject.groupLeaderSignatureId); // Renamed for frontend

    return formObject;
};

// --- REST OF YOUR EXISTING UG2 ROUTES ---
// === Save new UG2 form (without file uploads) ===
router.post("/saveFormData", async (req, res) => {
    try {
        const data = req.body;

        // Convert guideNames and employeeCodes to structured 'guides' array
        const guides = (data.guideNames || []).map((name, index) => ({
            guideName: name,
            employeeCode: data.employeeCodes[index] || ""
        }));

        // Convert student details to structured 'studentDetails' array
        const studentDetails = (data.students || []).map(s => ({
            studentName: s.name,
            year: s.year,
            class: s.class,
            div: s.div,
            branch: s.branch,
            rollNumber: s.rollNo,
            mobileNumber: s.mobileNo,
        }));

        const form = new UG2Form({
            ...data,
            guides,
            studentDetails,
            uploadedFilesIds: [], // Initialize empty
            zipFileId: undefined,
            guideSignatureId: undefined,
            groupLeaderSignatureId: undefined,
        });
        const saved = await form.save();
        res.status(201).json({ message: "UG2Form saved", formId: saved._id });
    } catch (err) {
        console.error("❌ Save UG2Form error:", err);
        return err.name === "ValidationError"
            ? res.status(400).json({ error: "Validation failed", details: err.errors })
            : res.status(500).json({ error: "Server error", message: err.message });
    }
});

// === Update UG2 form (no files) ===
router.put("/updateFormData/:id", async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

    try {
        const data = { ...req.body };

        // Convert guideNames and employeeCodes to structured 'guides' array for update
        if (data.guideNames && data.employeeCodes) {
            data.guides = data.guideNames.map((name, index) => ({
                guideName: name,
                employeeCode: data.employeeCodes[index] || ""
            }));
            delete data.guideNames; // Remove flattened arrays as we store structured array
            delete data.employeeCodes;
        }

        // Convert student details to structured 'studentDetails' array for update
        if (data.students) {
            data.studentDetails = data.students.map(s => ({
                studentName: s.name,
                year: s.year,
                class: s.class,
                div: s.div,
                branch: s.branch,
                rollNumber: s.rollNo,
                mobileNumber: s.mobileNo,
            }));
            delete data.students;
        }

        const updated = await UG2Form.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
        if (!updated) return res.status(404).json({ error: "Not found" });
        res.json({ message: "Updated successfully", form: updated });
    } catch (err) {
        console.error("❌ Update error:", err);
        return err.name === "ValidationError"
            ? res.status(400).json({ error: "Validation failed", details: err.errors })
            : res.status(500).json({ error: "Server error", message: err.message });
    }
});


// === NEW Unified Upload Documents Route (PDFs or ZIP) ===
router.post("/upload-documents/:id", (req, res, next) => {
    if (!upload) return res.status(503).json({ message: "Upload service not ready" });

    // Use upload.fields to handle both 'pdf' (array) and 'zip' (single)
    upload.fields([
        { name: 'pdf', maxCount: 5 }, // Max 5 PDFs
        { name: 'zip', maxCount: 1 }  // Max 1 ZIP
    ])(req, res, (err) => {
        if (err) {
            console.error("❌ Multer error during document upload:", err);
            return res.status(500).json({ message: "Document upload failed", error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid form ID" });
    }

    try {
        const form = await UG2Form.findById(id);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }

        const filesToUpload = [];
        let newZipFileId = undefined;
        let newPdfFileIds = [];

        // Check if a ZIP file was uploaded
        if (req.files && req.files.zip && req.files.zip.length > 0) {
            const zipFile = req.files.zip[0];
            filesToUpload.push(zipFile);

            // Clear existing PDFs if a new ZIP is uploaded
            if (form.uploadedFilesIds && form.uploadedFilesIds.length > 0) {
                await Promise.all(form.uploadedFilesIds.map(deleteGridFSFile));
                form.uploadedFilesIds = [];
            }
            // Delete old ZIP if present
            if (form.zipFileId) {
                await deleteGridFSFile(form.zipFileId);
            }

            newZipFileId = await uploadSingleFileToGridFS(zipFile);
            form.zipFileId = newZipFileId;
            form.uploadedFilesIds = []; // Ensure PDFs are cleared if a ZIP is uploaded
            console.log("✅ ZIP file uploaded and associated with form.");

        } else if (req.files && req.files.pdf && req.files.pdf.length > 0) {
            const pdfFiles = req.files.pdf;
            filesToUpload.push(...pdfFiles);

            // Clear existing ZIP if new PDFs are uploaded
            if (form.zipFileId) {
                await deleteGridFSFile(form.zipFileId);
                form.zipFileId = undefined;
            }
            // Clear old PDFs if new PDFs are uploaded
            if (form.uploadedFilesIds && form.uploadedFilesIds.length > 0) {
                await Promise.all(form.uploadedFilesIds.map(deleteGridFSFile));
            }

            newPdfFileIds = await Promise.all(pdfFiles.map(uploadSingleFileToGridFS));
            form.uploadedFilesIds = newPdfFileIds.filter(Boolean); // Filter out any nulls
            form.zipFileId = undefined; // Ensure ZIP is cleared if PDFs are uploaded
            console.log("✅ PDF files uploaded and associated with form.");

        } else {
            return res.status(400).json({ message: "No PDF or ZIP files provided for upload." });
        }

        await form.save();
        res.json({
            message: "Documents uploaded successfully",
            zipFileId: newZipFileId,
            pdfFileIds: newPdfFileIds,
        });

    } catch (error) {
        console.error("❌ Error in document upload route:", error);
        res.status(500).json({ message: "Internal server error during document upload." });
    }
});


// === Upload Signatures ===
router.post("/uploadSignature/:id/:type", (req, res, next) => {
    if (!upload) return res.status(503).json({ message: "Upload service not ready" });
    upload.single("sig")(req, res, (err) => { // Use direct multer middleware
        if (err) {
            console.error(`❌ Multer error during ${req.params.type} signature upload:`, err);
            return res.status(500).json({ message: `${req.params.type} signature upload failed`, error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const validTypes = ["guide", "groupLeader"];
    const type = req.params.type;
    if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid signature type" });
    }
    if (!req.file?.buffer) return res.status(400).json({ message: "No file" });

    const filename = `${Date.now()}-${req.file.originalname}`;
    const stream = gfs.openUploadStream(filename, { contentType: req.file.mimetype });
    stream.end(req.file.buffer);

    try {
        const fileId = await new Promise((resolve, reject) => {
            stream.on("finish", () => {
                console.log(`✅ ${type} signature upload stream finished for file ID: ${stream.id}`);
                resolve(stream.id);
            });
            stream.on("error", (err) => {
                console.error(`❌ GridFS upload stream error for ${type} signature (${req.file?.originalname || 'unknown'}):`, err);
                reject(err);
            });
        });

        const field = type === "guide" ? "guideSignatureId" : "groupLeaderSignatureId";
        const form = await UG2Form.findById(req.params.id);
        if (form?.[field]) { // Use optional chaining for safety
            console.log(`🗑️ Deleting old ${type} signature ${form[field]} for form ${req.params.id}`);
            await deleteGridFSFile(form[field]);
        }

        console.log(`Attempting to save ${type} signature fileId (${fileId}) to formId (${req.params.id}).`);
        await UG2Form.findByIdAndUpdate(req.params.id, { [field]: fileId });
        console.log(`✅ ${type} signature fileId (${fileId}) saved to formId (${req.params.id}).`);
        res.json({ message: `${type} signature uploaded`, fileId });
    } catch (error) {
        console.error(`❌ Error in ${type} signature upload route:`, error);
        res.status(500).json({ message: `Internal server error during ${type} signature upload.` });
    }
});

// === Fetch single UG2 form with URLs ===
router.get("/:id", async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid ID" });
    try {
        const form = await UG2Form.findById(req.params.id);
        if (!form) return res.status(404).json({ message: "Not found" });
        const full = await populateFormWithFileDetails(form);
        res.json(full);
    } catch (error) {
        console.error("❌ Error fetching UG2 form by ID:", error);
        res.status(500).json({ message: "Error fetching form data." });
    }
});

// === Fetch pending forms ===
router.get("/pending", async (req, res) => {
    try {
        const forms = await UG2Form.find({ status: "pending" });
        const full = await Promise.all(forms.map(populateFormWithFileDetails)); // populateFormWithFileDetails already handles errors internally
        res.json(full);
    } catch (error) {
        console.error("❌ Error fetching pending UG2 forms:", error);
        res.status(500).json({ message: "Error fetching pending forms." });
    }
});

// === Fetch by user (svvNetId) ===
router.get("/user/:svvNetId", async (req, res) => {
    try {
        const forms = await UG2Form.find({ svvNetId: req.params.svvNetId });
        if (!forms.length) return res.status(404).json({ message: "No forms found for this user." });
        const full = await Promise.all(forms.map(populateFormWithFileDetails));
        res.json(full);
    } catch (error) {
        console.error("❌ Error fetching UG2 forms by user:", error);
        res.status(500).json({ message: "Error fetching user forms." });
    }
});

// === Clear PDFs ===
router.put("/clearPdfs/:id", async (req, res) => {
    try {
        const form = await UG2Form.findById(req.params.id);
        if (!form) return res.status(404).json({ message: "Not found" });
        await Promise.all(form.uploadedFilesIds.map(deleteGridFSFile));
        form.uploadedFilesIds = [];
        await form.save();
        res.json({ message: "PDFs cleared" });
    } catch (error) {
        console.error("❌ Error clearing PDFs:", error);
        res.status(500).json({ message: "Error clearing PDFs." });
    }
});

// === Clear ZIP ===
router.put("/clearZip/:id", async (req, res) => {
    try {
        const form = await UG2Form.findById(req.params.id);
        if (!form) return res.status(404).json({ message: "Not found" });
        if (form.zipFileId) await deleteGridFSFile(form.zipFileId);
        form.zipFileId = undefined; // Using undefined will remove the field from the document
        await form.save();
        res.json({ message: "ZIP cleared" });
    } catch (error) {
        console.error("❌ Error clearing ZIP:", error);
        res.status(500).json({ message: "Error clearing ZIP." });
    }
});

// === Clear Signatures ===
router.put("/clearSignature/:id/:type", async (req, res) => {
    const { id, type } = req.params;
    try {
        const form = await UG2Form.findById(id);
        if (!form) return res.status(404).json({ message: "Not found" });

        let field, fid;
        if (type === "guide") {
            field = "guideSignatureId";
            fid = form[field];
        } else if (type === "groupLeader") {
            field = "groupLeaderSignatureId";
            fid = form[field];
        } else {
            return res.status(400).json({ message: "Invalid signature type" });
        }

        if (fid) {
            await deleteGridFSFile(fid);
            form[field] = undefined;
            await form.save();
        }
        res.json({ message: `${type} signature cleared` });
    } catch (error) {
        console.error(`❌ Error clearing ${type} signature:`, error);
        res.status(500).json({ message: `Error clearing ${type} signature.` });
    }
});

// === Faculty review ===
router.put("/faculty-review/:formId", async (req, res) => { // Changed param name to formId to match frontend
    const { status, remarks } = req.body;
    const { formId } = req.params; // Destructure formId

    try {
        const form = await UG2Form.findById(formId); // Use formId
        if (!form) return res.status(404).json({ message: "Not found" });

        form.status = status || form.status;
        form.remarks = remarks || form.remarks;
        await form.save();

        console.log(`✅ UG-2 form ${formId} reviewed. Status: ${status}, Remarks: ${remarks}`);
        res.status(200).json({ message: "Review updated" });
    } catch (error) {
        console.error("❌ Error reviewing UG-2 form:", error);
        res.status(500).json({ message: "Error reviewing form." });
    }
});

// === Serve files from GridFS ===
router.get("/uploads/:fileId", async (req, res) => {
    const { fileId } = req.params;
    if (!gfs || !mongoose.Types.ObjectId.isValid(fileId)) {
        return res.status(400).send("Invalid file ID");
    }

    const stream = gfs.openDownloadStream(new mongoose.Types.ObjectId(fileId));

    stream.on("file", (file) => {
        res.set("Content-Type", file.contentType || "application/octet-stream");
        res.set("Content-Disposition", `inline; filename="${file.filename}"`); // Keep inline for viewing
    });

    stream.on("error", (err) => {
        if (err.message.includes("File not found")) return res.status(404).send("Not found");
        console.error("❌ GridFS download error:", err);
        res.status(500).send("Server error");
    });

    stream.pipe(res);
});

export default router;