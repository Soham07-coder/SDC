// R1Form.js
import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema({
  beneficiary: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
  accountType: { type: String, required: true },
  accountNumber: { type: String, required: true },
});

const R1FormSchema = new mongoose.Schema({
  svvNetId: { type: String, required: true },
  guideName: { type: String, required: true },
  coGuideName: { type: String, default: '' },
  employeeCodes: { type: [String], required: true }, // Changed to array of strings based on parsing in route
  studentName: { type: String, required: true },
  yearOfAdmission: { type: String, required: true },
  branch: { type: String, required: true },
  rollNo: { type: String, required: true },
  mobileNo: { type: String, required: true },
  feesPaid: { type: String, enum: ['Yes', 'No'], required: true, default: 'No' },
  receivedFinance: { type: String, enum: ['Yes', 'No'], required: true, default: 'No' },
  financeDetails: { type: String, default: '' },

  paperTitle: { type: String, default: '' },
  paperLink: { type: String, default: '' }, // Now accepts any string, including "NO" or empty
  authors: { type: [String], required: true }, // Array of strings

  sttpTitle: { type: String, default: '' },
  organizers: { type: String, default: '' },
  reasonForAttending: { type: String, default: '' },
  numberOfDays: { type: Number, default: 0 },
  dateFrom: { type: Date },
  dateTo: { type: Date },
  registrationFee: { type: String, default: '' },

  bankDetails: { type: bankDetailsSchema, required: true },

  amountClaimed: { type: String, default: '' },
  // Renamed from finalAmountSanctioned to amountSanctioned to match backend logic
  amountSanctioned: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

  // === IMPORTANT CHANGES: Updated schema to store full file metadata objects ===
  proofDocumentFileId: { type: Object }, // Store the full metadata object { id, filename, originalName, mimetype, size }
  studentSignatureFileId: { type: Object, required: true }, // Store the full metadata object
  guideSignatureFileId: { type: Object, required: true },   // Store the full metadata object
  hodSignatureFileId: { type: Object, required: true },     // Store the full metadata object
  sdcChairpersonSignatureFileId: { type: Object, default: null }, // Store the full metadata object, optional

  pdfFileIds: [{ type: Object }], // Array of full metadata objects
  zipFileId: { type: Object },    // Store the full metadata object

  dateOfSubmission: { type: Date, default: Date.now },
  remarksByHod: { type: String, default: '' },
  sdcChairpersonDate: { type: Date, default: null }, // Added for SDC Chairperson date

}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

const R1Form = mongoose.model('R1Form', R1FormSchema);

export default R1Form;
