import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true, unique: true, index: true },
    password: { type: String, select: false },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    mobile: { type: String, unique: true, sparse: true },
    name: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    shopId: { type: String, unique: true, sparse: true },
    shopName: { type: String, default: "" },
    needsProfileSetup: { type: Boolean, default: true },
    referralCode: { type: String, unique: true, sparse: true },
    tokenVersion: { type: Number, default: 0, select: false },
    termsAndConditions: [{ type: String }],
    fcmToken: { type: String, default: null },

    // IST timestamps
    createdAtIST: { type: String },
    updatedAtIST: { type: String },
  },
  { timestamps: true }
);

// Auto-save IST time on create
adminSchema.pre("save", function (next) {
  if (this.isModified("name") && this.name) {
    this.name = this.name.trim().replace(/\b\w/g, c => c.toUpperCase());
  }
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.createdAtIST = istTime;
  this.updatedAtIST = istTime;
  next();
});

// Auto-update IST time when updated
adminSchema.pre("findOneAndUpdate", function (next) {
  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });

  this.set({ updatedAtIST: istTime });
  next();
});

export default mongoose.model("Admin", adminSchema);
