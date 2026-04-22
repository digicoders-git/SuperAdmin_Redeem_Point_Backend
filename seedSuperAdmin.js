import "dotenv/config";
import mongoose from "mongoose";
import SuperAdmin from "./models/SuperAdmin.js";

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ Connected to MongoDB");

await SuperAdmin.deleteMany({});
await SuperAdmin.create({ username: "superadmin", password: "superadmin123" });
console.log("✅ SuperAdmin seeded — username: superadmin, password: superadmin123");

await mongoose.disconnect();
process.exit(0);
