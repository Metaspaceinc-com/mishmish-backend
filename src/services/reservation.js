// =============================================================================
// RESERVATION SERVICE (BUSINESS LOGIC)
// =============================================================================

// src/services/reservation.js
const { v4: uuidv4 } = require('uuid')
const { getDatabase } = require('../database/connection')
const channelManagerService = require('./channelManager')
const paymentService = require('./payment')
const notificationService = require('./notification')

class ReservationService {
    async createReservation(data) {
        const { user_id, property_id, shift_id, start_date, end_date } = data
        const db = getDatabase()

        // Generate reservation token
        const reservationToken = uuidv4()

        try {
            // 1. Check availability with Channel Manager
            const availability = await channelManagerService.checkAvailability(
                property_id,
                start_date,
                end_date,
                shift_id
            )

            if (!availability.available) {
                throw new Error('Property not available for selected dates')
            }

            // 2. Lock property
            const lockToken = uuidv4()
            const lockResult = await channelManagerService.lockProperty(
                property_id,
                start_date,
                end_date,
                shift_id,
                lockToken
            )

            // 3. Get property and owner details
            const property = await channelManagerService.getProperty(property_id)
            if (!property) {
                throw new Error('Property not found')
            }

            // 4. Create reservation record
            const { data: reservation, error } = await db
                .from('reservation')
                .insert({
                    user_id,
                    property_id,
                    shift_id,
                    start_date: new Date(start_date).toISOString(),
                    end_date: new Date(end_date).toISOString(),
                    reservation_token: reservationToken,
                    status: 'pending',
                    payment_status: 'none',
                    payment_attempts: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) {
                // Release lock if reservation creation fails
                await channelManagerService.releaseLock(lockToken)
                throw error
            }

            // 5. Create lock record
            await db.from('lock').insert({
                property_id,
                user_id,
                reservation_token: reservationToken,
                start_date: new Date(start_date).toISOString(),
                end_date: new Date(end_date).toISOString(),
                lock_type: 'reservation',
                is_active: true,
                locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString()
            })

            // 6. Send notification to owner
            await notificationService.sendOwnerNotification(property.owner_id, {
                type: 'booking_request',
                reservation_id: reservation.id,
                property_name: property.name,
                guest_name: reservation.user_id, // We'd get actual name from user table
                dates: `${start_date} to ${end_date}`,
                amount: availability.price
            })

            return reservation

        } catch (error) {
            console.error('Create reservation error:', error)
            throw error
        }
    }

    async handleOwnerResponse(reservationId, response, reason = null) {
        const db = getDatabase()

        try {
            // Get reservation
            const { data: reservation, error: reservationError } = await db
                .from('reservation')
                .select('*')
                .eq('id', reservationId)
                .eq('status', 'pending')
                .single()

            if (reservationError || !reservation) {
                throw new Error('Reservation not found or already processed')
            }

            const now = new Date().toISOString()

            if (response === 'approved') {
                // Update reservation status
                const { data: updatedReservation, error: updateError } = await db
                    .from('reservation')
                    .update({
                        status: 'approved',
                        owner_response_at: now,
                        owner_response_type: 'approved',
                        updated_at: now
                    })
                    .eq('id', reservationId)
                    .select()
                    .single()

                if (updateError) {
                    throw updateError
                }

                // Process payment
                await this.processPayment(reservationId)

                // Send approval notification
                await notificationService.sendUserNotification(reservation.user_id, {
                    type: 'booking_approved',
                    reservation_id: reservationId,
                    message: 'Your booking has been approved! Processing payment...'
                })

                return updatedReservation

            } else if (response === 'rejected') {
                // Update reservation status
                const { data: updatedReservation, error: updateError } = await db
                    .from('reservation')
                    .update({
                        status: 'rejected',
                        owner_response_at: now,
                        owner_response_type: 'rejected',
                        updated_at: now
                    })
                    .eq('id', reservationId)
                    .select()
                    .single()

                if (updateError) {
                    throw updateError
                }

                // Release lock
                await this.releaseLock(reservation.reservation_token)

                // Send rejection notification
                await notificationService.sendUserNotification(reservation.user_id, {
                    type: 'booking_rejected',
                    reservation_id: reservationId,
                    reason: reason || 'No reason provided',
                    message: `Your booking has been declined. Reason: ${reason || 'No reason provided'}`
                })

                return updatedReservation
            }

        } catch (error) {
            console.error('Handle owner response error:', error)
            throw error
        }
    }

    async processPayment(reservationId) {
        const db = getDatabase()

        try {
            // Get reservation details
            const { data: reservation } = await db
                .from('reservation')
                .select('*')
                .eq('id', reservationId)
                .single()

            // Get property pricing from Channel Manager
            const property = await channelManagerService.getProperty(reservation.property_id)
            const amount = property.pricing[reservation.shift_id] || property.price_per_shift

            // Pre-authorize payment
            const preAuthResult = await paymentService.preAuthorize({
                reservation_id: reservationId,
                amount: amount,
                user_id: reservation.user_id
            })

            if (preAuthResult.success) {
                // Update payment status
                await db
                    .from('reservation')
                    .update({
                        payment_status: 'pre_authorized',
                        payment_reference: preAuthResult.reference,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', reservationId)

                // Capture payment
                const captureResult = await paymentService.capturePayment(preAuthResult.pre_auth_id)

                if (captureResult.success) {
                    // Confirm booking with Channel Manager
                    await channelManagerService.confirmBooking(
                        reservation.reservation_token,
                        reservationId
                    )

                    // Update reservation to confirmed
                    await db
                        .from('reservation')
                        .update({
                            status: 'paid',
                            payment_status: 'captured',
                            payment_reference: captureResult.transaction_id,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', reservationId)

                    // Release lock (booking confirmed)
                    await this.releaseLock(reservation.reservation_token)

                    // Send confirmation notifications
                    await notificationService.sendBookingConfirmation(reservationId)

                } else {
                    // Payment capture failed
                    await this.handlePaymentFailure(reservationId, 'capture_failed')
                }
            } else {
                // Pre-authorization failed
                await this.handlePaymentFailure(reservationId, 'pre_auth_failed')
            }

        } catch (error) {
            console.error('Process payment error:', error)
            await this.handlePaymentFailure(reservationId, 'payment_error')
            throw error
        }
    }

    async handlePaymentFailure(reservationId, reason) {
        const db = getDatabase()

        try {
            // Get reservation
            const { data: reservation } = await db
                .from('reservation')
                .select('*')
                .eq('id', reservationId)
                .single()

            // Update reservation status
            await db
                .from('reservation')
                .update({
                    status: 'failed',
                    payment_status: 'failed',
                    payment_attempts: reservation.payment_attempts + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservationId)

            // Release lock
            await this.releaseLock(reservation.reservation_token)

            // Send failure notification
            await notificationService.sendUserNotification(reservation.user_id, {
                type: 'payment_failed',
                reservation_id: reservationId,
                reason: reason,
                message: 'Payment failed. Please try booking again.'
            })

        } catch (error) {
            console.error('Handle payment failure error:', error)
        }
    }

    async handleReservationTimeout(reservationId) {
        const db = getDatabase()

        try {
            // Check if reservation is still pending
            const { data: reservation } = await db
                .from('reservation')
                .select('*')
                .eq('id', reservationId)
                .eq('status', 'pending')
                .single()

            if (!reservation) {
                return // Already processed
            }

            // Update to expired
            await db
                .from('reservation')
                .update({
                    status: 'expired',
                    owner_response_type: 'timeout',
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservationId)

            // Release lock
            await this.releaseLock(reservation.reservation_token)

            // Send timeout notifications
            await notificationService.sendTimeoutNotifications(reservationId)

        } catch (error) {
            console.error('Handle reservation timeout error:', error)
        }
    }

    async releaseLock(reservationToken) {
        const db = getDatabase()

        try {
            // Deactivate lock in our database
            await db
                .from('lock')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('reservation_token', reservationToken)

            // Release lock in Channel Manager
            await channelManagerService.releaseLock(reservationToken)

        } catch (error) {
            console.error('Release lock error:', error)
            // Don't throw - this is cleanup
        }
    }

    async cancelReservation(reservationId, userId) {
        const db = getDatabase()

        try {
            // Get reservation
            const { data: reservation, error } = await db
                .from('reservation')
                .select('*')
                .eq('id', reservationId)
                .eq('user_id', userId)
                .single()

            if (error || !reservation) {
                throw new Error('Reservation not found')
            }

            if (!['pending', 'approved'].includes(reservation.status)) {
                throw new Error('Cannot cancel this reservation')
            }

            // Update status
            const { data: updatedReservation } = await db
                .from('reservation')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservationId)
                .select()
                .single()

            // Release lock
            await this.releaseLock(reservation.reservation_token)

            // Send cancellation notifications
            await notificationService.sendCancellationNotifications(reservationId)

            return updatedReservation

        } catch (error) {
            console.error('Cancel reservation error:', error)
            throw error
        }
    }
}

module.exports = new ReservationService()
