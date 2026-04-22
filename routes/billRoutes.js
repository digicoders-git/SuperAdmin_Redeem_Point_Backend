import express from "express";
import {
  uploadBill,
  getMyBills,
  getSingleBill,
  getAllBills,
  getBillDetail,
  editBillAmount,
  approveBill,
  rejectBill,
  setPointConfiguration,
  getPointConfiguration,
  getRepeatedCustomerStats,
  setTierConfiguration,
  getTierConfiguration,
} from "../controllers/billController.js";
import { userAuth } from "../middleware/userAuth.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { uploadBillFile } from "../config/cloudinary.js";

const router = express.Router();

// User routes
router.post("/upload", userAuth, uploadBillFile, uploadBill);
router.get("/my-bills", userAuth, getMyBills);
router.get("/my-bills/:id", userAuth, getSingleBill);
router.get("/tier-config/:shopId", getTierConfiguration);

// Admin routes
router.post("/admin/point-config", authenticateAdmin, setPointConfiguration);
router.get("/admin/point-config", authenticateAdmin, getPointConfiguration);
router.post("/admin/tier-config", authenticateAdmin, setTierConfiguration);
router.get("/admin/tier-config", authenticateAdmin, getTierConfiguration);
router.get("/admin/all", authenticateAdmin, getAllBills);
router.get("/admin/repeated-customers", authenticateAdmin, getRepeatedCustomerStats);
router.get("/admin/:id", authenticateAdmin, getBillDetail);
router.patch("/admin/:id/edit-amount", authenticateAdmin, editBillAmount);
router.patch("/admin/:id/approve", authenticateAdmin, approveBill);
router.patch("/admin/:id/reject", authenticateAdmin, rejectBill);

export default router;
