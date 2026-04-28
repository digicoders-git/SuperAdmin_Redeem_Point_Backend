import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    freeTrialDays: { type: Number, default: 14, min: 0 },
    supportPhone: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("SystemSettings", systemSettingsSchema);
