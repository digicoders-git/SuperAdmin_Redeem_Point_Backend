import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function fixIndex() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("adminsubscriptions");

    // Get all indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:", JSON.stringify(indexes, null, 2));

    // Drop the unique adminId index if it exists
    try {
      await collection.dropIndex("adminId_1");
      console.log("✅ Dropped unique adminId_1 index");
    } catch (err) {
      console.log("Index adminId_1 not found or already dropped");
    }

    // Create compound index for adminId and status
    await collection.createIndex({ adminId: 1, status: 1 });
    console.log("✅ Created compound index on adminId and status");

    console.log("\n✅ Index fix completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fixIndex();
