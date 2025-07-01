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
  employeeCodes: { type: String, required: true },
  studentName: { type: String, required: true },
  yearOfAdmission: { type: String, required: true },
  branch: { type: String, required: true },
  rollNo: { type: String, required: true },
  mobileNo: { type: String, required: true },
  feesPaid: { type: String, enum: ['Yes', 'No'], required: true, default: 'No' },
  receivedFinance: { type: String, enum: ['Yes', 'No'], required: true, default: 'No' },
  financeDetails: { type: String, default: '' },

  paperTitle: { type: String, default: '' },
  paperLink: { type: String, default: '' },
  authors: {
    type: [String],
    validate: {
      validator: function(arr) {
        return arr.length > 0;
      },
      message: 'Authors array must have at least one author.'
    },
    required: true,
  },

  sttpTitle: { type: String, default: '' },
  organizers: { type: String, default: '' },
  reasonForAttending: { type: String, default: '' },
  numberOfDays: { type: Number, default: 0 },
  dateFrom: { type: Date },
  dateTo: { type: Date },
  registrationFee: { type: String, default: '' },

  bankDetails: { type: bankDetailsSchema, required: true },

  amountClaimed: { type: String, default: '' },
  finalAmountSanctioned: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },

  proofDocumentFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  studentSignatureFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  guideSignatureFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  hodSignatureFileId: { type: mongoose.Schema.Types.ObjectId, required: true },

  pdfFileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'r1files' }],
  zipFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'r1files' },

  dateOfSubmission: { type: Date, default: Date.now },
  remarksByHOD: { type: String, default: '' },
  remarks: { type: String },

}, { timestamps: true });

const R1Form = mongoose.model("R1Form", R1FormSchema);

export default R1Form;
