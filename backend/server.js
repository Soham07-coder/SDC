import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

// ✅ Route Imports
import authRoutes from "./routes/authRoutes.js";
import ug1FormRoutes from "./routes/ug1FormRoutes.js";
import ug2FormRoutes from "./routes/UGForm2Route.js";
import ug3aFormRoutes from "./routes/ug3aFormRoutes.js";
import ug3bFormRoutes from "./routes/ug3bFormRoutes.js";
import pg1formRoutes from "./routes/pg1formRoutes.js";
import pg2aFormRoutes from "./routes/pg2aformRoutes.js";
import pg2bFormRoutes from "./routes/pg2bformRoutes.js";
import r1FormRoutes from './routes/r1formRoutes.js';
import applicationRoutes from "./routes/applicationRoutes.js";
import facapplicationRoutes from "./routes/facapplicationRoutes.js";

dotenv.config();

const app = express();

// 🔹 CORS Setup
app.use(
  cors({
    origin: 'http://localhost:5173', // Your frontend's origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Explicitly allow PATCH
    allowedHeaders: ['Content-Type', 'Authorization'], // Important for custom headers like Authorization
    credentials: true, // Needed for cookies/auth headers
  })
);

// 🔹 Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (for form submissions)
app.use(cookieParser());

// 🔹 MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "Users",
  })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1); // Exit if DB connection fails
  });

// 🔹 Routes
app.use("/api/auth", authRoutes);
app.use("/api/ug1form", ug1FormRoutes);
app.use("/api/ug2form", ug2FormRoutes); 
app.use("/api/ug3aform", ug3aFormRoutes);
app.use("/api/ug3bform",ug3bFormRoutes);
app.use("/api/pg1form", pg1formRoutes);
app.use("/api/pg2aform", pg2aFormRoutes);
app.use("/api/pg2bform", pg2bFormRoutes);
app.use("/api/application", applicationRoutes);
app.use('/api/r1form',r1FormRoutes);
app.use("/api/facapplication",facapplicationRoutes);

// 🔹 404 handler (optional, helps catch unknown routes)
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// 🔹 Global error handler (optional)
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// 🔹 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
