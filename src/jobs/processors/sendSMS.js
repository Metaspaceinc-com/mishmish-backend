// src/jobs/processors/sendSMS.js
const { getDatabase } = require('../../database/connection')

module.exports = async function (job) {
    const { notification_id, phone_number, recipient_type } = job.data
    const db = getDatabase()

    try {
        // Get notification details
        const { data: notification } = await db
            .from('notification')
            .select('*')
            .eq('id', notification_id)
            .single()

        if (!notification) {
            throw new Error('Notification not found')
        }

        // Simulate SMS sending (replace with actual SMS service like Twilio)
        console.log(`Sending SMS to ${phone_number}: ${notification.message}`)

        // In production, integrate with SMS provider:
        // const twilio = require('twilio')(accountSid, authToken);
        // await twilio.messages.create({
        //   body: notification.message,
        //   from: process.env.TWILIO_PHONE_NUMBER,
        //   to: phone_number
        // });

        // Update notification status
        await db
            .from('notification')
            .update({
                channel: 'sms',
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', notification_id)

        return { success: true, channel: 'sms' }

    } catch (error) {
        console.error(`SMS sending failed for notification ${notification_id}:`, error)

        // Update notification status as failed
        await db
            .from('notification')
            .update({
                channel: 'sms',
                status: 'failed',
                sent_at: new Date().toISOString()
            })
            .eq('id', notification_id)

        throw error
    }
}