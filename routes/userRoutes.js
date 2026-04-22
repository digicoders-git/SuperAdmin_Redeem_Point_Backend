import express from "express";
import {
  registerUser,
  sendLoginOTP,
  verifyLoginOTP,
  completeUserRegistration,
  getProfile,
  updateProfile,
  uploadUserPhoto,
  logoutUser,
  getAllUsers,
  getSingleUser,
  getUserDetails,
  toggleUserStatus,
  deleteUser,
  changeUserPassword,
  getUserShops,
  switchShop,
  getShopPublicInfo,
  addPointsToUser,
  updateFCMToken,
} from "../controllers/userController.js";
import { userAuth } from "../middleware/userAuth.js";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { uploadProfilePhoto } from "../config/cloudinary.js";

const router = express.Router();

// User routes
router.post("/register", registerUser);
router.post("/send-otp", sendLoginOTP);
router.post("/verify-otp", verifyLoginOTP);
router.post("/complete-registration", completeUserRegistration);
router.get("/shop-info/:shopId", getShopPublicInfo);
router.get("/profile", userAuth, getProfile);
router.get("/shops", userAuth, getUserShops);
router.post("/switch-shop", userAuth, switchShop);
router.put("/profile", userAuth, updateProfile);
router.put("/update-fcm-token", userAuth, async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    await User.findByIdAndUpdate(req.user.sub, { fcmToken: req.body.fcmToken });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});
router.put("/update-fcm-token", userAuth, updateFCMToken);
router.post("/profile/photo", userAuth, (req, res, next) => {
  uploadProfilePhoto(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, uploadUserPhoto);
router.post("/logout", userAuth, logoutUser);

// Admin routes
router.get("/admin/all", authenticateAdmin, getAllUsers);
router.get("/admin/:id/details", authenticateAdmin, getUserDetails);
router.get("/admin/:id", authenticateAdmin, getSingleUser);
router.patch("/admin/:id/status", authenticateAdmin, toggleUserStatus);
router.patch("/admin/:id/add-points", authenticateAdmin, addPointsToUser);
router.patch("/admin/:id/change-password", authenticateAdmin, changeUserPassword);
router.delete("/admin/:id", authenticateAdmin, deleteUser);

export default router;
