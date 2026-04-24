import admin from "firebase-admin";

if (admin.apps.length === 0) {
  try {
    let serviceAccount = null;

    // Try env variable first (Render/production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Try file (local dev)
      try {
        const { readFile } = await import("fs/promises");
        const { fileURLToPath } = await import("url");
        const { dirname, join } = await import("path");
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const raw = await readFile(join(__dirname, "serviceAccountKey.json"), "utf-8");
        serviceAccount = JSON.parse(raw);
      } catch (_) {
        // file missing or invalid — skip
      }
    }

    if (serviceAccount && serviceAccount.project_id) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log("✅ Firebase Admin initialized");
    } else {
      console.warn("⚠️ Firebase Admin skipped — push notifications disabled");
    }
  } catch (err) {
    console.warn("⚠️ Firebase Admin skipped:", err.message);
  }
}

export default admin;
