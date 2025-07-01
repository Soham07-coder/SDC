import mongoose from "mongoose";

const GuideSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employeeCode: { type: String, required: true },
}, { _id: false });

const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  year: { type: String, required: true },
  class: { type: String },
  div: { type: String },
  branch: { type: String, required: true },
  rollNo: { type: String, required: true },
  mobileNo: { type: String },
}, { _id: false });

const ExpenseSchema = new mongoose.Schema({
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  details: { type: String },
}, { _id: false });

const UGForm2Schema = new mongoose.Schema({
  svvNetId: { type: String, required: true },

  projectTitle: { type: String, required: true },
  projectDescription: { type: String, required: true },
  utility: { type: String, required: true },

  receivedFinance: { type: Boolean, required: true },
  financeDetails: {
    type: String,
    required: function () {
      return this.receivedFinance === true;
    },
  },

  guideDetails: {
    type: [GuideSchema],
    required: true,
    validate: v => Array.isArray(v) && v.length > 0,
  },

  students: {
    type: [StudentSchema],
    required: true,
    validate: v => Array.isArray(v) && v.length > 0,
  },

  expenses: {
    type: [ExpenseSchema],
    required: true,
    validate: v => Array.isArray(v) && v.length > 0,
  },

  totalBudget: { type: Number, required: true },

  groupLeaderSignatureId: { type: mongoose.Schema.Types.ObjectId, ref: "uploads" },
  guideSignatureId: { type: mongoose.Schema.Types.ObjectId, ref: "uploads" },

  uploadedFilesIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "uploads",
    default: [],
  },

  zipFileId: { type: mongoose.Schema.Types.ObjectId, ref: "uploads" },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },

  remarks: { type: String },
}, { timestamps: true });

const UG2Form = mongoose.model("UGForm2", UGForm2Schema);
export default UG2Form;