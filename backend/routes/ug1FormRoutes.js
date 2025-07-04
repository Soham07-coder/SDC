import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { GridFSBucket, ObjectId } from "mongodb"; // Ensure ObjectId is imported
import UG1Form from "../models/UG1Form.js";

const router = express.Router();
const conn = mongoose.connection;

let gfsBucket;
let uploadMemoryMiddlewareInstance = null;

// Initialize GridFSBucket and Multer memory storage ONCE THE MONGODB CONNECTION IS OPEN.
conn.once("open", () => {
    try {
        gfsBucket = new GridFSBucket(conn.db, { bucketName: "uploads" }); // For uploads/rollbacks
        uploadMemoryMiddlewareInstance = multer({ storage: multer.memoryStorage() });
        console.log("✅ GridFSBucket and Multer (memoryStorage) initialized for UG1Form routes");

        // === ALL ROUTE DEFINITIONS MUST BE PLACED INSIDE THIS BLOCK ===
        // This ensures gfsBucket and uploadMemoryMiddlewareInstance are available when routes are registered.

        // Helper function to delete a file from GridFS
        const deleteGridFSFile = async (fileId) => {
            if (!fileId || !gfsBucket || !mongoose.Types.ObjectId.isValid(fileId)) {
                console.warn(`Attempted to delete invalid or null fileId for deletion: ${fileId}`);
                return;
            }
            try {
                await gfsBucket.delete(new mongoose.Types.ObjectId(fileId));
                console.log(`🗑️ Successfully deleted GridFS file: ${fileId}`);
            } catch (error) {
                if (error.message.includes("File not found")) {
                    console.warn(`🤔 GridFS file not found for deletion: ${fileId}`);
                } else {
                    console.error(`❌ Error deleting GridFS file ${fileId}:`, error);
                }
            }
        };

        // Route for submitting UG-1 forms
        router.post('/saveFormData', (req, res, next) => {
            // Dynamically use the initialized multer middleware
            if (!uploadMemoryMiddlewareInstance) {
                return res.status(503).json({ message: "File upload service not ready." });
            }
            const uploadFields = uploadMemoryMiddlewareInstance.fields([
                { name: 'pdfFiles', maxCount: 5 },
                { name: 'zipFile', maxCount: 1 },
                { name: 'groupLeaderSignature', maxCount: 1 },
                { name: 'guideSignature', maxCount: 1 }
            ]);
            uploadFields(req, res, next);
        }, async (req, res) => {
            console.log("Received form data (req.body):", req.body);
            const uploadedFileIds = []; // Store IDs for rollback

            try {
                const {
                    svvNetId,
                    projectTitle,
                    projectUtility,
                    projectDescription,
                    finance,
                    amountClaimed,
                    studentDetails,
                    guides
                } = req.body;

                const files = req.files || {};

                // Helper to upload a file buffer to GridFS
                const uploadFileToGridFS = async (file) => {
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
                        uploadStream.on('finish', () => resolve(fileId));
                        uploadStream.on('error', reject);
                    });
                };

                const pdfFileIds = files.pdfFiles ? await Promise.all(files.pdfFiles.map(uploadFileToGridFS)) : [];
                const zipFileId = files.zipFile && files.zipFile.length > 0 ? await uploadFileToGridFS(files.zipFile[0]) : null;
                const groupLeaderSignatureId = files.groupLeaderSignature && files.groupLeaderSignature.length > 0 ? await uploadFileToGridFS(files.groupLeaderSignature[0]) : null;
                const guideSignatureId = files.guideSignature && files.guideSignature.length > 0 ? await uploadFileToGridFS(files.guideSignature[0]) : null;

                // Parse JSON strings for arrays
                const parsedStudentDetails = typeof studentDetails === 'string' ? JSON.parse(studentDetails) : studentDetails;
                const parsedGuides = typeof guides === 'string' ? JSON.parse(guides) : guides;
                // >>>>>>> IMPORTANT FIX: Map incoming 'name' to 'guideName' for Mongoose schema <<<<<<<
                const formattedGuidesForSchema = parsedGuides.map(guide => ({
                    guideName: guide.name, // Map 'name' from frontend to 'guideName' for the schema
                    employeeCode: guide.employeeCode
                }));
                const newForm = new UG1Form({
                    svvNetId: svvNetId ? String(svvNetId).trim() : '',
                    projectTitle,
                    projectUtility,
                    projectDescription,
                    finance,
                    amountClaimed,
                    studentDetails: parsedStudentDetails,
                    guides: formattedGuidesForSchema, // Use the newly formatted guides
                    pdfFileIds,
                    zipFileId,
                    groupLeaderSignatureId,
                    guideSignatureId,
                    status: 'pending',
                }); 
                console.log("Mongoose document to be saved:", newForm); // <--- ADD THIS LINE
                await newForm.save();
                uploadedFileIds.length = 0; // Clear rollback list upon successful save
                res.status(201).json({ message: 'UG-1 form submitted successfully!', id: newForm._id });

            } catch (error) {
                console.error('❌ UG-1 form submission error:', error);
                // Rollback: Delete uploaded files if an error occurred
                for (const fileId of uploadedFileIds) {
                    await deleteGridFSFile(fileId);
                }
                res.status(500).json({ message: 'Error submitting form.', error: error.message });
            }
        });

        // GET all UG-1 forms
        router.get('/all', async (req, res) => {
            try {
                const forms = await UG1Form.find({});
                res.status(200).json(forms);
            } catch (error) {
                console.error("❌ Error fetching all UG-1 forms:", error);
                res.status(500).json({ message: "Error fetching forms." });
            }
        });

        // GET UG-1 form by ID (This must come AFTER specific routes like /saveFormData and /all)
        router.get('/:formId', async (req, res) => {
            try {
                const form = await UG1Form.findById(req.params.formId);
                if (!form) return res.status(404).json({ message: "Not found" });
                res.status(200).json(form);
            } catch (error) {
                console.error("❌ Error fetching UG-1 form by ID:", error);
                res.status(500).json({ message: "Error fetching form." });
            }
        }); 

        // PUT (update) UG-1 form status
        router.put('/:formId/review', async (req, res) => {
            const { formId } = req.params;
            const { status, remarks } = req.body;

            try {
                const form = await UG1Form.findById(formId);
                if (!form) return res.status(404).json({ message: "Not found" });

                form.status = status || form.status;
                form.remarks = remarks || form.remarks;
                await form.save();

                console.log(`✅ UG-1 form ${formId} reviewed. Status: ${status}, Remarks: ${remarks}`);
                res.status(200).json({ message: "Review updated" });
            } catch (error) {
                console.error("❌ Error reviewing UG-1 form:", error);
                res.status(500).json({ message: "Error reviewing form." });
            }
        });

        // === Route for serving uploaded files (from GridFS) ===
        // This route is now correctly placed inside the conn.once("open") block
        // to ensure gfsBucket is initialized when it's registered.
        router.get("/uploads/files/:fileId", async (req, res) => {
            const { fileId } = req.params;

            if (!gfsBucket) {
                return res.status(503).json({ message: "GridFS is not initialized." });
            }
            if (!mongoose.Types.ObjectId.isValid(fileId)) {
                return res.status(400).json({ message: "Invalid file ID format." });
            }

            try {
                const files = await gfsBucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
                if (!files || files.length === 0) {
                    return res.status(404).json({ message: "File not found." });
                }

                const file = files[0];
                res.set('Content-Type', file.contentType || 'application/octet-stream');
                res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);

                const downloadStream = gfsBucket.openDownloadStream(file._id);
                downloadStream.pipe(res);

                downloadStream.on('error', (err) => {
                    console.error(`Error streaming file ${fileId}:`, err);
                    res.status(500).json({ message: "Error streaming file." });
                });
            } catch (error) {
                console.error(`Error retrieving file ${fileId}:`, error);
                res.status(500).json({ message: "Server error retrieving file." });
            }
        });

    } catch (error) {
        console.error("❌ Error initializing GridFSBucket or Multer in UG1Form routes:", error);
    }
}); // End of conn.once("open", ...) block

export default router;