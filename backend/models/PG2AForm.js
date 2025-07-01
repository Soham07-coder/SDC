import mongoose from "mongoose";

const studentDetailSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: String, required: true },
  division: { type: String, required: true },
  branch: { type: String, required: true },
  rollNo: { type: String, required: true },
  mobileNo: { type: String, required: true },
});

const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
});

const bankDetailsSchema = new mongoose.Schema({
  beneficiary: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
  accountType: { type: String, required: true },
  accountNumber: { type: String, required: true },
});

const pg2aFormSchema = new mongoose.Schema({
  svvNetId: { type: String, required: true },
  organizingInstitute: { type: String, required: true },
  projectTitle: { type: String, required: true },
  teamName: { type: String, required: false },
  guideName: { type: String, required: false },
  department: { type: String, required: false },
  studentDetails: { type: [studentDetailSchema], required: true },
  expenses: { type: [expenseSchema], required: true },

  bankDetails: { type: bankDetailsSchema, required: true },
  remarks: { type: String },
  date: { type: Date },

  files: {
    bills: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pg2afiles.files' }],
      required: true,
      validate: [arr => arr.length <= 5, '{PATH} exceeds the limit of 5'],
    },
    zips: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'pg2afiles.files' }],
      default: [],
      validate: [arr => arr.length <= 2, '{PATH} exceeds the limit of 2'],
    },
    studentSignature: { type: mongoose.Schema.Types.ObjectId, ref: 'pg2afiles.files', required: true },
    guideSignature: { type: mongoose.Schema.Types.ObjectId, ref: 'pg2afiles.files', required: true },
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'under Review'],
    default: 'pending',
  },
  remarks: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const PG2AForm = mongoose.model("PG2AForm", pg2aFormSchema);

export default PG2AForm;
