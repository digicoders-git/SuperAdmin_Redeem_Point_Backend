// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";

// Routes
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import rewardRoutes from "./routes/rewardRoutes.js";
import termsRoutes from "./routes/termsRoutes.js";
import privacyRoutes from "./routes/privacyRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { seedTerms } from "./controllers/termsController.js";
import { seedPrivacy } from "./controllers/privacyController.js";
import { seedSuperAdmin } from "./controllers/superAdminController.js";


const app = express();

// Security & logs
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(morgan("dev"));

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files (uploads) - allow cross-origin access
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static("uploads"));

// Rate limit for login endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use("/api/admin/login", authLimiter);

// Connect DB
await connectDB();
await seedTerms();
await seedPrivacy();
await seedSuperAdmin();

// Fix: drop old unique indexes on startup (one-time migration)
try {
  const mongoose = await import("mongoose");
  const col = mongoose.default.connection.collection("users");
  await col.dropIndex("email_1").catch(() => {});
  console.log("✅ Old User indexes dropped (if existed)");
} catch (_) {}

// Mount routes
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/notifications", notificationRoutes);

// Health / root
app.get("/", (_req, res) => res.send("✅ API is running..."));

app.get("/health", (_req, res) =>
  res.json({ status: "OK", time: new Date().toISOString() })
);

// 404 handler
app.use((req, res) =>
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on :${PORT}`));
