// =============================================================================
// Integration Tests
// =============================================================================

// tests/integration/booking-flow.test.js
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { getDatabase } = require('../../src/database/connection')
const { createTestUser } = require('../helpers/testData')

// Mock external services
jest.mock('../../src/services/channelManager')
jest.mock('../../src/services/payment')
jest.mock('../../src/services/notification')
jest.mock('../../src/services/redis')
jest.mock('../../src/jobs/queue')

const app = require('../../src/server')

describe('Complete Booking Flow Integration', () => {
    let db
    let testUser
    let authToken

    beforeAll(async () => {
        db = getDatabase()
    })

    beforeEach(async () => {
        testUser = await createTestUser(db, {
            email: 'integration.test@example.com'
        })

        authToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        // Setup comprehensive mocks
        const channelManager = require('../../src/services/channelManager')
        const paymentService = require('../../src/services/payment')
        const notificationService = require('../../src/services/notification')

        channelManager.searchProperties = jest.fn().mockResolvedValue({
            data: [
                {
                    id: 123,
                    name: 'Test Property',
                    price_per_shift: 150,
                    availability: { morning: true, evening: false, full_day: false }
                }
            ],
            total: 1
        })

        channelManager.checkAvailability = jest.fn().mockResolvedValue({
            available: true,
            price: 150,
            lock_token: 'test_lock_token'
        })

        channelManager.lockProperty = jest.fn().mockResolvedValue({
            success: true,
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })

        channelManager.getProperty = jest.fn().mockResolvedValue({
            id: 123,
            name: 'Test Property',
            owner_id: 1
        })

        paymentService.preAuthorize = jest.fn().mockResolvedValue({
            success: true,
            pre_auth_id: 'pre_auth_123',
            reference: 'ref_123'
        })

        paymentService.capturePayment = jest.fn().mockResolvedValue({
            success: true,
            transaction_id: 'txn_123'
        })

        notificationService.sendOwnerNotification = jest.fn().mockResolvedValue({
            success: true,
            notification_id: 'notif_123'
        })
    })

    it('should complete the entire booking flow', async () => {
        // Step 1: Search for properties
        const searchResponse = await request(app)
            .get('/api/v1/properties/search')
            .query({
                check_in: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                check_out: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
                shift: 'morning'
            })
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)

        expect(searchResponse.body.properties).toHaveLength(1)
        const property = searchResponse.body.properties[0]

        // Step 2: Check availability
        const availabilityResponse = await request(app)
            .post(`/api/v1/properties/${property.id}/availability`)
            .send({
                check_in: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                check_out: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
                shift: 'morning'
            })
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)

        expect(availabilityResponse.body.available).toBe(true)

        // Step 3: Create reservation
        const reservationResponse = await request(app)
            .post('/api/v1/reservations')
            .send({
                property_id: property.id,
                shift_id: 1,
                start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString()
            })
            .set('Authorization', `Bearer ${authToken}`)
            .expect(201)

        expect(reservationResponse.body.reservation.status).toBe('pending')
        const reservationId = reservationResponse.body.reservation.id

        // Step 4: Simulate owner approval
        const ownerResponse = await request(app)
            .patch(`/api/v1/reservations/${reservationId}/owner-response`)
            .send({
                response: 'approved'
            })
            .set('Authorization', `Bearer ${authToken}`) // In real app, this would be owner auth
            .expect(200)

        expect(ownerResponse.body.reservation.status).toBe('approved')

        // Step 5: Verify final reservation state
        const finalReservation = await request(app)
            .get(`/api/v1/reservations/${reservationId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)

        // Check that all services were called correctly
        const channelManager = require('../../src/services/channelManager')
        const paymentService = require('../../src/services/payment')
        const notificationService = require('../../src/services/notification')

        expect(channelManager.checkAvailability).toHaveBeenCalled()
        expect(channelManager.lockProperty).toHaveBeenCalled()
        expect(notificationService.sendOwnerNotification).toHaveBeenCalled()
        expect(paymentService.preAuthorize).toHaveBeenCalled()
        expect(paymentService.capturePayment).toHaveBeenCalled()
    })

    it('should handle booking rejection properly', async () => {
        // Create reservation
        const reservationResponse = await request(app)
            .post('/api/v1/reservations')
            .send({
                property_id: 123,
                shift_id: 1,
                start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString()
            })
            .set('Authorization', `Bearer ${authToken}`)
            .expect(201)

        const reservationId = reservationResponse.body.reservation.id

        // Owner rejects
        const rejectionResponse = await request(app)
            .patch(`/api/v1/reservations/${reservationId}/owner-response`)
            .send({
                response: 'rejected',
                reason: 'Property not available'
            })
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)

        expect(rejectionResponse.body.reservation.status).toBe('rejected')
        expect(rejectionResponse.body.reservation.owner_response_type).toBe('rejected')

        // Verify lock was released
        const channelManager = require('../../src/services/channelManager')
        expect(channelManager.releaseLock).toHaveBeenCalled()
    })
})
