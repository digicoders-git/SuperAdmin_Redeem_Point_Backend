import admin from "../config/firebase.js";

/**
 * Send a push notification to a specific device token
 * @param {string} token - The FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
export const sendPushNotification = async (token, title, body, data = {}) => {
  if (!token) return null;
  if (!admin.apps.length) {
    console.warn("Firebase not initialized — skipping push notification");
    return null;
  }

  try {
    const response = await admin.messaging().send({
      notification: { title, body },
      data,
      token,
    });
    console.log("Push notification sent:", response);
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error.message);
    return null;
  }
};

/**
 * Send a push notification to multiple device tokens
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
export const sendMulticastNotification = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return null;
  if (!admin.apps.length) {
    console.warn("Firebase not initialized — skipping multicast notification");
    return null;
  }

  try {
    const filtered = tokens.filter(t => !!t);
    if (filtered.length === 0) return null;
    const response = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      data,
      tokens: filtered,
    });
    console.log(`${response.successCount} messages sent successfully`);
    return response;
  } catch (error) {
    console.error("Error sending multicast notification:", error.message);
    return null;
  }
};
