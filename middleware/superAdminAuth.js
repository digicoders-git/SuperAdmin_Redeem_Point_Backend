import jwt from "jsonwebtoken";
import SuperAdmin from "../models/SuperAdmin.js";

export const authenticateSuperAdmin = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: "SuperAdmin token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "superadmin") return res.status(403).json({ message: "Not a superadmin token" });

    const sa = await SuperAdmin.findById(decoded.sub).select("+tokenVersion");
    if (!sa) return res.status(401).json({ message: "SuperAdmin not found" });
    if (sa.tokenVersion !== decoded.tv) return res.status(401).json({ message: "Token expired" });

    req.superAdmin = { id: sa._id.toString(), username: sa.username };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
