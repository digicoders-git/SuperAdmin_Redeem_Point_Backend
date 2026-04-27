import SubscriptionPlan from "../models/SubscriptionPlan.js";
import AdminSubscription from "../models/AdminSubscription.js";
import Admin from "../models/Admin.js";
import SystemSettings from "../models/SystemSettings.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── SYSTEM SETTINGS ────────────────────────────────

export const getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ freeTrialDays: 7 });
    }
    res.json({ settings });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const { freeTrialDays, supportPhone } = req.body;
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ freeTrialDays, supportPhone });
    } else {
      if (freeTrialDays !== undefined) settings.freeTrialDays = freeTrialDays;
      if (supportPhone !== undefined) settings.supportPhone = supportPhone;
      await settings.save();
    }
    res.json({ message: "Settings updated", settings });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── HELPER: Activate next pending subscription ─────

const activateNextSubscription = async (adminId) => {
  const nextSub = await AdminSubscription.findOne({ adminId, status: "pending" })
    .sort({ createdAt: 1 })
    .populate("planId");
  
  if (nextSub) {
    const startDate = new Date();
    const endDate = new Date();
    
    if (nextSub.billingType === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (nextSub.billingType === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    nextSub.startDate = startDate;
    nextSub.endDate = endDate;
    nextSub.status = "active";
    await nextSub.save();
  }
};

// ── PLANS ──────────────────────────────────────────

export const createPlan = async (req, res) => {
  try {
    const { name, description, monthlyPrice, annualPrice, features } = req.body;
    if (!name || annualPrice === undefined)
      return res.status(400).json({ message: "name and annualPrice are required" });
    const plan = await SubscriptionPlan.create({ name, description, monthlyPrice: monthlyPrice || 0, annualPrice, features: features || [] });
    res.status(201).json({ message: "Plan created", plan });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: -1 });
    res.json({ plans });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan updated", plan });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const deletePlan = async (req, res) => {
  try {
    await SubscriptionPlan.findByIdAndDelete(req.params.id);
    res.json({ message: "Plan deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SUBSCRIPTIONS (SuperAdmin) ─────────────────────

export const assignSubscription = async (req, res) => {
  try {
    const { adminId, planId, billingType } = req.body;
    if (!adminId || !planId || !billingType)
      return res.status(400).json({ message: "adminId, planId and billingType are required" });

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Check if admin has active subscription
    const activeSub = await AdminSubscription.findOne({ adminId, status: "active" });
    
    if (activeSub) {
      // Add to queue as pending
      await AdminSubscription.create({
        adminId,
        planId,
        billingType,
        startDate: new Date(),
        endDate: new Date(),
        status: "pending",
        assignedBy: "superadmin",
      });
      return res.json({ message: "Plan added to queue. Will activate after current plan expires." });
    }

    // No active subscription, activate immediately
    const startDate = new Date();
    const endDate = new Date();
    
    if (billingType === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billingType === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const subscription = await AdminSubscription.create({
      adminId,
      planId,
      billingType,
      startDate,
      endDate,
      status: "active",
      assignedBy: "superadmin",
    });

    res.json({ message: "Subscription assigned and activated", subscription });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const subs = await AdminSubscription.find()
      .populate("adminId", "adminId name shopId")
      .populate("planId", "name monthlyPrice annualPrice")
      .sort({ createdAt: -1 });

    // auto-expire and activate next
    const now = new Date();
    for (const s of subs) {
      if (s.status === "active" && s.endDate < now) {
        s.status = "expired";
        await s.save();
        await activateNextSubscription(s.adminId._id);
      }
    }

    res.json({ subscriptions: subs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const cancelSubscription = async (req, res) => {
  try {
    const sub = await AdminSubscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    
    const wasActive = sub.status === "active";
    
    sub.status = "cancelled";
    await sub.save();
    
    // If cancelled subscription was active, activate next pending subscription
    if (wasActive) {
      await activateNextSubscription(sub.adminId);
    }
    
    res.json({ message: "Subscription cancelled", sub });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── ADMIN: get own subscription ────────────────────

export const getMySubscription = async (req, res) => {
  try {
    let activeSub = await AdminSubscription.findOne({ adminId: req.admin.id, status: "active" })
      .populate("planId");

    let pendingSubs = await AdminSubscription.find({ adminId: req.admin.id, status: "pending" })
      .populate("planId")
      .sort({ createdAt: 1 });

    // auto-expire check
    if (activeSub && activeSub.endDate < new Date()) {
      activeSub.status = "expired";
      await activeSub.save();
      await activateNextSubscription(req.admin.id);
      
      // Fetch newly activated subscription
      activeSub = await AdminSubscription.findOne({ adminId: req.admin.id, status: "active" })
        .populate("planId");
      pendingSubs = await AdminSubscription.find({ adminId: req.admin.id, status: "pending" })
        .populate("planId")
        .sort({ createdAt: 1 });
    }

    // If no active subscription but pending subscriptions exist, activate the first one
    if (!activeSub && pendingSubs.length > 0) {
      await activateNextSubscription(req.admin.id);
      
      // Fetch newly activated subscription
      activeSub = await AdminSubscription.findOne({ adminId: req.admin.id, status: "active" })
        .populate("planId");
      pendingSubs = await AdminSubscription.find({ adminId: req.admin.id, status: "pending" })
        .populate("planId")
        .sort({ createdAt: 1 });
    }

    res.json({ subscription: activeSub, pendingSubscriptions: pendingSubs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── ADMIN: Claim Free Trial (if eligible) ─────────

export const claimFreeTrial = async (req, res) => {
  try {
    console.log("claimFreeTrial - admin:", req.admin);
    
    const existingSub = await AdminSubscription.findOne({ 
      adminId: req.admin.id,
      status: { $in: ["active", "pending"] }
    });
    
    console.log("existingSub:", existingSub);
    
    if (existingSub) {
      return res.status(400).json({ 
        message: "You already have an active or pending subscription",
        eligible: false 
      });
    }

    const previousTrial = await AdminSubscription.findOne({ 
      adminId: req.admin.id,
      billingType: "free_trial"
    });
    
    console.log("previousTrial:", previousTrial);
    
    if (previousTrial) {
      return res.status(400).json({ 
        message: "Free trial already claimed. Please purchase a plan.",
        eligible: false 
      });
    }

    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ freeTrialDays: 7 });
    }
    
    console.log("settings:", settings);

    const days = settings?.freeTrialDays ?? 7;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const subscription = await AdminSubscription.create({
      adminId: req.admin.id,
      planId: null,
      billingType: "free_trial",
      startDate: new Date(),
      endDate,
      status: "active",
      assignedBy: "system",
    });
    
    console.log("subscription created:", subscription);

    res.json({ 
      message: "Free trial activated successfully!",
      subscription,
      eligible: true 
    });
  } catch (err) {
    console.error("claimFreeTrial error:", err);
    res.status(500).json({ message: err.message }); 
  }
};

// ── ADMIN: Purchase Plan (Razorpay) ───────────────

export const createOrder = async (req, res) => {
  try {
    const { planId, billingType } = req.body;
    if (!planId || !billingType) return res.status(400).json({ message: "planId and billingType required" });

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const amount = billingType === "annual" ? plan.annualPrice : plan.monthlyPrice;
    
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
    });

    res.json({ order, plan, billingType });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingType } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Payment verified, add subscription to queue or activate
    const activeSub = await AdminSubscription.findOne({ adminId: req.admin.id, status: "active" });
    
    if (activeSub) {
      // Add to queue
      await AdminSubscription.create({
        adminId: req.admin.id,
        planId,
        billingType,
        startDate: new Date(),
        endDate: new Date(),
        status: "pending",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        assignedBy: "self_purchase",
      });
      return res.json({ message: "Payment successful! Plan added to queue.", queued: true });
    }

    // No active subscription, activate immediately
    const startDate = new Date();
    const endDate = new Date();
    
    if (billingType === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billingType === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    await AdminSubscription.create({
      adminId: req.admin.id,
      planId,
      billingType,
      startDate,
      endDate,
      status: "active",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      assignedBy: "self_purchase",
    });

    res.json({ message: "Payment successful! Plan activated.", queued: false });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
