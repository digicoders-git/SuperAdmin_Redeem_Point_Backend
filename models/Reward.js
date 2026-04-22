import mongoose from "mongoose";

const rewardSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    rewardName: {
      type: String,
      required: true,
      trim: true,
    },
    rewardImage: {
      type: String,
      default: "",
    },
    rewardImages: {
      type: [String],
      default: [],
    },
    pointsRequired: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Reward", rewardSchema);
