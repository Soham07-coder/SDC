import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs"; // Import bcryptjs for password hashing and comparison
import User from "../models/User.js"; // Make sure the path to your User model is correct

dotenv.config(); // Load environment variables from .env file

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", async (req, res) => {
  const { svvNetId, password } = req.body;

  // For security, avoid logging the password directly in production
  console.log("📩 Received Login Request for SVVNetID:", svvNetId);

  // Input validation
  if (!svvNetId || !password) {
    return res.status(400).json({ message: "SVVNetID and password are required." });
  }

  try {
    // 1. Find user by svvNetId (ensure lowercase for consistent lookup as per schema)
    const user = await User.findOne({ svvNetId: svvNetId.toLowerCase() });

    // For security, log only the ID or email, not the whole user object
    console.log("👤 User Found Status:", user ? "Yes" : "No");

    if (!user) {
      // Return a generic error message to prevent user enumeration
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    // 2. Compare the provided plaintext password with the stored hashed password
    // This is the crucial security improvement using bcryptjs
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Password Mismatch for SVVNetID:", svvNetId);
      // Return a generic error message for incorrect password
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    // 3. Generate JWT Token with essential user information
    // Include user's _id and role in the token payload for client-side access control
    const token = jwt.sign(
      {
        id: user._id, // MongoDB document ID
        svvNetId: user.svvNetId,
        role: user.role, // User's role (e.g., 'Admin', 'Student', 'Validator')
      },
      process.env.JWT_SECRET, // Your secret key from .env
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    console.log("✅ Login Successful for SVVNetID:", user.svvNetId, "Role:", user.role);

    // 4. Send success response with the token and non-sensitive user data
    res.status(200).json({
      message: "Login Successful",
      token,
      user: { // Send back relevant user data for immediate frontend use
        _id: user._id,
        svvNetId: user.svvNetId,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("❌ Server Error during login process:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;
