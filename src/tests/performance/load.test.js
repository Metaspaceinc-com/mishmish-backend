// =============================================================================
// Performance Tests
// =============================================================================

// tests/performance/load.test.js
const request = require('supertest')
const jwt = require('jsonwebtoken')

jest.mock('../../src/services/channelManager')
jest.mock('../../src/services/redis')
jest.mock('../../src/jobs/queue')

const app = require('../../src/server')

describe('Performance Tests', () => {
    let authToken

    beforeAll(() => {
        authToken = jwt.sign(
            { userId: 1, email: 'test@example.com' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        // Mock Channel Manager for consistent responses
        const channelManager = require('../../src/services/channelManager')
        channelManager.searchProperties = jest.fn().mockResolvedValue({
            data: Array(20).fill(null).map((_, i) => ({
                id: i + 1,
                name: `Property ${i + 1}`,
                price_per_shift: 100 + i * 10
            })),
            total: 20
        })
    })

    it('should handle concurrent property searches', async () => {
        const startTime = Date.now()
        const concurrentRequests = 10

        const promises = Array(concurrentRequests).fill(null).map(() =>
            request(app)
                .get('/api/v1/properties/search')
                .query({
                    check_in: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    check_out: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
                    shift: 'morning'
                })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200)
        )

        const responses = await Promise.all(promises)
        const endTime = Date.now()
        const totalTime = endTime - startTime

        // Should complete all requests within reasonable time
        expect(totalTime).toBeLessThan(5000) // 5 seconds
        expect(responses).toHaveLength(concurrentRequests)
        responses.forEach(response => {
            expect(response.body.properties).toHaveLength(20)
        })
    })

    it('should maintain response time under load', async () => {
        const iterations = 50
        const times = []

        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now()

            await request(app)
                .get('/health')
                .expect(200)

            const endTime = Date.now()
            times.push(endTime - startTime)
        }

        const averageTime = times.reduce((a, b) => a + b, 0) / times.length
        const maxTime = Math.max(...times)

        expect(averageTime).toBeLessThan(100) // Average under 100ms
        expect(maxTime).toBeLessThan(500) // Max under 500ms
    })
})
