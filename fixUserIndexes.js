import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function fixUserIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("users");

    // Get all indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:", JSON.stringify(indexes, null, 2));

    // Drop the unique mobile index if it exists
    try {
      await collection.dropIndex("mobile_1");
      console.log("✅ Dropped unique mobile_1 index");
    } catch (err) {
      console.log("Index mobile_1 not found or already dropped");
    }

    // Create compound unique index on mobile + shopId
    await collection.createIndex({ mobile: 1, shopId: 1 }, { unique: true });
    console.log("✅ Created compound unique index on mobile + shopId");

    console.log("\n✅ User indexes fixed successfully!");
    console.log("Now users can register with multiple shops using same mobile number");
    console.log("But cannot register twice with same mobile + same shopId");
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fixUserIndexes();
