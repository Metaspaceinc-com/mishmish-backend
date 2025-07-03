// =============================================================================
// Authentication Tests
// =============================================================================

// tests/auth.test.js
const request = require('supertest')
const { getDatabase } = require('../src/database/connection')
const { createTestUser } = require('./helpers/testData')

// Mock the app without starting the server
jest.mock('../src/services/redis')
jest.mock('../src/jobs/queue')

const app = require('../src/server')

describe('Authentication', () => {
    let db

    beforeAll(() => {
        db = getDatabase()
    })

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john.test@example.com',
                phone_number: '+1234567890',
                password: 'password123',
                has_land: false
            }

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201)

            expect(response.body).toHaveProperty('message', 'User registered successfully')
            expect(response.body).toHaveProperty('user')
            expect(response.body).toHaveProperty('token')
            expect(response.body.user.email).toBe(userData.email)
            expect(response.body.user).not.toHaveProperty('password')
        })

        it('should fail with invalid email', async () => {
            const userData = {
                name: 'John Doe',
                email: 'invalid-email',
                phone_number: '+1234567890',
                password: 'password123'
            }

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400)

            expect(response.body).toHaveProperty('errors')
        })

        it('should fail with short password', async () => {
            const userData = {
                name: 'John Doe',
                email: 'john2.test@example.com',
                phone_number: '+1234567890',
                password: '123'
            }

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400)

            expect(response.body).toHaveProperty('errors')
        })

        it('should fail with duplicate email', async () => {
            const userData = {
                name: 'John Doe',
                email: 'duplicate.test@example.com',
                phone_number: '+1234567890',
                password: 'password123'
            }

            // Register first user
            await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201)

            // Try to register again with same email
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400)

            expect(response.body).toHaveProperty('error', 'User already exists')
        })
    })

    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            // Create a test user for login tests
            await createTestUser(db, {
                email: 'login.test@example.com',
                password: await require('bcryptjs').hash('password123', 12)
            })
        })

        it('should login successfully with valid credentials', async () => {
            const loginData = {
                email: 'login.test@example.com',
                password: 'password123'
            }

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(200)

            expect(response.body).toHaveProperty('message', 'Login successful')
            expect(response.body).toHaveProperty('user')
            expect(response.body).toHaveProperty('token')
            expect(response.body.user).not.toHaveProperty('password')
        })

        it('should fail with invalid password', async () => {
            const loginData = {
                email: 'login.test@example.com',
                password: 'wrongpassword'
            }

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401)

            expect(response.body).toHaveProperty('error', 'Invalid credentials')
        })

        it('should fail with non-existent email', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'password123'
            }

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401)

            expect(response.body).toHaveProperty('error', 'Invalid credentials')
        })
    })
})
