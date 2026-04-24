import Reward from "../models/Reward.js";
import Redemption from "../models/Redemption.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Notification from "../models/Notification.js";
import { notifyShopUsers } from "./notificationController.js";
import { sendPushNotification } from "../utils/notification.js";

// Admin: Add Reward
export const addReward = async (req, res) => {
  try {
    const { rewardName, rewardImage, pointsRequired, description } = req.body;

    if (!rewardName || !pointsRequired) {
      return res.status(400).json({ message: "rewardName and pointsRequired are required" });
    }

    if (pointsRequired <= 0) {
      return res.status(400).json({ message: "pointsRequired must be greater than 0" });
    }

    // Handle uploaded images from multer
    const uploadedImages = req.files ? req.files.map((f) => f.path) : [];
    const rewardImages = uploadedImages.length > 0 ? uploadedImages : (rewardImage ? [rewardImage] : []);

    const reward = await Reward.create({
      adminId: req.admin?.id || null,
      rewardName,
      rewardImage: rewardImages[0] || "",
      rewardImages,
      pointsRequired,
      description,
    });

    // Notify all shop users about new reward
    const admin = await Admin.findById(req.admin.id);
    if (admin?.shopId) {
      try {
        await notifyShopUsers(
          admin.shopId,
          "🎁 New Reward Available!",
          `${rewardName} is now available for ${pointsRequired} points. Check it out!`,
          "reward",
          { rewardId: reward._id }
        );
      } catch (notifErr) {
        console.error("Reward notification failed:", notifErr.message);
      }
    }

    res.status(201).json({ message: "Reward added successfully", reward });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get All Rewards (only own rewards)
export const getAllRewardsAdmin = async (req, res) => {
  try {
    const rewards = await Reward.find({ adminId: req.admin.id }).sort({ pointsRequired: 1 });
    res.json({ rewards, count: rewards.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Update Reward
export const updateReward = async (req, res) => {
  try {
    const { rewardName, rewardImage, pointsRequired, description, isActive } = req.body;

    const updates = {};
    if (rewardName) updates.rewardName = rewardName;
    if (pointsRequired) updates.pointsRequired = pointsRequired;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    // Handle uploaded images
    const uploadedImages = req.files ? req.files.map((f) => f.path) : [];
    if (uploadedImages.length > 0) {
      updates.rewardImages = uploadedImages;
      updates.rewardImage = uploadedImages[0];
    } else if (rewardImage !== undefined) {
      updates.rewardImage = rewardImage;
      if (rewardImage) updates.rewardImages = [rewardImage];
    }

    const reward = await Reward.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!reward) return res.status(404).json({ message: "Reward not found" });

    res.json({ message: "Reward updated successfully", reward });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Toggle Reward Active Status
export const toggleRewardStatus = async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) return res.status(404).json({ message: "Reward not found" });
    reward.isActive = !reward.isActive;
    await reward.save();
    res.json({ message: "Status updated", reward });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Delete Reward
export const deleteReward = async (req, res) => {
  try {
    const reward = await Reward.findByIdAndDelete(req.params.id);
    if (!reward) {
      return res.status(404).json({ message: "Reward not found" });
    }
    res.json({ message: "Reward deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User: Get All Active Rewards (only from their shop's admin)
export const getAllRewardsUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select("shopId");
    if (!user) return res.status(404).json({ message: "User not found" });

    const admin = await Admin.findOne({ shopId: user.shopId }).select("_id");

    const filter = { isActive: true };
    if (admin) filter.adminId = admin._id;

    const rewards = await Reward.find(filter).populate("adminId", "name").sort({ pointsRequired: 1 });
    res.json({ rewards, count: rewards.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User: Apply for Reward Redemption
export const applyRedemption = async (req, res) => {
  try {
    const { rewardId } = req.body;

    const reward = await Reward.findById(rewardId);
    if (!reward) {
      return res.status(404).json({ message: "Reward not found" });
    }

    if (!reward.isActive) {
      return res.status(400).json({ message: "Reward is not active" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.walletPoints < reward.pointsRequired) {
      return res.status(400).json({
        message: "Insufficient points",
        required: reward.pointsRequired,
        available: user.walletPoints,
      });
    }

    const redemption = await Redemption.create({
      userId: req.user.sub,
      rewardId,
      pointsUsed: reward.pointsRequired,
    });

    res.status(201).json({
      message: "Redemption request submitted successfully",
      redemption,
    });

    // Notify all admins of the shop
    try {
      const admins = await Admin.find({ shopId: user.shopId });
      const adminTokens = admins.map(a => a.fcmToken).filter(t => !!t);
      if (adminTokens.length > 0) {
        const { sendMulticastNotification } = await import("../utils/notification.js");
        await sendMulticastNotification(
          adminTokens,
          "🎁 New Redemption Request",
          `${user.name} wants to redeem ${reward.rewardName}.`
        );
      }
    } catch (_) {}

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User: Get My Redemptions
export const getMyRedemptions = async (req, res) => {
  try {
    const redemptions = await Redemption.find({ userId: req.user.sub })
      .populate("rewardId")
      .sort({ createdAt: -1 });

    res.json({ redemptions, count: redemptions.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get All Redemptions (Shop Isolation)
export const getAllRedemptions = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Isolation: Only find redemptions from users in this admin's shop
    const usersInShop = await User.find({ shopId: req.admin.shopId }).select('_id');
    const userIds = usersInShop.map(u => u._id);

    const filter = { userId: { $in: userIds } };
    if (status) filter.status = status;

    const redemptions = await Redemption.find(filter)
      .populate("userId", "name email mobile walletPoints")
      .populate("rewardId")
      .sort({ createdAt: -1 });

    res.json({ redemptions, count: redemptions.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get Single Redemption Detail
export const getRedemptionDetail = async (req, res) => {
  try {
    const redemption = await Redemption.findById(req.params.id)
      .populate("userId", "name email mobile walletPoints")
      .populate("rewardId");

    if (!redemption) {
      return res.status(404).json({ message: "Redemption not found" });
    }

    res.json({ redemption });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Approve Redemption
export const approveRedemption = async (req, res) => {
  try {
    const redemption = await Redemption.findById(req.params.id).populate(
      "rewardId"
    );

    if (!redemption) {
      return res.status(404).json({ message: "Redemption not found" });
    }

    if (redemption.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Redemption is already ${redemption.status}` });
    }

    // Re-fetch fresh user points to prevent race condition
    const freshUser = await User.findById(redemption.userId);
    if (!freshUser) return res.status(404).json({ message: "User not found" });

    if (freshUser.walletPoints < redemption.pointsUsed) {
      return res.status(400).json({
        message: `User has insufficient points (available: ${freshUser.walletPoints}, required: ${redemption.pointsUsed})`,
        required: redemption.pointsUsed,
        available: freshUser.walletPoints,
      });
    }

    // Atomically deduct points — only if still sufficient
    const updatedUser = await User.findOneAndUpdate(
      { _id: redemption.userId, walletPoints: { $gte: redemption.pointsUsed } },
      { $inc: { walletPoints: -redemption.pointsUsed } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ message: "User has insufficient points" });
    }

    // Update redemption status
    redemption.status = "approved";
    redemption.approvedBy = req.admin.id;
    redemption.approvedAt = new Date();
    await redemption.save();

    // Send push notification to user (non-blocking)
    try {
      if (updatedUser.fcmToken) {
        await sendPushNotification(
          updatedUser.fcmToken,
          "🎊 Redemption Approved!",
          `Your request for ${redemption.rewardId.rewardName} has been approved! Enjoy your reward.`
        );
      }

      await Notification.create({
        recipientType: "user",
        recipientId: redemption.userId,
        recipientModel: "User",
        title: "🎊 Redemption Approved!",
        message: `Your request for ${redemption.rewardId.rewardName} has been approved!`,
        type: "reward",
        metadata: { redemptionId: redemption._id, rewardId: redemption.rewardId._id }
      });
    } catch (_) {}

    res.json({
      message: "Redemption approved successfully",
      redemption,
      remainingPoints: updatedUser.walletPoints,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Reject Redemption
export const rejectRedemption = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const redemption = await Redemption.findById(req.params.id);

    if (!redemption) {
      return res.status(404).json({ message: "Redemption not found" });
    }

    if (redemption.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Redemption is already ${redemption.status}` });
    }

    redemption.status = "rejected";
    redemption.rejectionReason = rejectionReason || "Not specified";
    redemption.approvedBy = req.admin.id;
    redemption.approvedAt = new Date();
    await redemption.save();

    // Send push notification to user (non-blocking)
    try {
      const user = await User.findById(redemption.userId);
      if (user && user.fcmToken) {
        await sendPushNotification(
          user.fcmToken,
          "❌ Redemption Rejected",
          `Sorry, your request for ${redemption.rewardId?.rewardName || 'reward'} was rejected. Reason: ${redemption.rejectionReason}`
        );
      }

      await Notification.create({
        recipientType: "user",
        recipientId: redemption.userId,
        recipientModel: "User",
        title: "❌ Redemption Rejected",
        message: `Your reward request was rejected. Reason: ${redemption.rejectionReason}`,
        type: "reward"
      });
    } catch (_) {}

    res.json({
      message: "Redemption rejected successfully",
      redemption,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Mark Redemption as Delivered
export const deliverRedemption = async (req, res) => {
  try {
    const redemption = await Redemption.findById(req.params.id);

    if (!redemption) {
      return res.status(404).json({ message: "Redemption not found" });
    }

    if (redemption.status !== "approved") {
      return res
        .status(400)
        .json({ message: "Only approved redemptions can be marked as delivered" });
    }

    redemption.status = "delivered";
    await redemption.save();

    // Send push notification to user
    const user = await User.findById(redemption.userId);
    if (user && user.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        "📦 Reward Delivered!",
        `Great news! Your reward has been marked as delivered. Thank you for being a loyal customer!`
      );
    }

    res.json({
      message: "Redemption marked as delivered",
      redemption,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// User: Withdraw Redemption Request
export const withdrawRedemption = async (req, res) => {
  try {
    const redemption = await Redemption.findOne({
      _id: req.params.id,
      userId: req.user.sub,
    });

    if (!redemption) {
      return res.status(404).json({ message: "Redemption request not found" });
    }

    if (redemption.status !== "pending") {
      return res.status(400).json({ 
        message: `Cannot withdraw a redemption that is already ${redemption.status}` 
      });
    }

    redemption.status = "cancelled";
    await redemption.save();

    res.json({ message: "Redemption request withdrawn successfully", redemption });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
