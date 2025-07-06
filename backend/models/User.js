import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    svvNetId: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String, // Add the role field as a String
      required: true, // Make it required, as roles are essential for the frontend logic
      // You might also consider adding an 'enum' here if roles are fixed,
      // e.g., enum: ["Student", "Validator", "Department Coordinator", "Institute Coordinator", "HOD", "Principal", "Admin"]
    },
  },
  { collection: "users" } // Ensure collection name is 'users'
);

// ✅ Use `export default` for ES Modules
const User = mongoose.model("User", UserSchema);
export default User;