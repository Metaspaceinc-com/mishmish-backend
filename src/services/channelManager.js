// =============================================================================
// CHANNEL MANAGER SERVICE
// =============================================================================

// src/services/channelManager.js
const axios = require('axios')
const { getRedis } = require('./redis')

class ChannelManagerService {
    constructor() {
        this.baseURL = process.env.CHANNEL_MANAGER_URL || 'http://localhost:3001/api'
        this.apiKey = process.env.CHANNEL_MANAGER_API_KEY
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        })
    }

    async searchProperties(params) {
        try {
            const cacheKey = `search:${JSON.stringify(params)}`
            const redis = getRedis()

            // Check cache first
            const cached = await redis.get(cacheKey)
            if (cached) {
                return JSON.parse(cached)
            }

            const response = await this.client.get('/properties/search', { params })
            const data = response.data

            // Cache for 5 minutes
            await redis.setEx(cacheKey, 300, JSON.stringify(data))

            return data
        } catch (error) {
            console.error('Channel Manager search error:', error)
            throw new Error('Failed to search properties')
        }
    }

    async getProperty(propertyId) {
        try {
            const cacheKey = `property:${propertyId}`
            const redis = getRedis()

            const cached = await redis.get(cacheKey)
            if (cached) {
                return JSON.parse(cached)
            }

            const response = await this.client.get(`/properties/${propertyId}`)
            const data = response.data

            // Cache for 10 minutes
            await redis.setEx(cacheKey, 600, JSON.stringify(data))

            return data
        } catch (error) {
            console.error('Channel Manager get property error:', error)
            if (error.response?.status === 404) {
                return null
            }
            throw new Error('Failed to get property')
        }
    }

    async checkAvailability(propertyId, checkIn, checkOut, shift) {
        try {
            const response = await this.client.post(`/properties/${propertyId}/availability`, {
                check_in: checkIn,
                check_out: checkOut,
                shift: shift
            })

            return response.data
        } catch (error) {
            console.error('Channel Manager availability error:', error)
            throw new Error('Failed to check availability')
        }
    }

    async lockProperty(propertyId, checkIn, checkOut, shift, lockToken) {
        try {
            const response = await this.client.post(`/properties/${propertyId}/lock`, {
                check_in: checkIn,
                check_out: checkOut,
                shift: shift,
                lock_token: lockToken,
                expires_in: 15 * 60 // 15 minutes
            })

            return response.data
        } catch (error) {
            console.error('Channel Manager lock error:', error)
            throw new Error('Failed to lock property')
        }
    }

    async releaseLock(lockToken) {
        try {
            const response = await this.client.delete(`/locks/${lockToken}`)
            return response.data
        } catch (error) {
            console.error('Channel Manager release lock error:', error)
            throw new Error('Failed to release lock')
        }
    }

    async confirmBooking(lockToken, reservationId) {
        try {
            const response = await this.client.post(`/locks/${lockToken}/confirm`, {
                reservation_id: reservationId
            })

            return response.data
        } catch (error) {
            console.error('Channel Manager confirm booking error:', error)
            throw new Error('Failed to confirm booking')
        }
    }
}

module.exports = new ChannelManagerService()
