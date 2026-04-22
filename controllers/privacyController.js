import PrivacyPolicy from "../models/PrivacyPolicy.js";

const DEFAULT_PRIVACY = [
  "We collect your name, mobile number, and bill information to operate the rewards program.",
  "Your personal data is used solely for managing your account and processing reward points.",
  "We do not sell, trade, or share your personal information with third parties.",
  "Bill images uploaded by you are stored securely and used only for verification purposes.",
  "You may request deletion of your account and associated data by contacting support.",
  "We use industry-standard security measures to protect your data from unauthorized access.",
  "By using this app, you consent to the collection and use of your information as described in this policy.",
];

export const seedPrivacy = async () => {
  const count = await PrivacyPolicy.countDocuments();
  if (count === 0) {
    await PrivacyPolicy.insertMany(
      DEFAULT_PRIVACY.map((text, i) => ({ text, order: i + 1 }))
    );
    console.log("✅ Default privacy policy seeded");
  }
};

// Public: Get all active points
export const getPrivacy = async (req, res) => {
  try {
    const points = await PrivacyPolicy.find({ isActive: true }).sort({ order: 1 });
    res.json({ points });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all (including inactive)
export const getAllPrivacyAdmin = async (req, res) => {
  try {
    const points = await PrivacyPolicy.find().sort({ order: 1 });
    res.json({ points });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Add
export const addPrivacy = async (req, res) => {
  try {
    const { text, order } = req.body;
    if (!text) return res.status(400).json({ message: "text is required" });
    const last = await PrivacyPolicy.findOne().sort({ order: -1 });
    const point = await PrivacyPolicy.create({
      text,
      order: order ?? (last ? last.order + 1 : 1),
    });
    res.status(201).json({ message: "Point added", point });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Update
export const updatePrivacy = async (req, res) => {
  try {
    const { text, order, isActive } = req.body;
    const updates = {};
    if (text !== undefined) updates.text = text;
    if (order !== undefined) updates.order = order;
    if (isActive !== undefined) updates.isActive = isActive;

    const point = await PrivacyPolicy.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!point) return res.status(404).json({ message: "Point not found" });
    res.json({ message: "Point updated", point });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Delete
export const deletePrivacy = async (req, res) => {
  try {
    const point = await PrivacyPolicy.findByIdAndDelete(req.params.id);
    if (!point) return res.status(404).json({ message: "Point not found" });
    res.json({ message: "Point deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
