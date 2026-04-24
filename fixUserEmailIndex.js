import "dotenv/config";
import connectDB from "./config/db.js";
import mongoose from "mongoose";

await connectDB();

try {
  await mongoose.connection.collection("users").dropIndex("email_1");
  console.log("✅ Dropped email_1 unique index");
} catch (e) {
  console.log("⚠️ email_1 index not found or already dropped:", e.message);
}

try {
  await mongoose.connection.collection("users").dropIndex("mobile_1_shopId_1");
  console.log("✅ Dropped mobile_1_shopId_1 index");
} catch (e) {
  console.log("⚠️ mobile_1_shopId_1 index not found:", e.message);
}

console.log("✅ Done. Restart server to recreate correct indexes.");
process.exit(0);
