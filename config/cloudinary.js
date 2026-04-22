import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Cloudinary environment variables are missing!");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const billStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "redeem_bills",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
});

export const uploadBillFile = multer({
  storage: billStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
}).single("billFile");

const rewardStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "redeem_rewards",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

export const uploadRewardImages = multer({
  storage: rewardStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).array("rewardImages", 5);

const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "redeem_profiles",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  },
});

export const uploadProfilePhoto = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("profilePhoto");

export { cloudinary };
