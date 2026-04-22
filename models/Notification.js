import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ["admin", "user", "all_admins", "all_users"],
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "recipientModel",
    },
    recipientModel: {
      type: String,
      enum: ["Admin", "User"],
    },
    // For targeting specific shop's users
    shopId: {
      type: String,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["reward", "announcement", "system", "custom"],
      default: "custom",
    },
    // Optional metadata
    metadata: {
      rewardId: { type: mongoose.Schema.Types.ObjectId, ref: "Reward" },
      billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
      redemptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Redemption" },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    sentBy: {
      type: String,
      enum: ["system", "superadmin", "admin"],
      default: "system",
    },
    sentById: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ shopId: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
