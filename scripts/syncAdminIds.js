import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";

dotenv.config();

const syncAdminIds = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const admins = await Admin.find({ mobile: { $exists: true, $ne: null } });
    console.log(`Found ${admins.length} admins to check`);

    let updatedCount = 0;
    for (const admin of admins) {
      if (admin.adminId !== admin.mobile) {
        console.log(`Updating Admin: ${admin.name || admin._id} | Old ID: ${admin.adminId} -> New ID: ${admin.mobile}`);
        admin.adminId = admin.mobile;
        await admin.save();
        updatedCount++;
      }
    }

    console.log(`Finished. Updated ${updatedCount} admins.`);
    process.exit(0);
  } catch (error) {
    console.error("Error syncing admin IDs:", error);
    process.exit(1);
  }
};

syncAdminIds();
