import admin from "../config/firebase.js";

/**
 * Send a push notification to a specific device token
 * @param {string} token - The FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Optional data payload
 */
export const sendPushNotification = async (token, title, body, data = {}) => {
  if (!token) {
    console.warn("No device token provided for notification");
    return null;
  }

  const message = {
    notification: {
      title,
      body,
    },
    data,
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent push notification:", response);
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error);
    throw error;
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
  if (!tokens || tokens.length === 0) {
    console.warn("No device tokens provided for multicast notification");
    return null;
  }

  const message = {
    notification: {
      title,
      body,
    },
    data,
    tokens: tokens.filter(t => !!t), // Filter out empty tokens
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} messages were sent successfully`);
    return response;
  } catch (error) {
    console.error("Error sending multicast notification:", error);
    throw error;
  }
};
