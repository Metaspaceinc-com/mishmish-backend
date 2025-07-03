// =============================================================================
// PROPERTY ROUTES (WITH CHANNEL MANAGER INTEGRATION)
// =============================================================================

// src/routes/properties.js
const express = require('express')
const { body, query, validationResult } = require('express-validator')
const channelManagerService = require('../services/channelManager')
const { getDatabase } = require('../database/connection')

const router = express.Router()

// Search properties with availability
router.get('/search', [
    query('location').optional().trim(),
    query('check_in').isISO8601().toDate(),
    query('check_out').isISO8601().toDate(),
    query('shift').isIn(['morning', 'evening', 'full_day']),
    query('guests').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const {
            location,
            check_in,
            check_out,
            shift,
            guests,
            page = 1,
            limit = 20
        } = req.query

        // Get available properties from Channel Manager
        const availableProperties = await channelManagerService.searchProperties({
            location,
            check_in,
            check_out,
            shift,
            guests,
            page,
            limit
        })

        res.json({
            properties: availableProperties.data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: availableProperties.total,
                total_pages: Math.ceil(availableProperties.total / limit)
            }
        })

    } catch (error) {
        console.error('Property search error:', error)
        res.status(500).json({ error: 'Search failed' })
    }
})

// Get property details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Get property details from Channel Manager
        const property = await channelManagerService.getProperty(id)

        if (!property) {
            return res.status(404).json({ error: 'Property not found' })
        }

        // Get additional data from our database (reviews, etc.)
        const db = getDatabase()
        const { data: reviews } = await db
            .from('review')
            .select(`
        *,
        reservation!inner(
          property_id
        )
      `)
            .eq('reservation.property_id', id)

        res.json({
            ...property,
            reviews: reviews || []
        })

    } catch (error) {
        console.error('Get property error:', error)
        res.status(500).json({ error: 'Failed to get property' })
    }
})

// Check availability for specific dates
router.post('/:id/availability', [
    body('check_in').isISO8601().toDate(),
    body('check_out').isISO8601().toDate(),
    body('shift').isIn(['morning', 'evening', 'full_day'])
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { id } = req.params
        const { check_in, check_out, shift } = req.body

        const availability = await channelManagerService.checkAvailability(
            id,
            check_in,
            check_out,
            shift
        )

        res.json(availability)

    } catch (error) {
        console.error('Availability check error:', error)
        res.status(500).json({ error: 'Failed to check availability' })
    }
})

module.exports = router
