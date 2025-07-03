// =============================================================================
// PAYMENT SERVICE (APS INTEGRATION)
// =============================================================================

// src/services/payment.js
const axios = require('axios')
const { getDatabase } = require('../database/connection')

class PaymentService {
    constructor() {
        this.baseURL = process.env.APS_BASE_URL || 'https://api.aps.com'
        this.merchantId = process.env.APS_MERCHANT_ID
        this.accessCode = process.env.APS_ACCESS_CODE
        this.shaRequestPhrase = process.env.APS_SHA_REQUEST_PHRASE
        this.shaResponsePhrase = process.env.APS_SHA_RESPONSE_PHRASE
    }

    async preAuthorize(paymentData) {
        const { reservation_id, amount, user_id } = paymentData
        const db = getDatabase()

        try {
            // Get user payment details (stored securely)
            const { data: user } = await db
                .from('users')
                .select('name, email')
                .eq('id', user_id)
                .single()

            // Create payment record
            const { data: payment, error } = await db
                .from('payment')
                .insert({
                    reservation_id,
                    status: 'pre_authorized',
                    amount,
                    method: 'card',
                    attempt_number: 1,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) {
                throw error
            }

            // APS pre-authorization request
            const apsRequest = {
                merchant_identifier: this.merchantId,
                access_code: this.accessCode,
                merchant_reference: `res_${reservation_id}_${Date.now()}`,
                amount: amount * 100, // Convert to cents
                currency: 'USD', // Or your preferred currency
                language: 'en',
                customer_name: user.name,
                customer_email: user.email,
                command: 'AUTHORIZATION',
                return_url: `${process.env.APP_URL}/payment/return`
            }

            // In production, you'd make actual APS API call
            // For now, simulate successful pre-authorization
            const mockResponse = {
                response_code: '18000', // Success code
                authorization_code: `auth_${Date.now()}`,
                fort_id: `fort_${Date.now()}`,
                merchant_reference: apsRequest.merchant_reference
            }

            // Update payment record
            await db
                .from('payment')
                .update({
                    gateway_response: mockResponse,
                    updated_at: new Date().toISOString()
                })
                .eq('id', payment.id)

            return {
                success: true,
                pre_auth_id: payment.id,
                reference: mockResponse.merchant_reference,
                authorization_code: mockResponse.authorization_code
            }

        } catch (error) {
            console.error('Pre-authorize payment error:', error)

            // Log failed payment attempt
            await db
                .from('payment')
                .insert({
                    reservation_id,
                    status: 'failed',
                    amount,
                    method: 'card',
                    attempt_number: 1,
                    gateway_response: { error: error.message },
                    created_at: new Date().toISOString()
                })

            return {
                success: false,
                error: error.message
            }
        }
    }

    async capturePayment(preAuthId) {
        const db = getDatabase()

        try {
            // Get payment record
            const { data: payment, error } = await db
                .from('payment')
                .select('*')
                .eq('id', preAuthId)
                .single()

            if (error || !payment) {
                throw new Error('Payment record not found')
            }

            // APS capture request
            const apsRequest = {
                merchant_identifier: this.merchantId,
                access_code: this.accessCode,
                command: 'CAPTURE',
                merchant_reference: payment.gateway_response.merchant_reference,
                amount: payment.amount * 100,
                currency: 'USD',
                language: 'en',
                fort_id: payment.gateway_response.fort_id
            }

            // Simulate successful capture
            const mockResponse = {
                response_code: '18000',
                transaction_id: `txn_${Date.now()}`,
                merchant_reference: apsRequest.merchant_reference,
                fort_id: apsRequest.fort_id
            }

            // Update payment record
            await db
                .from('payment')
                .update({
                    status: 'captured',
                    gateway_response: {
                        ...payment.gateway_response,
                        capture: mockResponse
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', preAuthId)

            return {
                success: true,
                transaction_id: mockResponse.transaction_id,
                reference: mockResponse.merchant_reference
            }

        } catch (error) {
            console.error('Capture payment error:', error)

            // Update payment record as failed
            await db
                .from('payment')
                .update({
                    status: 'failed',
                    gateway_response: {
                        capture_error: error.message
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', preAuthId)

            return {
                success: false,
                error: error.message
            }
        }
    }

    async refundPayment(transactionId, amount) {
        // Implementation for refunds
        // Would integrate with APS refund API
        console.log(`Refunding ${amount} for transaction ${transactionId}`)
        return { success: true }
    }
}

module.exports = new PaymentService()
