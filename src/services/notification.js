// =============================================================================
// NOTIFICATION SERVICE (MULTI-CHANNEL)
// =============================================================================

// src/services/notification.js
const { getDatabase } = require('../database/connection')
const { addJob } = require('../jobs/queue')

class NotificationService {
    async sendOwnerNotification(ownerId, data) {
        const db = getDatabase()

        try {
            // Get owner contact details
            const { data: owner } = await db
                .from('owner')
                .select('phone_number, email, full_name')
                .eq('id', ownerId)
                .single()

            if (!owner) {
                throw new Error('Owner not found')
            }

            // Create notification record
            const { data: notification } = await db
                .from('notification')
                .insert({
                    reservation_id: data.reservation_id,
                    recipient_type: 'owner',
                    recipient_id: ownerId,
                    type: data.type,
                    message: this.generateOwnerMessage(data),
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            // Queue multi-channel delivery
            await this.queueNotificationDelivery(notification.id, owner, 'owner')

            return { success: true, notification_id: notification.id }

        } catch (error) {
            console.error('Send owner notification error:', error)
            throw error
        }
    }

    async sendUserNotification(userId, data) {
        const db = getDatabase()

        try {
            // Get user contact details
            const { data: user } = await db
                .from('users')
                .select('phone_number, email, name')
                .eq('id', userId)
                .single()

            if (!user) {
                throw new Error('User not found')
            }

            // Create notification record
            const { data: notification } = await db
                .from('notification')
                .insert({
                    reservation_id: data.reservation_id,
                    recipient_type: 'user',
                    recipient_id: userId,
                    type: data.type,
                    message: data.message || this.generateUserMessage(data),
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            // Queue multi-channel delivery
            await this.queueNotificationDelivery(notification.id, user, 'user')

            return { success: true, notification_id: notification.id }

        } catch (error) {
            console.error('Send user notification error:', error)
            throw error
        }
    }

    async queueNotificationDelivery(notificationId, recipient, recipientType) {
        // Queue SMS
        await addJob('send-sms', {
            notification_id: notificationId,
            phone_number: recipient.phone_number,
            recipient_type: recipientType
        })

        // Queue Email
        await addJob('send-email', {
            notification_id: notificationId,
            email: recipient.email,
            recipient_type: recipientType
        })

        // Queue WhatsApp (if phone number is WhatsApp enabled)
        await addJob('send-whatsapp', {
            notification_id: notificationId,
            phone_number: recipient.phone_number,
            recipient_type: recipientType
        })
    }

    generateOwnerMessage(data) {
        switch (data.type) {
            case 'booking_request':
                return `New booking request for ${data.property_name} from ${data.guest_name} for ${data.dates}. Amount: ${data.amount}. Please respond within 15 minutes.`
            default:
                return 'You have a new notification from Mishmish.'
        }
    }

    generateUserMessage(data) {
        switch (data.type) {
            case 'booking_approved':
                return 'Great news! Your booking has been approved. We are now processing your payment.'
            case 'booking_rejected':
                return `Sorry, your booking has been declined. Reason: ${data.reason}`
            case 'payment_failed':
                return 'Payment failed. Please try booking again or contact support.'
            case 'booking_confirmed':
                return 'Booking confirmed! You will receive detailed confirmation shortly.'
            default:
                return data.message || 'You have a new notification from Mishmish.'
        }
    }

    async sendBookingConfirmation(reservationId) {
        const db = getDatabase()

        try {
            // Get reservation details
            const { data: reservation } = await db
                .from('reservation')
                .select(`
          *,
          users:user_id(name, email, phone_number),
          property:property_id(name, address, owner_id)
        `)
                .eq('id', reservationId)
                .single()

            // Send confirmation to user
            await this.sendUserNotification(reservation.user_id, {
                type: 'booking_confirmed',
                reservation_id: reservationId,
                message: `Booking confirmed for ${reservation.property.name}! Check your email for details.`
            })

            // Send confirmation to owner
            await this.sendOwnerNotification(reservation.property.owner_id, {
                type: 'booking_confirmed',
                reservation_id: reservationId,
                property_name: reservation.property.name,
                guest_name: reservation.users.name
            })

        } catch (error) {
            console.error('Send booking confirmation error:', error)
        }
    }

    async sendTimeoutNotifications(reservationId) {
        // Implementation for timeout notifications
        console.log(`Sending timeout notifications for reservation ${reservationId}`)
    }

    async sendCancellationNotifications(reservationId) {
        // Implementation for cancellation notifications
        console.log(`Sending cancellation notifications for reservation ${reservationId}`)
    }
}

module.exports = new NotificationService()
