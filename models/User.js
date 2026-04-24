import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    mobile: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    walletPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    shopId: {
      type: String,
      default: "",
    },
    fcmToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index: same mobile can register with different shops, but not same mobile + same shop
userSchema.index({ mobile: 1, shopId: 1 }, { unique: true });

userSchema.pre("save", async function (next) {
  if (this.isModified("name") && this.name) {
    this.name = this.name.trim().replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
