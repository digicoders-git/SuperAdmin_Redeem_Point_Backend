import mongoose from "mongoose";

const adminSubscriptionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan" },
    billingType: { type: String, enum: ["free_trial", "monthly", "annual"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["pending", "active", "expired", "cancelled"], default: "pending" },
    paymentId: { type: String },
    orderId: { type: String },
    assignedBy: { type: String, enum: ["system", "superadmin", "self_purchase"], default: "system" },
  },
  { timestamps: true }
);

adminSubscriptionSchema.index({ adminId: 1, status: 1 });

export default mongoose.model("AdminSubscription", adminSubscriptionSchema);
