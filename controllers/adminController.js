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

  
// Create Admin
export const createAdmin = async (req, res) => {
  try {
    // debug (optional)
    // console.log("createAdmin headers:", req.headers);
    // console.log("createAdmin body:", req.body);

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Request body is empty. Make sure you are sending JSON and Content-Type: application/json",
      });
    }

    const { adminId, password, name } = req.body;

    if (!adminId || !password) {
      return res
        .status(400)
        .json({ message: "adminId and password are required." });
    }

    const exists = await Admin.findOne({ adminId }).lean();
    if (exists) {
      return res
        .status(409)
        .json({ message: "Admin with this adminId already exists." });
    }

    const hash = await bcrypt.hash(password, 10);
    const resolvedAdminId = adminId || mobile; // Use provided ID or fallback to mobile
    const shopId = "SHOP-" + nanoid(8).toUpperCase();
    const referralCode = "REF-" + nanoid(8).toUpperCase();
    const admin = await Admin.create({ adminId: resolvedAdminId, password: hash, name, mobile, shopId, referralCode });

    // Auto-assign free trial
    try {
      let settings = await SystemSettings.findOne();
      if (!settings) {
        settings = await SystemSettings.create({ freeTrialDays: 7 });
      }
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + settings.freeTrialDays);
      
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

    return res.status(201).json({
      message: "Admin created successfully",
      admin: { adminId: admin.adminId, name: admin.name, id: admin._id, shopId: admin.shopId, referralCode: admin.referralCode },
    });
  } catch (err) {
    console.error("createAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Login Admin
export const loginAdmin = async (req, res) => {
  try {
    // console.log("loginAdmin body:", req.body);

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Request body is empty. Make sure you are sending JSON and Content-Type: application/json",
      });
    }

    const { adminId, password } = req.body;

    if (!adminId || !password) {
      return res
        .status(400)
        .json({ message: "adminId and password are required." });
    }

    const admin = await Admin.findOne({ adminId }).select(
      "+password +tokenVersion"
    );
    if (!admin)
      return res.status(401).json({ message: "Invalid credentials." });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    const token = signJwt(admin);

    return res.json({
      message: "Login successful",
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        shopId: admin.shopId,
        mobile: admin.mobile,
        id: admin._id,
      },
      token,
    });
  } catch (err) {
    console.error("loginAdmin error:", err);
    return res.status(500).json({ message: "Server error" });
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

// Send OTP for Admin Login/Registration
export const sendAdminOTP = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || mobile.length !== 10) {
      return res.status(400).json({ message: "Valid 10-digit mobile number required" });
    }

    const otp = "1234";
    adminOtpStore.set(mobile, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });

    console.log(`Admin OTP for ${mobile}: ${otp}`);
    console.log(`Current OTP store:`, Array.from(adminOtpStore.entries()));

    res.json({
      message: "OTP sent successfully",
      mobile,
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("sendAdminOTP error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Verify OTP for Admin
export const verifyAdminOTP = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    console.log(`Verifying OTP for mobile: ${mobile}, otp: ${otp}`);
    console.log(`Current OTP store:`, Array.from(adminOtpStore.entries()));

    if (!mobile || !otp) {
      return res.status(400).json({ message: "Mobile and OTP are required" });
    }

    const otpData = adminOtpStore.get(mobile);
    if (!otpData) {
      return res.status(400).json({ message: "OTP not found or expired. Please request a new OTP" });
    }

    if (Date.now() > otpData.expiresAt) {
      adminOtpStore.delete(mobile);
      return res.status(400).json({ message: "OTP expired. Please request a new OTP" });
    }

    if (otpData.attempts >= 3) {
      adminOtpStore.delete(mobile);
      return res.status(400).json({ message: "Too many failed attempts. Please request a new OTP" });
    }

    if (otpData.otp !== otp) {
      otpData.attempts++;
      return res.status(400).json({
        message: "Invalid OTP",
        attemptsLeft: 3 - otpData.attempts,
      });
    }

    adminOtpStore.delete(mobile);

    const admin = await Admin.findOne({ mobile }).select("+tokenVersion");
    
    if (!admin) {
      return res.json({
        message: "OTP verified",
        isNewUser: true,
        mobile,
      });
    }

    const token = signJwt(admin);
    res.json({
      message: "Login successful",
      isNewUser: false,
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        shopId: admin.shopId,
        mobile: admin.mobile,
        id: admin._id,
      },
      token,
    });
  } catch (error) {
    console.error("verifyAdminOTP error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Complete Admin Registration
export const completeAdminRegistration = async (req, res) => {
  try {
    const { mobile, name } = req.body;

    if (!mobile || !name) {
      return res.status(400).json({ message: "Mobile and name are required" });
    }

    const exists = await Admin.findOne({ mobile });
    if (exists) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    const adminId = mobile;
    const shopId = "SHOP-" + nanoid(8).toUpperCase();
    const referralCode = "REF-" + nanoid(8).toUpperCase();

    const admin = await Admin.create({
      adminId,
      mobile,
      name,
      shopId,
      referralCode,
    });

    try {
      let settings = await SystemSettings.findOne();
      if (!settings) {
        settings = await SystemSettings.create({ freeTrialDays: 7 });
      }
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + settings.freeTrialDays);
      
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
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        shopId: admin.shopId,
        mobile: admin.mobile,
        id: admin._id,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
