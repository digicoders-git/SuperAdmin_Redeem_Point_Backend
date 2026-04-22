import express from "express";
import {
  sendNotification,
  getAdminNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { userAuth } from "../middleware/userAuth.js";
import { authenticateSuperAdmin } from "../middleware/superAdminAuth.js";

const router = express.Router();

// SuperAdmin routes
router.post("/send", authenticateSuperAdmin, sendNotification);

// Admin routes
router.get("/admin", authenticateAdmin, getAdminNotifications);
router.patch("/admin/read-all", authenticateAdmin, markAllAsRead);

// User routes
router.get("/user", userAuth, getUserNotifications);
router.patch("/user/read-all", userAuth, markAllAsRead);

// Common routes
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;
