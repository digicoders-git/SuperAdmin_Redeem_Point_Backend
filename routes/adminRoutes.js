import express from "express";
import { 
  registerAdmin,
  loginAdmin,
  googleLoginAdmin,
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
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "../uploads/admin-photos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "admin-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images are allowed."));
    }
  },
});

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/google-login", googleLoginAdmin);

// protected routes
router.get("/list", authenticateAdmin, listAdmins);
router.post("/logout-all", authenticateAdmin, logoutAll);
router.patch("/change-password", authenticateAdmin, changeAdminPassword);
router.get("/profile", authenticateAdmin, getAdminProfile);
router.put("/profile", authenticateAdmin, updateAdminProfile);
router.delete("/profile", authenticateAdmin, deleteAdmin);
router.put("/update-fcm-token", authenticateAdmin, updateAdminFCMToken);
router.post("/profile/photo", authenticateAdmin, upload.single("profilePhoto"), uploadAdminProfilePhoto);

// terms routes
router.get("/terms", authenticateAdmin, getAdminTerms);
router.put("/terms", authenticateAdmin, updateAdminTerms);
router.get("/terms/:shopId", getTermsByShopId);
router.get("/shop/:shopId", getAdminByShopId);

export default router;
