// SPDX-License-Identifier: MIT
// SMS service stub for reminders

import { logger } from '../utils/logger.js';

/**
 * Send SMS to phone number
 * @param {string} phone - Phone number (e.g., +91...)
 * @param {string} message - SMS message text
 */
export async function sendSMS(phone, message) {
  logger.info(`SMS to ${phone}: ${message}`);
  // TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
  // For now, just log it
  return { success: true, phone, message };
}
