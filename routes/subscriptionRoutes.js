import express from "express";
import {
  createPlan, getPlans, updatePlan, deletePlan,
  assignSubscription, getAllSubscriptions, cancelSubscription,
  getMySubscription, createOrder, verifyPayment, claimFreeTrial,
  getSystemSettings, updateSystemSettings,
} from "../controllers/subscriptionController.js";
import { authenticateSuperAdmin } from "../middleware/superAdminAuth.js";
import { authenticateAdmin, authenticateAdminOnly } from "../middleware/adminAuth.js";

const router = express.Router();

// Public — active plans (for subscription wall)
router.get("/plans/public", getPlans);
router.get("/settings/public", getSystemSettings);

// SuperAdmin — System Settings
router.get("/settings", authenticateSuperAdmin, getSystemSettings);
router.put("/settings", authenticateSuperAdmin, updateSystemSettings);

// SuperAdmin — Plans
router.get("/plans", authenticateSuperAdmin, getPlans);
router.post("/plans", authenticateSuperAdmin, createPlan);
router.put("/plans/:id", authenticateSuperAdmin, updatePlan);
router.delete("/plans/:id", authenticateSuperAdmin, deletePlan);

// SuperAdmin — Subscriptions
router.post("/assign", authenticateSuperAdmin, assignSubscription);
router.get("/all", authenticateSuperAdmin, getAllSubscriptions);
router.patch("/:id/cancel", authenticateSuperAdmin, cancelSubscription);

// Admin — own subscription (no subscription check needed)
router.get("/my", authenticateAdminOnly, getMySubscription);
router.post("/claim-trial", authenticateAdminOnly, claimFreeTrial);

// Admin — Purchase (Razorpay) (no subscription check needed)
router.post("/create-order", authenticateAdminOnly, createOrder);
router.post("/verify-payment", authenticateAdminOnly, verifyPayment);

export default router;
