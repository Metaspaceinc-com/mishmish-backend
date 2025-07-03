// src/routes/owners.js
const express = require('express')
const { body, validationResult } = require('express-validator')
const { getDatabase } = require('../database/connection')

const router = express.Router()

// Get owner reservations (for owner dashboard)
router.get('/reservations', async (req, res) => {
    try {
        // Note: This assumes the authenticated user is also an owner
        // In production, you'd have proper owner authentication
        const ownerId = req.user.owner_id // Assuming user record has owner_id
        const { status, page = 1, limit = 20 } = req.query

        const db = getDatabase()

        // Get reservations for owner's properties
        let query = db
            .from('reservation')
            .select(`
        *,
        users:user_id(name, email, phone_number),
        property:property_id(name, address),
        shift:shift_id(name, start_time, end_time)
      `)
            .eq('property.owner_id', ownerId)
            .order('created_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const { data: reservations, error } = await query
            .range((page - 1) * limit, page * limit - 1)

        if (error) {
            throw error
        }

        res.json({
            reservations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        })

    } catch (error) {
        console.error('Get owner reservations error:', error)
        res.status(500).json({ error: 'Failed to get reservations' })
    }
})

module.exports = router
