import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import Admin from "../models/Admin.js";
import AdminSubscription from "../models/AdminSubscription.js";
import SystemSettings from "../models/SystemSettings.js";

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

// Temporary OTP storage for admins
const adminOtpStore = new Map();

// helpers
const signJwt = (admin) =>
  jwt.sign(
    { sub: String(admin._id), adminId: admin.adminId, tv: admin.tokenVersion },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

// Register Admin (email + password)
export const registerAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ message: "email, password and name are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const exists = await Admin.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const shopId = "SHOP-" + nanoid(8).toUpperCase();
    const referralCode = "REF-" + nanoid(8).toUpperCase();
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = await Admin.create({
      adminId: email.toLowerCase(),
      email: email.toLowerCase(),
      password: hash,
      name,
      shopId,
      referralCode,
    });

    // Auto-assign 1 year free trial
    try {
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      await AdminSubscription.create({
        adminId: admin._id,
        planId: null,
        billingType: "free_trial",
        startDate: new Date(),
        endDate,
        status: "active",
        assignedBy: "system",
      });
    } catch (_) {}

    const token = signJwt(admin);
    res.status(201).json({
      message: "Admin registered successfully",
      admin: { adminId: admin.adminId, email: admin.email, name: admin.name, shopId: admin.shopId, id: admin._id },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login or Auto-Register Admin (email + password)
export const loginAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password are required" });

    let admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password +tokenVersion");

    if (!admin) {
      // Auto-create new admin
      const shopId = "SHOP-" + nanoid(8).toUpperCase();
      const referralCode = "REF-" + nanoid(8).toUpperCase();
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      admin = await Admin.create({
        adminId: email.toLowerCase(),
        email: email.toLowerCase(),
        password: hash,
        name: name || email.split("@")[0],
        shopId,
        referralCode,
      });
      // Auto-assign 1 year free trial
      try {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        await AdminSubscription.create({
          adminId: admin._id, planId: null, billingType: "free_trial",
          startDate: new Date(), endDate, status: "active", assignedBy: "system",
        });
      } catch (_) {}
      admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password +tokenVersion");
    } else {
      // Existing admin — verify password
      const ok = await bcrypt.compare(password, admin.password);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signJwt(admin);
    res.json({
      message: "Login successful",
      admin: { adminId: admin.adminId, email: admin.email, name: admin.name, shopId: admin.shopId, mobile: admin.mobile, id: admin._id },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Google Login for Admin — auto register if not exists
export const googleLoginAdmin = async (req, res) => {
  try {
    const { googleUserInfo } = req.body;
    if (!googleUserInfo?.email) return res.status(400).json({ message: "Google user info required" });

    let admin = await Admin.findOne({ email: googleUserInfo.email.toLowerCase() }).select("+tokenVersion");

    if (!admin) {
      // Auto-create new admin
      const shopId = "SHOP-" + nanoid(8).toUpperCase();
      const referralCode = "REF-" + nanoid(8).toUpperCase();
      admin = await Admin.create({
        adminId: googleUserInfo.email.toLowerCase(),
        email: googleUserInfo.email.toLowerCase(),
        name: googleUserInfo.name || googleUserInfo.email.split("@")[0],
        shopId,
        referralCode,
      });
      try {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        await AdminSubscription.create({
          adminId: admin._id, planId: null, billingType: "free_trial",
          startDate: new Date(), endDate, status: "active", assignedBy: "system",
        });
      } catch (_) {}
      admin = await Admin.findOne({ email: googleUserInfo.email.toLowerCase() }).select("+tokenVersion");
    }

    const token = signJwt(admin);
    res.json({
      message: "Login successful",
      admin: { adminId: admin.adminId, email: admin.email, name: admin.name, shopId: admin.shopId, id: admin._id },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List Admins (protected)
export const listAdmins = async (_req, res) => {
  try {
    const admins = await Admin.find(
      {},
      { adminId: 1, name: 1, createdAt: 1, updatedAt: 1 }
    ).lean();
    return res.json({ admins });
  } catch (err) {
    console.error("listAdmins error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Change Admin Password
export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters" });

    const admin = await Admin.findById(req.admin.id).select("+password +tokenVersion");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    admin.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    admin.tokenVersion += 1;
    await admin.save();

    const token = signJwt(admin);
    res.json({ message: "Password changed successfully", token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Optional: logout-all (invalidate old tokens by bumping tokenVersion)
export const logoutAll = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("+tokenVersion");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    admin.tokenVersion += 1;
    await admin.save();
    res.json({ message: "Logged out from all sessions" });
  } catch (err) {
    console.error("logoutAll error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Admin's Terms & Conditions
export const getAdminTerms = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.json({ terms: admin.termsAndConditions || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Admin's Terms & Conditions
export const updateAdminTerms = async (req, res) => {
  try {
    const { terms } = req.body;

    if (!Array.isArray(terms)) {
      return res.status(400).json({ message: "Terms must be an array" });
    }

    const admin = await Admin.findByIdAndUpdate(
      req.admin.id,
      { termsAndConditions: terms },
      { new: true }
    );

    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.json({ message: "Terms updated successfully", terms: admin.termsAndConditions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Admin Profile (Name and Mobile)
export const updateAdminProfile = async (req, res) => {
  try {
    const { name, mobile } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (name) admin.name = name;
    if (mobile) {
      admin.mobile = mobile;
      admin.adminId = mobile;
    }
    
    await admin.save();

    res.json({
      message: "Profile updated successfully",
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        shopId: admin.shopId,
        mobile: admin.mobile,
        profilePhoto: admin.profilePhoto,
        id: admin._id,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Admin FCM Token
export const updateAdminFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await Admin.findByIdAndUpdate(req.admin.id, { fcmToken });
    res.json({ success: true, message: "Admin FCM Token updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload Admin Profile Photo
export const uploadAdminProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Generate proper URL for the uploaded file - convert backslashes to forward slashes
    const photoUrl = `/uploads/admin-photos/${req.file.filename}`;
    admin.profilePhoto = photoUrl;
    await admin.save();

    res.json({
      message: "Profile photo updated successfully",
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        shopId: admin.shopId,
        mobile: admin.mobile,
        profilePhoto: admin.profilePhoto,
        id: admin._id,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Terms by ShopId (for users)
export const getTermsByShopId = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!shopId) {
      return res.status(400).json({ message: "ShopId is required" });
    }

    const admin = await Admin.findOne({ shopId });
    if (!admin) {
      return res.status(404).json({ message: "Shop not found" });
    }

    res.json({ terms: admin.termsAndConditions || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Admin by ShopId (for users to see admin profile photo)
export const getAdminByShopId = async (req, res) => {

  try {
    const { shopId } = req.params;
    if (!shopId) return res.status(400).json({ message: "ShopId is required" });
    const admin = await Admin.findOne({ shopId });
    if (!admin) return res.status(404).json({ message: "Shop not found" });
    res.json({
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        profilePhoto: admin.profilePhoto,
        shopId: admin.shopId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
