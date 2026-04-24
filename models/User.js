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

// Compound unique index: same email can register with different shops, but not same email + same shop
userSchema.index({ email: 1, shopId: 1 }, { unique: true, sparse: true });
// Keep mobile+shopId index as well for backward compatibility
userSchema.index({ mobile: 1, shopId: 1 }, { unique: true, sparse: true });

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
