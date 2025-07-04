import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    class: { type: String, required: true, trim: true },
    div: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    mobileNo: { type: String, required: true, trim: true }
}, { _id: false });

const ExpenseSchema = new mongoose.Schema({
    srNo: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 }
}, { _id: false });

const BankDetailsSchema = new mongoose.Schema({
    beneficiary: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    ifsc: { type: String, required: true, trim: true },
    accountType: {type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true }
}, { _id: false });

// --- CORRECTED FileUploadSchema for GridFS ---
const FileUploadSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    originalname: { type: String, required: true }, // <-- ADDED THIS LINE
    fileId: { type: mongoose.Schema.Types.ObjectId, required: false },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true }
}, { _id: false });
// --- END CORRECTED FileUploadSchema ---

const UG3AFormSchema = new mongoose.Schema({
    svvNetId: { type: String, required: true },
    organizingInstitute: {
        type: String,
        required: [true, "Organizing Institute is required."],
        trim: true
    },
    projectTitle: {
        type: String,
        required: [true, "Project Title is required."],
        trim: true
    },
    students: {
        type: [StudentSchema],
        required: true,
        validate: [val => val.length > 0, 'At least one student is required.']
    },
    expenses: {
        type: [ExpenseSchema],
        required: true,
        validate: [val => val.length > 0, 'At least one expense entry is required.']
    },
    bankDetails: {
        type: BankDetailsSchema,
        required: true
    },
    // Added totalAmount field as it's calculated in your route
    totalAmount: {
        type: Number,
        required: true, // Assuming total amount is always calculated
        min: 0
    },
    // File Uploads - now storing GridFS file metadata
    uploadedImage: {
        type: FileUploadSchema,
        default: null
    },
    uploadedPdfs: {
        type: [FileUploadSchema],
        validate: [val => val.length <= 5, 'A maximum of 5 PDF files are allowed.'],
        default: []
    },
    uploadedZipFile: {
        type: FileUploadSchema,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'under review', 'rejected'],
        default: 'pending'
    },
    remarks: { type: String },
}, { timestamps: true });

const UG3AForm = mongoose.model("UG3AForm", UG3AFormSchema);

export default UG3AForm;