// =============================================================================
// Test Setup and Utilities
// =============================================================================

// tests/setup.js
const { getDatabase } = require('../src/database/connection')
const { getRedis } = require('../src/services/redis')

// Test database setup
beforeAll(async () => {
    // Initialize test database connection
    process.env.NODE_ENV = 'test'
    process.env.SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL
})

afterAll(async () => {
    // Clean up connections
    const redis = getRedis()
    if (redis) {
        await redis.disconnect()
    }
})

// Clean up test data after each test
afterEach(async () => {
    if (process.env.NODE_ENV === 'test') {
        const db = getDatabase()

        // Clean up test data in reverse order of dependencies
        await db.from('notification').delete().neq('id', 0)
        await db.from('payment').delete().neq('id', 0)
        await db.from('lock').delete().neq('id', 0)
        await db.from('reservation').delete().neq('id', 0)
        await db.from('favorite').delete().neq('id', 0)
        await db.from('users').delete().like('email', '%test%')
    }
})