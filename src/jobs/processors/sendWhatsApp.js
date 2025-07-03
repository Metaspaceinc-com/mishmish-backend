// =============================================================================
// JOB PROCESSORS
// =============================================================================

// src/jobs/processors/sendWhatsApp.js
const axios = require('axios')
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

        // WhatsApp API integration (example with WhatsApp Business API)
        const whatsappPayload = {
            messaging_product: "whatsapp",
            to: phone_number,
            type: "text",
            text: {
                body: notification.message
            }
        }

        // Send WhatsApp message
        // const response = await axios.post(
        //   `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        //   whatsappPayload,
        //   {
        //     headers: {
        //       'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        //       'Content-Type': 'application/json'
        //     }
        //   }
        // );

        // Simulate successful WhatsApp send
        console.log(`Sending WhatsApp to ${phone_number}: ${notification.message}`)

        // Update notification status
        await db
            .from('notification')
            .update({
                channel: 'whatsapp',
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', notification_id)

        return { success: true, channel: 'whatsapp' }

    } catch (error) {
        console.error(`WhatsApp sending failed for notification ${notification_id}:`, error)

        // Update notification status as failed
        await db
            .from('notification')
            .update({
                channel: 'whatsapp',
                status: 'failed',
                sent_at: new Date().toISOString()
            })
            .eq('id', notification_id)

        throw error
    }
}
