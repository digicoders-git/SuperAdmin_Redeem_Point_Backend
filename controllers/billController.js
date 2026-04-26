import Bill from "../models/Bill.js";
import User from "../models/User.js";
import PointSetting from "../models/PointSetting.js";
import { sendPushNotification } from "../utils/notification.js";
import Notification from "../models/Notification.js";

// User: Upload Bill
export const uploadBill = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Bill file is required" });
    }

    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const billImage = `/uploads/bills/${req.file.filename}`;

    const bill = await Bill.create({
      userId: req.user.sub,
      billImage,
      amount,
    });

    res.status(201).json({
      message: "Bill uploaded successfully",
      bill,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User: Get My Bills
export const getMyBills = async (req, res) => {
  try {
    const bills = await Bill.find({ userId: req.user.sub }).sort({
      createdAt: -1,
    });
    res.json({ bills, count: bills.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User: Get Single Bill
export const getSingleBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      userId: req.user.sub,
    });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    res.json({ bill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get All Bills
export const getAllBills = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Isolation: Find users belonging to the current admin's shop
    const usersInShop = await User.find({ shopId: req.admin.shopId }).select('_id');
    const userIds = usersInShop.map(u => u._id);

    const filter = { 
      userId: { $in: userIds }
    };
    if (status) filter.status = status;

    const bills = await Bill.find(filter)
      .populate("userId", "name email mobile")
      .sort({ createdAt: -1 });

    res.json({ bills, count: bills.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get Single Bill Detail
export const getBillDetail = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).json({ message: "Bill not found" });
    }
    const bill = await Bill.findById(req.params.id).populate(
      "userId",
      "name email mobile walletPoints"
    );

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    res.json({ bill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Edit Bill Amount (any status) + notify user
export const editBillAmount = async (req, res) => {
  try {
    const { amount, editReason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }
    if (!editReason?.trim()) {
      return res.status(400).json({ message: "Edit reason is required" });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const oldAmount = bill.amount;
    bill.amount = amount;
    await bill.save();

    // Notify user
    const user = await User.findById(bill.userId);
    if (user) {
      if (user.fcmToken) {
        await sendPushNotification(
          user.fcmToken,
          "📝 Bill Amount Updated",
          `Your bill amount was updated from ₹${oldAmount} to ₹${amount}. Reason: ${editReason}`
        );
      }
      await Notification.create({
        recipientType: "user",
        recipientId: bill.userId,
        recipientModel: "User",
        shopId: req.admin.shopId,
        title: "📝 Bill Amount Updated",
        message: `Your bill amount was updated from ₹${oldAmount} to ₹${amount}. Reason: ${editReason}`,
        type: "system",
      });
    }

    res.json({ message: "Bill amount updated successfully", bill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Approve Bill
export const approveBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    if (bill.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Bill is already ${bill.status}` });
    }

    // Get point setting for the current admin
    let pointSetting = await PointSetting.findOne({ adminId: req.admin.id, isActive: true });
    
    // Fallback if not configured: Default to 100
    const amountPerPoint = pointSetting ? pointSetting.amountPerPoint : 100;

    // Calculate points
    const pointsEarned = Math.floor(bill.amount / amountPerPoint);

    // Update bill
    bill.status = "approved";
    bill.pointsEarned = pointsEarned;
    bill.approvedBy = req.admin.id;
    bill.approvedAt = new Date();
    await bill.save();

    // Update user wallet
    await User.findByIdAndUpdate(bill.userId, {
      $inc: { walletPoints: pointsEarned },
    });

    // Send push notification
    const user = await User.findById(bill.userId);
    if (user && user.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        "✅ Bill Approved!",
        `Congratulations! Your bill of ₹${bill.amount} has been approved and you earned ${pointsEarned} points.`
      );
    }

    // Save in-app notification
    await Notification.create({
      recipientType: "user",
      recipientId: bill.userId,
      recipientModel: "User",
      shopId: req.admin.shopId,
      title: "✅ Bill Approved!",
      message: `Your bill of ₹${bill.amount} has been approved. +${pointsEarned} points.`,
      type: "system"
    });

    res.json({
      message: bill.pointsEarned > 0 
        ? `Bill approved! ${pointsEarned} points awarded.` 
        : "Bill approved successfully.",
      bill,
      pointsEarned,
      isConfigured: !!pointSetting
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Reject Bill
export const rejectBill = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    if (bill.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Bill is already ${bill.status}` });
    }

    bill.status = "rejected";
    bill.rejectionReason = rejectionReason || "Not specified";
    bill.approvedBy = req.admin.id;
    bill.approvedAt = new Date();
    await bill.save();

    // Send push notification
    const user = await User.findById(bill.userId);
    if (user && user.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        "❌ Bill Rejected",
        `Sorry, your bill of ₹${bill.amount} was rejected. Reason: ${bill.rejectionReason}`
      );
    }

    // Save in-app notification
    await Notification.create({
      recipientType: "user",
      recipientId: bill.userId,
      recipientModel: "User",
      shopId: req.admin.shopId,
      title: "❌ Bill Rejected",
      message: `Your bill of ₹${bill.amount} was rejected. Reason: ${bill.rejectionReason}`,
      type: "system"
    });

    res.json({
      message: "Bill rejected successfully",
      bill,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Set Point Configuration
export const setPointConfiguration = async (req, res) => {
  try {
    const { amountPerPoint } = req.body;

    if (!amountPerPoint || amountPerPoint <= 0) {
      return res.status(400).json({ message: "amountPerPoint must be greater than 0" });
    }

    // Update or create point setting for current admin
    await PointSetting.updateMany({ adminId: req.admin.id }, { isActive: false });

    const pointSetting = await PointSetting.create({
      amountPerPoint,
      adminId: req.admin.id,
      isActive: true,
    });

    res.json({
      message: "Point configuration updated successfully",
      pointSetting,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get Point Configuration
export const getPointConfiguration = async (req, res) => {
  try {
    let pointSetting = await PointSetting.findOne({ adminId: req.admin.id, isActive: true });
    
    // If not exists, create with defaults
    if (!pointSetting) {
      pointSetting = await PointSetting.create({
        adminId: req.admin.id,
        amountPerPoint: 100,
        bronzeThreshold: 0,
        silverThreshold: 500,
        goldThreshold: 2000,
        platinumThreshold: 5000,
        isActive: true,
      });
    }
    
    res.json({ pointSetting });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Set Tier Configuration
export const setTierConfiguration = async (req, res) => {
  try {
    const { bronzeThreshold, silverThreshold, goldThreshold, platinumThreshold } = req.body;

    // Validate thresholds
    if (bronzeThreshold === undefined || silverThreshold === undefined || goldThreshold === undefined || platinumThreshold === undefined) {
      return res.status(400).json({ message: "All tier thresholds are required" });
    }

    // Validate order: bronze < silver < gold < platinum
    if (!(bronzeThreshold < silverThreshold && silverThreshold < goldThreshold && goldThreshold < platinumThreshold)) {
      return res.status(400).json({ message: "Tier thresholds must be in ascending order: Bronze < Silver < Gold < Platinum" });
    }

    // First, check if point setting exists
    let pointSetting = await PointSetting.findOne({ adminId: req.admin.id, isActive: true });
    
    // If not exists, create one with default values
    if (!pointSetting) {
      pointSetting = await PointSetting.create({
        adminId: req.admin.id,
        amountPerPoint: 100,
        bronzeThreshold,
        silverThreshold,
        goldThreshold,
        platinumThreshold,
        isActive: true,
      });
    } else {
      // Update existing
      pointSetting = await PointSetting.findOneAndUpdate(
        { adminId: req.admin.id, isActive: true },
        {
          bronzeThreshold,
          silverThreshold,
          goldThreshold,
          platinumThreshold,
        },
        { new: true }
      );
    }

    res.json({
      message: "Tier configuration updated successfully",
      pointSetting,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Tier Configuration (supports both admin and user access)
export const getTierConfiguration = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const adminId = req.admin?.id;
    
    let query = { isActive: true };
    
    if (adminId) {
      query.adminId = adminId;
    } else if (shopId) {
      const Admin = (await import("../models/Admin.js")).default;
      const admin = await Admin.findOne({ shopId });
      if (!admin) {
        return res.json({ tiers: { bronze: 0, silver: 500, gold: 2000, platinum: 5000 } });
      }
      query.adminId = admin._id;
    } else {
      return res.status(400).json({ message: "Admin ID or Shop ID required" });
    }
    
    const pointSetting = await PointSetting.findOne(query);
    
    if (!pointSetting) {
      return res.json({ tiers: { bronze: 0, silver: 500, gold: 2000, platinum: 5000 } });
    }

    res.json({
      tiers: {
        bronze: pointSetting.bronzeThreshold,
        silver: pointSetting.silverThreshold,
        gold: pointSetting.goldThreshold,
        platinum: pointSetting.platinumThreshold,
      },
      pointSetting,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get Repeated Customer Stats
export const getRepeatedCustomerStats = async (req, res) => {
  try {
    const shopId = req.admin.shopId;
    
    // Find users belonging to the current admin's shop
    const usersInShop = await User.find({ shopId }).select("_id");
    const userIds = usersInShop.map((u) => u._id);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyStats = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));

      // 1. Find all bills on this day for users in this shop
      const billsOnDay = await Bill.find({
        userId: { $in: userIds },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      // 2. Identify unique users who uploaded bills today
      const uniqueUsersOnDay = [...new Set(billsOnDay.map((b) => b.userId.toString()))];

      // 3. For each unique user, check if they have at least one bill already (before this one or previously)
      let repeatCount = 0;
      for (const userId of uniqueUsersOnDay) {
        const totalBillsUpToDay = await Bill.countDocuments({
          userId,
          createdAt: { $lte: endOfDay },
        });
        if (totalBillsUpToDay > 1) {
          repeatCount++;
        }
      }

      dailyStats.push({
        name: days[d.getDay()],
        value: repeatCount,
        date: d.toDateString(),
      });
    }

    res.json({
      repeatedCustomersToday: dailyStats[6].value,
      dailyStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
