import admin from "firebase-admin";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, "serviceAccountKey.json");

let serviceAccount;
try {
  const fileContent = await readFile(serviceAccountPath, "utf-8");
  serviceAccount = JSON.parse(fileContent);
} catch (error) {
  console.error("Error reading serviceAccountKey.json:", error.message);
}

if (admin.apps.length === 0) {
  if (serviceAccount && serviceAccount.project_id && serviceAccount.project_id !== "YOUR_PROJECT_ID") {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin initialized successfully");
    } catch (err) {
      console.error("Firebase Admin init failed:", err.message);
    }
  } else {
    console.warn("Firebase Admin NOT initialized: Please provide valid serviceAccountKey.json");
  }
}

export default admin;
