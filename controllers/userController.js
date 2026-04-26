import User from "../models/User.js";
import Admin from "../models/Admin.js";
import jwt from "jsonwebtoken";

// Temporary OTP storage (in production, use Redis)
const otpStore = new Map();

// Register User (email + password)
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, shopId } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "name, email and password are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const exists = await User.findOne({ email: email.toLowerCase(), shopId: shopId || "" });
    if (exists) return res.status(409).json({ message: "Already registered with this shop" });

    const user = await User.create({ name, email: email.toLowerCase(), password, mobile: "", shopId: shopId || "" });

    const token = jwt.sign(
      { sub: user._id, mobile: user.mobile, tv: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    let shopName = "Inaamify";
    if (user.shopId) {
      const admin = await Admin.findOne({ shopId: user.shopId }).select("name");
      if (admin) shopName = admin.name;
    }

    res.status(201).json({
      message: "Registered successfully",
      user: { id: user._id, name: user.name, email: user.email, shopId: user.shopId, shopName },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login or Auto-Register User (email + password)
export const loginUser = async (req, res) => {
  try {
    const { email, password, shopId } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "email and password are required" });

    const emailLower = email.toLowerCase();

    // Find ALL accounts with this email across all shops
    const allAccounts = await User.find({ email: emailLower }).select("+password");

    if (allAccounts.length === 0) {
      // Brand new user — create account for this shop
      const newUser = await User.create({
        name: emailLower.split("@")[0],
        email: emailLower,
        password,
        mobile: "",
        shopId: shopId || "",
      });
      const token = jwt.sign(
        { sub: newUser._id, mobile: "", tv: newUser.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );
      let shopName = "Inaamify";
      if (newUser.shopId) {
        const admin = await Admin.findOne({ shopId: newUser.shopId }).select("name");
        if (admin) shopName = admin.name;
      }
      return res.json({
        message: "Login successful",
        user: { id: newUser._id, name: newUser.name, email: newUser.email, shopId: newUser.shopId, shopName },
        token,
        multipleShops: false,
      });
    }

    // Verify password against any existing account
    const ok = await allAccounts[0].comparePassword(password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // If shopId provided, check if account exists for this shop
    if (shopId) {
      let shopAccount = allAccounts.find(u => u.shopId === shopId);
      if (!shopAccount) {
        // Auto-create account for this new shop
        shopAccount = await User.create({
          name: allAccounts[0].name,
          email: emailLower,
          password,
          mobile: "",
          shopId,
        });
      }
      if (!shopAccount.isActive) return res.status(403).json({ message: "Your account has been deactivated by this shop owner." });

      const token = jwt.sign(
        { sub: shopAccount._id, mobile: "", tv: shopAccount.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );
      const admin = await Admin.findOne({ shopId }).select("name");
      return res.json({
        message: "Login successful",
        user: { id: shopAccount._id, name: shopAccount.name, email: shopAccount.email, shopId: shopAccount.shopId, shopName: admin?.name || "Inaamify" },
        token,
        multipleShops: allAccounts.length > 1,
      });
    }

    // No shopId — if multiple shops, show selection
    const activeAccounts = allAccounts.filter(u => u.shopId);
    if (activeAccounts.length > 1) {
      const firstUser = activeAccounts[0];
      const token = jwt.sign(
        { sub: firstUser._id, mobile: "", tv: firstUser.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );
      const admin = await Admin.findOne({ shopId: firstUser.shopId }).select("name");
      return res.json({
        message: "Login successful",
        user: { id: firstUser._id, name: firstUser.name, email: firstUser.email, shopId: firstUser.shopId, shopName: admin?.name || "Inaamify" },
        token,
        multipleShops: true,
      });
    }

    // Single account
    const user = allAccounts[0];
    if (!user.isActive) return res.status(403).json({ message: "Your account has been deactivated by this shop owner." });
    const token = jwt.sign(
      { sub: user._id, mobile: "", tv: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    const admin = user.shopId ? await Admin.findOne({ shopId: user.shopId }).select("name") : null;
    return res.json({
      message: "Login successful",
      user: { id: user._id, name: user.name, email: user.email, shopId: user.shopId, shopName: admin?.name || "Inaamify" },
      token,
      multipleShops: false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get User's Shops
export const getUserShops = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.sub).select("email");
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const users = await User.find({ email: currentUser.email })
      .select("shopId createdAt name")
      .sort({ createdAt: -1 });

    const shopsWithDetails = await Promise.all(
      users.map(async (u) => {
        const admin = await Admin.findOne({ shopId: u.shopId }).select("name shopId adminId");
        return {
          userId: u._id,
          shopId: u.shopId,
          registeredAt: u.createdAt,
          adminName: admin?.name || "Unknown Shop",
          adminId: admin?.adminId || "",
        };
      })
    );

    res.json({ shops: shopsWithDetails });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Switch Shop - Generate new token for selected userId
export const switchShop = async (req, res) => {
  try {
    const { userId } = req.body;

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const currentUser = await User.findById(req.user.sub).select("email");
    if (targetUser.email !== currentUser.email)
      return res.status(403).json({ message: "Unauthorized shop access" });

    const token = jwt.sign(
      { sub: targetUser._id, mobile: targetUser.mobile, tv: targetUser.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    let shopName = "Inaamify";
    if (targetUser.shopId) {
      const admin = await Admin.findOne({ shopId: targetUser.shopId }).select("name");
      if (admin) shopName = admin.name;
    }

    res.json({
      message: "Shop switched successfully",
      user: { id: targetUser._id, name: targetUser.name, email: targetUser.email, shopId: targetUser.shopId, shopName },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Fetch shop name
    let shopName = "CS Partner App";
    if (user.shopId) {
      const admin = await Admin.findOne({ shopId: user.shopId }).select("name");
      if (admin) shopName = admin.name;
    }
    
    res.json({ user: { ...user.toObject(), shopName } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { name, mobile, profilePhoto } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (mobile) updates.mobile = mobile;
    if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(req.user.sub, updates, {
      new: true,
    }).select("-password");

    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update FCM Token
export const updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.user.sub, { fcmToken });
    res.json({ success: true, message: "FCM Token updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload Profile Photo
export const uploadUserPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { profilePhoto: req.file.path },
      { new: true }
    ).select("-password");
    res.json({ message: "Profile photo updated", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Logout
export const logoutUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.sub, {
      $inc: { tokenVersion: 1 },
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Admin: Get All Users (only own shop users)
export const getAllUsers = async (req, res) => {
  try {
    const Bill = (await import("../models/Bill.js")).default;
    const users = await User.find({ shopId: req.admin.shopId }).select("-password").sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(users.map(async (u) => {
      const result = await Bill.aggregate([
        { $match: { userId: u._id } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);
      return { ...u.toObject(), totalPurchase: result[0]?.totalAmount || 0 };
    }));

    res.json({ users: usersWithStats, count: usersWithStats.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get Single User
export const getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get User Details with bills & redemptions
export const getUserDetails = async (req, res) => {
  try {
    const Bill = (await import("../models/Bill.js")).default;
    const Redemption = (await import("../models/Redemption.js")).default;

    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const [bills, redemptions] = await Promise.all([
      Bill.find({ userId: user._id }).sort({ createdAt: -1 }),
      Redemption.find({ userId: user._id }).populate("rewardId", "title pointsRequired").sort({ createdAt: -1 }),
    ]);

    const totalBillAmount = bills.filter(b => b.status === "approved").reduce((s, b) => s + b.amount, 0);
    const totalPointsEarned = bills.reduce((s, b) => s + (b.pointsEarned || 0), 0);
    const totalPointsRedeemed = redemptions.filter(r => r.status !== "rejected" && r.status !== "cancelled").reduce((s, r) => s + r.pointsUsed, 0);

    res.json({
      user,
      stats: {
        totalBills: bills.length,
        approvedBills: bills.filter(b => b.status === "approved").length,
        pendingBills: bills.filter(b => b.status === "pending").length,
        rejectedBills: bills.filter(b => b.status === "rejected").length,
        totalBillAmount,
        totalPointsEarned,
        totalRedemptions: redemptions.length,
        totalPointsRedeemed,
      },
      recentBills: bills.slice(0, 5),
      recentRedemptions: redemptions.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Toggle User Status
export const toggleUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Change User Password
export const changeUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    // bump tokenVersion to invalidate existing sessions
    user.tokenVersion += 1;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Add Points to User
export const addPointsToUser = async (req, res) => {
  try {
    const { points, reason } = req.body;
    if (!points || isNaN(points) || Number(points) <= 0)
      return res.status(400).json({ message: "Valid points value required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.walletPoints = (user.walletPoints || 0) + Number(points);
    await user.save();

    // Create a manual bill entry so it shows in history
    const Bill = (await import("../models/Bill.js")).default;
    await Bill.create({
      userId: user._id,
      amount: 0,
      billImage: "manual_adjustment",
      status: "approved",
      pointsEarned: Number(points),
      approvedBy: req.admin.id,
      approvedAt: new Date(),
    });

    // Send push notification
    const { sendPushNotification } = await import("../utils/notification.js");
    if (user.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        "🎁 Points Received!",
        `The admin added ${points} points to your wallet. Reason: ${reason || "Manual adjustment"}`
      );
    }

    // Save in-app notification
    const Notification = (await import("../models/Notification.js")).default;
    await Notification.create({
      recipientType: "user",
      recipientId: user._id,
      recipientModel: "User",
      shopId: req.admin.shopId,
      title: "🎁 Points Received!",
      message: `Admin added ${points} points. Reason: ${reason || "Manual adjustment"}`,
      type: "system"
    });

    res.json({ message: "Points added successfully", walletPoints: user.walletPoints });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Delete User
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const Bill = (await import("../models/Bill.js")).default;
    const Redemption = (await import("../models/Redemption.js")).default;
    await Promise.all([
      Bill.deleteMany({ userId: req.params.id }),
      Redemption.deleteMany({ userId: req.params.id }),
    ]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Google Login
export const googleLogin = async (req, res) => {
  try {
    const { googleUserInfo, shopId } = req.body;
    if (!googleUserInfo?.email) return res.status(400).json({ message: "Google user info required" });

    const { email, name } = googleUserInfo;
    const emailLower = email.toLowerCase();

    // Find account for this email + shopId
    let user = await User.findOne({ email: emailLower, shopId: shopId || "" });

    if (!user) {
      // Get existing name if user has other shop accounts
      const existing = await User.findOne({ email: emailLower });
      user = await User.create({
        name: existing?.name || name || emailLower.split("@")[0],
        email: emailLower,
        mobile: "",
        shopId: shopId || "",
      });
    } else {
      if (!user.isActive) return res.status(403).json({ message: "Your account has been deactivated by this shop owner." });
    }

    const allAccounts = await User.find({ email: emailLower });
    const multipleShops = allAccounts.filter(u => u.shopId).length > 1;

    const token = jwt.sign(
      { sub: user._id, mobile: "", tv: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    let shopName = "Inaamify";
    if (user.shopId) {
      const admin = await Admin.findOne({ shopId: user.shopId }).select("name");
      if (admin) shopName = admin.name;
    }

    res.json({
      message: "Login successful",
      user: { id: user._id, name: user.name, email: user.email, shopId: user.shopId, shopName },
      token,
      multipleShops,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Public Shop Info
export const getShopPublicInfo = async (req, res) => {
  try {
    const { shopId } = req.params;
    if (!shopId) return res.status(400).json({ message: "Shop ID is required" });
    
    const admin = await Admin.findOne({ shopId }).select("name");
    if (!admin) return res.status(404).json({ message: "Shop not found" });
    
    res.json({ shopName: admin.name });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
