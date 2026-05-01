import "dotenv/config";
import mongoose from "mongoose";
import Admin from "./models/Admin.js";

await mongoose.connect(process.env.MONGO_URI);

const result = await Admin.updateMany(
  { profilePhoto: /^https:\/\/api\.inaamify\.com\/admin-photos\// },
  [{ $set: { profilePhoto: { $replaceAll: { input: "$profilePhoto", find: "/admin-photos/", replacement: "/uploads/admin-photos/" } } } }]
);

console.log(`✅ Fixed ${result.modifiedCount} admin profile photo URLs`);
await mongoose.disconnect();
