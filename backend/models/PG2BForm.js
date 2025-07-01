import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema({
  beneficiary: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
  accountType: { type: String, required: true },
  accountNumber: { type: String, required: true },
});

// Define reusable schema for file metadata
const fileMetadataSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const PG2BFormSchema = new mongoose.Schema({
  svvNetId: {
    type: String,
    required: true,
    trim: true,
  },
  department: { type: String, required: true },
  studentName: { type: String, required: true },
  yearOfAdmission: { type: String, required: true },
  feesPaid: { type: String, enum: ['Yes', 'No'], required: true },
  projectTitle: { type: String, required: true },
  guideName: { type: String, required: true },
  coGuideName: { type: String },
  conferenceDate: { type: Date, required: true },
  organization: { type: String, required: true },
  publisher: { type: String, required: true },
  paperLink: { type: String },

  authors: {
    type: [String],
    validate: {
      validator: function (arr) {
        return Array.isArray(arr) && arr.length === 4;
      },
      message: 'Authors array must have exactly 4 strings',
    },
    required: true,
  },

  bankDetails: { type: bankDetailsSchema, required: true },

  registrationFee: { type: String, required: true },
  previousClaim: { type: String, enum: ['Yes', 'No'], required: true },
  claimDate: { type: Date },
  amountReceived: { type: String },
  amountSanctioned: { type: String },
  remarks: { type: String },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'under Review'],
    default: 'pending',
  },

  // ✅ Store complete file metadata
  paperCopy: { type: fileMetadataSchema, required: true },
  groupLeaderSignature: { type: fileMetadataSchema, required: true },
  guideSignature: { type: fileMetadataSchema, required: true },
  additionalDocuments: { type: [fileMetadataSchema], default: [] },

}, {
  timestamps: true,
});

const PG2BForm = mongoose.model("PG2BForm", PG2BFormSchema);
export default PG2BForm;
