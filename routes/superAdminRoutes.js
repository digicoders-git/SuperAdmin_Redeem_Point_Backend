import express from "express";
import {
  loginSuperAdmin,
  getDashboardStats,
  getAllAdmins,
  getAdminDetail,
  createAdmin,
  deleteAdmin,
  getAllUsers,
  getAllRewards,
  getAllBills,
  getAllRedemptions,
  changeSuperAdminPassword,
} from "../controllers/superAdminController.js";
import { authenticateSuperAdmin } from "../middleware/superAdminAuth.js";

const router = express.Router();

router.post("/login", loginSuperAdmin);

router.get("/dashboard", authenticateSuperAdmin, getDashboardStats);
router.get("/admins", authenticateSuperAdmin, getAllAdmins);
router.get("/admins/:id", authenticateSuperAdmin, getAdminDetail);
router.post("/admins", authenticateSuperAdmin, createAdmin);
router.delete("/admins/:id", authenticateSuperAdmin, deleteAdmin);
router.get("/users", authenticateSuperAdmin, getAllUsers);
router.get("/rewards", authenticateSuperAdmin, getAllRewards);
router.get("/bills", authenticateSuperAdmin, getAllBills);
router.get("/redemptions", authenticateSuperAdmin, getAllRedemptions);
router.patch("/change-password", authenticateSuperAdmin, changeSuperAdminPassword);

export default router;
