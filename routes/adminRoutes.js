import express from "express";
import { 
  registerAdmin,
  loginAdmin,
  sendAdminOtp,
  verifyAdminOtp,
  listAdmins, 
  logoutAll, 
  changeAdminPassword, 
  getAdminTerms, 
  updateAdminTerms, 
  getTermsByShopId, 
  getAdminByShopId,
  updateAdminFCMToken,
  getAdminProfile,
  deleteAdmin,
  updateAdminProfile,
  uploadAdminProfilePhoto
} from "../controllers/adminController.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { uploadProfilePhoto } from "../config/cloudinary.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/send-otp", sendAdminOtp);
router.post("/verify-otp", verifyAdminOtp);

// protected routes
router.get("/list", authenticateAdmin, listAdmins);
router.post("/logout-all", authenticateAdmin, logoutAll);
router.patch("/change-password", authenticateAdmin, changeAdminPassword);
router.get("/profile", authenticateAdmin, getAdminProfile);
router.put("/profile", authenticateAdmin, updateAdminProfile);
router.put("/update-profile", authenticateAdmin, updateAdminProfile);
router.delete("/profile", authenticateAdmin, deleteAdmin);
router.put("/update-fcm-token", authenticateAdmin, updateAdminFCMToken);
router.post("/profile/photo", authenticateAdmin, uploadProfilePhoto, uploadAdminProfilePhoto);

// terms routes
router.get("/terms", authenticateAdmin, getAdminTerms);
router.put("/terms", authenticateAdmin, updateAdminTerms);
router.get("/terms/:shopId", getTermsByShopId);
router.get("/shop/:shopId", getAdminByShopId);

export default router;
