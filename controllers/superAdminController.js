import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import SuperAdmin from "../models/SuperAdmin.js";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import Bill from "../models/Bill.js";
import Redemption from "../models/Redemption.js";
import Reward from "../models/Reward.js";
import SystemSettings from "../models/SystemSettings.js";

const signJwt = (sa) =>
  jwt.sign({ sub: String(sa._id), username: sa.username, tv: sa.tokenVersion, role: "superadmin" }, process.env.JWT_SECRET);

// Seed default superadmin
export const seedSuperAdmin = async () => {
  const count = await SuperAdmin.countDocuments();
  if (count === 0) {
    await SuperAdmin.create({ username: "superadmin", password: "superadmin123" });
    console.log("✅ Default superadmin created — username: superadmin, password: superadmin123");
  }
};

// Login
export const loginSuperAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username and password required" });

    const sa = await SuperAdmin.findOne({ username }).select("+password +tokenVersion");
    if (!sa) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await sa.comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signJwt(sa);
    res.json({ message: "Login successful", token, superAdmin: { id: sa._id, username: sa.username } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalAdmins, totalUsers, totalBills, totalRedemptions, totalRewards] = await Promise.all([
      Admin.countDocuments(),
      User.countDocuments(),
      Bill.countDocuments(),
      Redemption.countDocuments(),
      Reward.countDocuments(),
    ]);

    const pendingBills = await Bill.countDocuments({ status: "pending" });
    const pendingRedemptions = await Redemption.countDocuments({ status: "pending" });
    const totalPointsIssued = await Bill.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$pointsEarned" } } },
    ]);

    res.json({
      totalAdmins, totalUsers, totalBills, totalRedemptions, totalRewards,
      pendingBills, pendingRedemptions,
      totalPointsIssued: totalPointsIssued[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all admins with their stats
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });

    const adminsWithStats = await Promise.all(admins.map(async (a) => {
      const users = await User.countDocuments({ shopId: a.shopId });
      const bills = await Bill.countDocuments({ approvedBy: a._id });
      const redemptions = await Redemption.countDocuments({ approvedBy: a._id });
      return { ...a.toObject(), userCount: users, billCount: bills, redemptionCount: redemptions };
    }));

    res.json({ admins: adminsWithStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single admin detail
export const getAdminDetail = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const users = await User.find({ shopId: admin.shopId }).select("-password").sort({ createdAt: -1 });
    const bills = await Bill.find({ approvedBy: admin._id }).sort({ createdAt: -1 }).limit(20);
    const rewards = await Reward.find({ adminId: admin._id }).sort({ createdAt: -1 });
    const redemptions = await Redemption.find({ approvedBy: admin._id }).populate("userId", "name mobile").populate("rewardId", "rewardName").sort({ createdAt: -1 }).limit(20);

    res.json({ admin, users, bills, rewards, redemptions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create admin (with email)
export const createAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email and password are required" });

    const exists = await Admin.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const shopId = "SHOP-" + nanoid(8).toUpperCase();
    const referralCode = "REF-" + nanoid(8).toUpperCase();
    const hash = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      adminId: email.toLowerCase(),
      email: email.toLowerCase(),
      password: hash,
      name,
      shopId,
      shopName: "",
      needsProfileSetup: true,
      referralCode,
    });

    // Auto-assign free trial based on SystemSettings
    try {
      const settings = await SystemSettings.findOne();
      const days = settings?.freeTrialDays ?? 7;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const AdminSubscription = (await import("../models/AdminSubscription.js")).default;
      await AdminSubscription.create({
        adminId: admin._id,
        planId: null,
        billingType: "free_trial",
        startDate: new Date(),
        endDate,
        status: "active",
        assignedBy: "superadmin",
      });
    } catch (_) {}

    res.status(201).json({
      message: "Admin created",
      admin: { adminId: admin.adminId, email: admin.email, name: admin.name, shopId: admin.shopId, shopName: admin.shopName, mobile: admin.mobile, referralCode: admin.referralCode, id: admin._id },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete admin
export const deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json({ message: "Admin deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(users.map(async (u) => {
      const result = await Bill.aggregate([
        { $match: { userId: u._id } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);
      return { ...u.toObject(), totalBillAmount: result[0]?.totalAmount || 0 };
    }));

    res.json({ users: usersWithStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all rewards across all admins
export const getAllRewards = async (req, res) => {
  try {
    const rewards = await Reward.find().populate("adminId", "adminId name shopId").sort({ createdAt: -1 });
    res.json({ rewards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all bills
export const getAllBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 });
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all redemptions
export const getAllRedemptions = async (req, res) => {
  try {
    const redemptions = await Redemption.find()
      .populate("userId", "name mobile walletPoints")
      .populate("rewardId", "rewardName pointsRequired")
      .sort({ createdAt: -1 });
    res.json({ redemptions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Change superadmin password
export const changeSuperAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both passwords required" });

    const sa = await SuperAdmin.findById(req.superAdmin.id).select("+password +tokenVersion");
    if (!sa) return res.status(404).json({ message: "Not found" });

    const ok = await sa.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ message: "Current password incorrect" });

    sa.password = newPassword;
    sa.tokenVersion += 1;
    await sa.save();

    const token = signJwt(sa);
    res.json({ message: "Password changed", token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
