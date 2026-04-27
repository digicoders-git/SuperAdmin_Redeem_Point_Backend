import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import { sendPushNotification, sendMulticastNotification } from "../utils/notification.js";

// Helper: Create notification for shop users
export const notifyShopUsers = async (shopId, title, message, type = "custom", metadata = {}) => {
  try {
    const users = await User.find({ shopId, isActive: true });
    const tokens = users.map(u => u.fcmToken).filter(t => !!t);
    
    const notifications = users.map(user => ({
      recipientType: "user",
      recipientId: user._id,
      recipientModel: "User",
      shopId,
      title,
      message,
      type,
      metadata,
      sentBy: "system",
    }));
    
    await Notification.insertMany(notifications);

    // Send push notifications
    if (tokens.length > 0) {
      await sendMulticastNotification(tokens, title, message, metadata);
    }
  } catch (error) {
    console.error("Error notifying shop users:", error);
  }
};

// SuperAdmin: Delete notification batch (same title+message sent together)
export const deleteSuperAdminNotificationBatch = async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ message: "title and message required" });
    await Notification.deleteMany({ sentBy: "superadmin", title, message });
    res.json({ message: "Notification batch deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SuperAdmin: Get sent notification history
export const getSuperAdminNotificationHistory = async (req, res) => {
  try {
    const notifications = await Notification.find({ sentBy: "superadmin" })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SuperAdmin: Send custom notification
export const sendNotification = async (req, res) => {
  try {
    const { recipientType, recipientId, shopId, title, message, type } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    let notifications = [];
    let pushTokens = [];

    if (recipientType === "all_admins") {
      const admins = await Admin.find();
      pushTokens = admins.map(a => a.fcmToken).filter(t => !!t);
      notifications = admins.map(admin => ({
        recipientType: "admin",
        recipientId: admin._id,
        recipientModel: "Admin",
        title,
        message,
        type: type || "announcement",
        sentBy: "superadmin",
        sentById: req.superadmin?.id,
      }));
    } else if (recipientType === "all_users") {
      const users = await User.find({ isActive: true });
      pushTokens = users.map(u => u.fcmToken).filter(t => !!t);
      notifications = users.map(user => ({
        recipientType: "user",
        recipientId: user._id,
        recipientModel: "User",
        shopId: user.shopId,
        title,
        message,
        type: type || "announcement",
        sentBy: "superadmin",
        sentById: req.superadmin?.id,
      }));
    } else if (recipientType === "shop_users" && shopId) {
      const users = await User.find({ shopId, isActive: true });
      pushTokens = users.map(u => u.fcmToken).filter(t => !!t);
      notifications = users.map(user => ({
        recipientType: "user",
        recipientId: user._id,
        recipientModel: "User",
        shopId,
        title,
        message,
        type: type || "announcement",
        sentBy: "superadmin",
        sentById: req.superadmin?.id,
      }));
    } else if (recipientType === "admin" && recipientId) {
      const admin = await Admin.findById(recipientId);
      if (admin && admin.fcmToken) pushTokens = [admin.fcmToken];
      notifications = [{
        recipientType: "admin",
        recipientId,
        recipientModel: "Admin",
        title,
        message,
        type: type || "custom",
        sentBy: "superadmin",
        sentById: req.superadmin?.id,
      }];
    } else if (recipientType === "user" && recipientId) {
      const user = await User.findById(recipientId);
      if (user && user.fcmToken) pushTokens = [user.fcmToken];
      notifications = [{
        recipientType: "user",
        recipientId,
        recipientModel: "User",
        shopId: user?.shopId,
        title,
        message,
        type: type || "custom",
        sentBy: "superadmin",
        sentById: req.superadmin?.id,
      }];
    } else {
      return res.status(400).json({ message: "Invalid recipient configuration" });
    }

    await Notification.insertMany(notifications);

    // Send Push Notifications
    if (pushTokens.length > 0) {
      if (pushTokens.length === 1) {
        await sendPushNotification(pushTokens[0], title, message);
      } else {
        await sendMulticastNotification(pushTokens, title, message);
      }
    }

    res.json({ message: "Notification sent successfully", count: notifications.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get own notifications
export const getAdminNotifications = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const notifications = await Notification.find({
      $or: [
        { recipientId: req.admin.id, recipientType: "admin" },
        { 
          recipientType: "all_admins",
          createdAt: { $gte: admin.createdAt }
        }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      $or: [
        { recipientId: req.admin.id, recipientType: "admin" },
        { 
          recipientType: "all_admins",
          createdAt: { $gte: admin.createdAt }
        }
      ],
      isRead: false
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User: Get own notifications
export const getUserNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const notifications = await Notification.find({
      $or: [
        { recipientId: req.user.sub, recipientType: "user" },
        { 
          $or: [
            { shopId: user.shopId, recipientType: "user" },
            { recipientType: "all_users" }
          ],
          createdAt: { $gte: user.createdAt }
        }
      ]
    })
      .populate("metadata.rewardId", "rewardName rewardImages pointsRequired")
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      $or: [
        { recipientId: req.user.sub, recipientType: "user" },
        { 
          $or: [
            { shopId: user.shopId, recipientType: "user" },
            { recipientType: "all_users" }
          ],
          createdAt: { $gte: user.createdAt }
        }
      ],
      isRead: false
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Marked as read", notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    let filter = {};
    
    if (req.admin) {
      filter = {
        $or: [
          { recipientId: req.admin.id, recipientType: "admin" },
          { recipientType: "all_admins" }
        ]
      };
    } else if (req.user) {
      const user = await User.findById(req.user.sub);
      filter = {
        $or: [
          { recipientId: req.user.sub, recipientType: "user" },
          { shopId: user?.shopId, recipientType: "user" },
          { recipientType: "all_users" }
        ]
      };
    }

    await Notification.updateMany(filter, { isRead: true });
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
