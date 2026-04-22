import TermsCondition from "../models/TermsCondition.js";

const DEFAULT_TERMS = [
  "Points are earned on every approved bill submission.",
  "Points can be redeemed for rewards available in the catalog.",
  "Redemption requests are subject to admin approval.",
  "Cable Sansar reserves the right to modify point values at any time.",
  "Points have no cash value and cannot be transferred.",
  "Fraudulent bill submissions will result in account deactivation.",
];

// Seed defaults if collection is empty
export const seedTerms = async () => {
  const count = await TermsCondition.countDocuments();
  if (count === 0) {
    await TermsCondition.insertMany(
      DEFAULT_TERMS.map((text, i) => ({ text, order: i + 1 }))
    );
    console.log("✅ Default terms seeded");
  }
};

// Public: Get all active terms
export const getTerms = async (req, res) => {
  try {
    const terms = await TermsCondition.find({ isActive: true }).sort({ order: 1 });
    res.json({ terms });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all terms (including inactive)
export const getAllTermsAdmin = async (req, res) => {
  try {
    const terms = await TermsCondition.find().sort({ order: 1 });
    res.json({ terms });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Add term
export const addTerm = async (req, res) => {
  try {
    const { text, order } = req.body;
    if (!text) return res.status(400).json({ message: "text is required" });
    const lastTerm = await TermsCondition.findOne().sort({ order: -1 });
    const term = await TermsCondition.create({
      text,
      order: order ?? (lastTerm ? lastTerm.order + 1 : 1),
    });
    res.status(201).json({ message: "Term added", term });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Update term
export const updateTerm = async (req, res) => {
  try {
    const { text, order, isActive } = req.body;
    const updates = {};
    if (text !== undefined) updates.text = text;
    if (order !== undefined) updates.order = order;
    if (isActive !== undefined) updates.isActive = isActive;

    const term = await TermsCondition.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!term) return res.status(404).json({ message: "Term not found" });
    res.json({ message: "Term updated", term });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Delete term
export const deleteTerm = async (req, res) => {
  try {
    const term = await TermsCondition.findByIdAndDelete(req.params.id);
    if (!term) return res.status(404).json({ message: "Term not found" });
    res.json({ message: "Term deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
