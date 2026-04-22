import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const superAdminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

superAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

superAdminSchema.methods.comparePassword = async function (pwd) {
  return bcrypt.compare(pwd, this.password);
};

export default mongoose.model("SuperAdmin", superAdminSchema);
