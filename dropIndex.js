import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

async function dropIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Access the User collection directly
    const collection = mongoose.connection.collection("users");
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log("Existing indexes:", indexes.map(i => i.name));

    // Check if name_1 index exists
    const hasNameIndex = indexes.some(i => i.name === "name_1" || i.key.name === 1);
    
    if (hasNameIndex) {
      await collection.dropIndex("name_1");
      console.log("Dropped index 'name_1'. Name is no longer required to be unique.");
    } else {
      console.log("Index 'name_1' does not exist. No action needed.");
    }

  } catch (error) {
    if (error.code === 27) {
      console.log("Index not found, continuing...");
    } else {
      console.error("Error:", error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

dropIndex();
