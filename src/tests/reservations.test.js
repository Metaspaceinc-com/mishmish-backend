// =============================================================================
// Reservation Tests
// =============================================================================

// tests/reservations.test.js
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { getDatabase } = require('../src/database/connection')
const { createTestUser, createTestReservation } = require('./helpers/testData')

jest.mock('../src/services/channelManager')
jest.mock('../src/services/redis')
jest.mock('../src/jobs/queue')

const app = require('../src/server')

describe('Reservations', () => {
    let db
    let testUser
    let authToken

    beforeAll(async () => {
        db = getDatabase()
    })

    beforeEach(async () => {
        // Create test user and auth token
        testUser = await createTestUser(db, {
            email: 'reservation.test@example.com'
        })

        authToken = jwt.sign(
            { userId: testUser.id, email: testUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        // Mock Channel Manager responses
        const channelManager = require('../src/services/channelManager')
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
    })

    describe('POST /api/v1/reservations', () => {
        it('should create a reservation successfully', async () => {
            const reservationData = {
                property_id: 123,
                shift_id: 1,
                start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString()
            }

            const response = await request(app)
                .post('/api/v1/reservations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(reservationData)
                .expect(201)

            expect(response.body).toHaveProperty('message', 'Reservation created successfully')
            expect(response.body).toHaveProperty('reservation')
            expect(response.body.reservation.user_id).toBe(testUser.id)
            expect(response.body.reservation.status).toBe('pending')
        })

        it('should fail without authentication', async () => {
            const reservationData = {
                property_id: 123,
                shift_id: 1,
                start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString()
            }

            await request(app)
                .post('/api/v1/reservations')
                .send(reservationData)
                .expect(401)
        })

        it('should fail with invalid data', async () => {
            const reservationData = {
                property_id: 'invalid',
                shift_id: 1
                // Missing required dates
            }

            const response = await request(app)
                .post('/api/v1/reservations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(reservationData)
                .expect(400)

            expect(response.body).toHaveProperty('errors')
        })
    })

    describe('GET /api/v1/reservations', () => {
        beforeEach(async () => {
            // Create test reservations
            await createTestReservation(db, testUser.id, {
                status: 'pending'
            })
            await createTestReservation(db, testUser.id, {
                status: 'confirmed'
            })
        })

        it('should get user reservations', async () => {
            const response = await request(app)
                .get('/api/v1/reservations')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200)

            expect(response.body).toHaveProperty('reservations')
            expect(Array.isArray(response.body.reservations)).toBe(true)
            expect(response.body.reservations.length).toBeGreaterThan(0)
            expect(response.body.reservations[0].user_id).toBe(testUser.id)
        })

        it('should filter reservations by status', async () => {
            const response = await request(app)
                .get('/api/v1/reservations?status=pending')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200)

            expect(response.body.reservations.every(r => r.status === 'pending')).toBe(true)
        })

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/v1/reservations?page=1&limit=1')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200)

            expect(response.body).toHaveProperty('pagination')
            expect(response.body.pagination.page).toBe(1)
            expect(response.body.pagination.limit).toBe(1)
        })
    })
})
