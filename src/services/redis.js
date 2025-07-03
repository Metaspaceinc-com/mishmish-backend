// =============================================================================
// REDIS CONNECTION
// =============================================================================

// src/services/redis.js
const Redis = require('redis')

let redisClient

async function initializeRedis() {
    redisClient = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                return new Error('Redis server connection refused')
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                return new Error('Redis retry time exhausted')
            }
            if (options.attempt > 10) {
                return undefined
            }
            return Math.min(options.attempt * 100, 3000)
        }
    })

    redisClient.on('error', (err) => {
        console.error('Redis Client Error', err)
    })

    await redisClient.connect()
    return redisClient
}

function getRedis() {
    if (!redisClient) {
        throw new Error('Redis not initialized')
    }
    return redisClient
}

module.exports = { initializeRedis, getRedis }


