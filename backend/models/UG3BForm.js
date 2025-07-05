import mongoose from "mongoose";

const fileInfoSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Add this field
  filename: String,
  originalname: String,
  mimetype: String,
  size: Number
}, { _id: false });

const bankDetailsSchema = new mongoose.Schema({
  beneficiary: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
  accountType: { type: String, required: true },
  accountNumber: { type: String, required: true }
}, { _id: false });

const UG3BFormSchema = new mongoose.Schema({
  svvNetId: { type: String, required: true },
  studentName: { type: String, required: true },
  department: { type: String, required: true }, // ✅ Add this line
  yearOfAdmission: { type: String, required: true },
  feesPaid: { type: String, enum: ['Yes', 'No'], required: true },
  projectTitle: { type: String, required: true },
  guideName: { type: String, required: true },
  employeeCode: { type: String, required: true },
  conferenceDate: { type: Date, required: true },
  organization: { type: String, required: true },
  publisher: { type: String, required: true },
  paperLink: { type: String },
  authors: [{ type: String, required: true }],
  bankDetails: { type: bankDetailsSchema, required: true },
  registrationFee: { type: String, required: true },
  previousClaim: { type: String, enum: ['Yes', 'No'], required: true },
  claimDate: { type: Date },
  amountReceived: { type: String },
  amountSanctioned: { type: String },

  // Single files
  paperCopy: fileInfoSchema,
  groupLeaderSignature: fileInfoSchema,
  additionalDocuments: fileInfoSchema,
  guideSignature: fileInfoSchema,

  // Multiple PDFs (max 5)
  pdfDocuments: {
    type: [fileInfoSchema],
    validate: [arrayLimitPDF, '{PATH} exceeds the limit of 5']
  },

  // Multiple ZIPs (max 2)
  zipFiles: {
    type: [fileInfoSchema],
    validate: [arrayLimitZIP, '{PATH} exceeds the limit of 2']
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  remarks: { type: String },
}, { timestamps: true });

// Custom validators
function arrayLimitPDF(val) {
  return val.length <= 5;
}

function arrayLimitZIP(val) {
  return val.length <= 2;
}

const UG3BForm = mongoose.model("UG3BForm", UG3BFormSchema);

export default UG3BForm;
