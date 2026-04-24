import "dotenv/config";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Admin from "./models/Admin.js";
import Bill from "./models/Bill.js";
import Notification from "./models/Notification.js";
import Redemption from "./models/Redemption.js";
import Reward from "./models/Reward.js";
import AdminSubscription from "./models/AdminSubscription.js";
import PointSetting from "./models/PointSetting.js";

await connectDB();

await User.deleteMany({});
await Admin.deleteMany({});
await Bill.deleteMany({});
await Notification.deleteMany({});
await Redemption.deleteMany({});
await Reward.deleteMany({});
await AdminSubscription.deleteMany({});
await PointSetting.deleteMany({});

console.log("✅ Database cleared — SuperAdmin data preserved.");
process.exit(0);
