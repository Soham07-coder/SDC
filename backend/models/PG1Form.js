import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema({
  beneficiary: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
  accountType: { type: String, required: true },
  accountNumber: { type: String, required: true },
});

// Embedded GridFS file metadata schema
const fileMetaSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  mimetype: { type: String },
  size: { type: Number },
}, { _id: false });

const pg1FormSchema = new mongoose.Schema({
  svvNetId: { type: String, required: true },
  studentName: { type: String, required: true },
  department: { type: String, required: false },
  remarks: { type: String },
  yearOfAdmission: { type: String, required: true },
  feesPaid: { type: String, enum: ['Yes', 'No'], default: 'No' },

  sttpTitle: { type: String, required: true },

  guideName: { type: String, required: true },
  coGuideName: { type: String },
  numberOfDays: { type: Number, required: true },

  dateFrom: { type: Date, required: true },
  dateTo: { type: Date, required: true },

  organization: { type: String, required: true },
  reason: { type: String, required: true },
  knowledgeUtilization: { type: String, required: true },

  bankDetails: { type: bankDetailsSchema, required: true },

  registrationFee: { type: String, required: true },
  previousClaim: { type: String, enum: ['Yes', 'No'], default: 'No' },
  claimDate: { type: Date },
  amountReceived: { type: String },
  amountSanctioned: { type: String },

  files: {
    receiptCopy: { type: fileMetaSchema, required: true },
    additionalDocuments: [fileMetaSchema],
    guideSignature: { type: fileMetaSchema, required: true },
    pdfDocuments: [fileMetaSchema],
    zipFiles: [fileMetaSchema],
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },

  createdAt: { type: Date, default: Date.now },
});

const PG1Form = mongoose.model("PG1Form", pg1FormSchema);
export default PG1Form;
