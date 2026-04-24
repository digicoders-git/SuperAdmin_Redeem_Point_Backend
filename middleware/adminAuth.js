import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import AdminSubscription from "../models/AdminSubscription.js";

const JWT_SECRET = process.env.JWT_SECRET;

// Authenticate admin without subscription check (for subscription-related endpoints)
export const authenticateAdminOnly = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Admin token missing" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.sub).select("+tokenVersion +shopId");

    if (!admin) return res.status(401).json({ message: "Invalid admin token" });
    if ((admin.tokenVersion ?? 0) !== (decoded.tv ?? 0)) return res.status(401).json({ message: "Token expired, please login again" });

    req.admin = { id: admin._id.toString(), adminId: admin.adminId, name: admin.name, shopId: admin.shopId };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const authenticateAdmin = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Admin token missing" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.sub).select("+tokenVersion +shopId");

    if (!admin) return res.status(401).json({ message: "Invalid admin token" });
    if ((admin.tokenVersion ?? 0) !== (decoded.tv ?? 0)) return res.status(401).json({ message: "Token expired, please login again" });

    req.admin = { id: admin._id.toString(), adminId: admin.adminId, name: admin.name, shopId: admin.shopId };
    
    // Check subscription
    const sub = await AdminSubscription.findOne({ adminId: req.admin.id, status: "active" });
    if (!sub) return res.status(403).json({ message: "subscription_required", code: "NO_SUBSCRIPTION" });
    
    // Auto-expire and activate next
    if (sub.endDate < new Date()) {
      sub.status = "expired";
      await sub.save();
      
      // Try to activate next pending subscription
      const nextSub = await AdminSubscription.findOne({ adminId: req.admin.id, status: "pending" })
        .sort({ createdAt: 1 });
      
      if (nextSub) {
        const now = new Date();
        nextSub.startDate = now;
        
        if (nextSub.billingType === "monthly") {
          nextSub.endDate = new Date(now.setMonth(now.getMonth() + 1));
        } else if (nextSub.billingType === "annual") {
          nextSub.endDate = new Date(now.setFullYear(now.getFullYear() + 1));
        }
        
        nextSub.status = "active";
        await nextSub.save();
        
        // Continue with newly activated subscription
        return next();
      }
      
      return res.status(403).json({ message: "subscription_expired", code: "SUBSCRIPTION_EXPIRED" });
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Subscription check — use after authenticateAdmin on protected routes
export const checkSubscription = async (req, res, next) => {
  try {
    const sub = await AdminSubscription.findOne({ adminId: req.admin.id });

    if (!sub) return res.status(403).json({ message: "subscription_required", code: "NO_SUBSCRIPTION" });

    // auto-expire
    if (sub.status === "active" && sub.endDate < new Date()) {
      sub.status = "expired";
      await sub.save();
    }

    if (sub.status !== "active") {
      return res.status(403).json({ message: "subscription_expired", code: "SUBSCRIPTION_EXPIRED" });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
