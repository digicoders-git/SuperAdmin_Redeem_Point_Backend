import express from "express";
import { getTerms, getAllTermsAdmin, addTerm, updateTerm, deleteTerm } from "../controllers/termsController.js";
import { authenticateSuperAdmin } from "../middleware/superAdminAuth.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

// Public
router.get("/", getTerms);

// Admin panel - read superadmin terms
router.get("/for-admin", authenticateAdmin, getTerms);

// SuperAdmin only
router.get("/admin/all", authenticateSuperAdmin, getAllTermsAdmin);
router.post("/admin/add", authenticateSuperAdmin, addTerm);
router.put("/admin/:id", authenticateSuperAdmin, updateTerm);
router.delete("/admin/:id", authenticateSuperAdmin, deleteTerm);

export default router;
