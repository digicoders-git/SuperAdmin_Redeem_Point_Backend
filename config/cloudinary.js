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

import multerLocal from "multer";
import path from "path";
import fs from "fs";

const adminPhotosDir = "uploads/admin-photos";
if (!fs.existsSync(adminPhotosDir)) fs.mkdirSync(adminPhotosDir, { recursive: true });

const profileStorage = multerLocal.diskStorage({
  destination: (_req, _file, cb) => cb(null, adminPhotosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `admin-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

export const uploadProfilePhoto = multerLocal({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpg|jpeg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
}).single("profilePhoto");

export { cloudinary };
