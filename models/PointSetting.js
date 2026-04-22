import mongoose from "mongoose";

const pointSettingSchema = new mongoose.Schema(
  {
    amountPerPoint: {
      type: Number,
      required: true,
      default: 100, // 100 rupees = 1 point
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Tier thresholds
    bronzeThreshold: {
      type: Number,
      default: 0,
    },
    silverThreshold: {
      type: Number,
      default: 500,
    },
    goldThreshold: {
      type: Number,
      default: 2000,
    },
    platinumThreshold: {
      type: Number,
      default: 5000,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PointSetting", pointSettingSchema);
