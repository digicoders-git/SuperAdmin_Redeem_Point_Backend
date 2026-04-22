import express from "express";
import { getPrivacy, getAllPrivacyAdmin, addPrivacy, updatePrivacy, deletePrivacy } from "../controllers/privacyController.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// Public
router.get("/", getPrivacy);

// Admin
router.get("/admin/all", authenticateAdmin, getAllPrivacyAdmin);
router.post("/admin/add", authenticateAdmin, addPrivacy);
router.put("/admin/:id", authenticateAdmin, updatePrivacy);
router.delete("/admin/:id", authenticateAdmin, deletePrivacy);

export default router;
