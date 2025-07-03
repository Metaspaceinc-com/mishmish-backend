// =============================================================================
// RESERVATION ROUTES (COMPLETE BOOKING WORKFLOW)
// =============================================================================

// src/routes/reservations.js
const express = require('express')
const { body, validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const reservationService = require('../services/reservation')
const { getDatabase } = require('../database/connection')
const { addJob } = require('../jobs/queue')

const router = express.Router()

// Create reservation
router.post('/', [
    body('property_id').notEmpty(),
    body('shift_id').isInt(),
    body('start_date').isISO8601().toDate(),
    body('end_date').isISO8601().toDate()
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { property_id, shift_id, start_date, end_date } = req.body
        const user_id = req.user.id

        // Create reservation with locking
        const reservation = await reservationService.createReservation({
            user_id,
            property_id,
            shift_id,
            start_date,
            end_date
        })

        // Schedule timeout job
        await addJob('reservation-timeout', {
            reservation_id: reservation.id,
            timeout_at: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        }, {
            delay: 15 * 60 * 1000 // 15 minutes
        })

        res.status(201).json({
            message: 'Reservation created successfully',
            reservation
        })

    } catch (error) {
        console.error('Create reservation error:', error)
        res.status(500).json({ error: error.message || 'Failed to create reservation' })
    }
})

// Get user reservations
router.get('/', async (req, res) => {
    try {
        const user_id = req.user.id
        const { status, page = 1, limit = 20 } = req.query

        const db = getDatabase()
        let query = db
            .from('reservation')
            .select(`
        *,
        property:property_id(name, address),
        shift:shift_id(name, start_time, end_time)
      `)
            .eq('user_id', user_id)
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
        console.error('Get reservations error:', error)
        res.status(500).json({ error: 'Failed to get reservations' })
    }
})

// Get specific reservation
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const user_id = req.user.id

        const db = getDatabase()
        const { data: reservation, error } = await db
            .from('reservation')
            .select(`
        *,
        property:property_id(*),
        shift:shift_id(name, start_time, end_time),
        payment:payment(*)
      `)
            .eq('id', id)
            .eq('user_id', user_id)
            .single()

        if (error || !reservation) {
            return res.status(404).json({ error: 'Reservation not found' })
        }

        res.json(reservation)

    } catch (error) {
        console.error('Get reservation error:', error)
        res.status(500).json({ error: 'Failed to get reservation' })
    }
})

// Owner approve/reject reservation
router.patch('/:id/owner-response', [
    body('response').isIn(['approved', 'rejected']),
    body('reason').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { id } = req.params
        const { response, reason } = req.body

        const result = await reservationService.handleOwnerResponse(id, response, reason)

        res.json({
            message: `Reservation ${response} successfully`,
            reservation: result
        })

    } catch (error) {
        console.error('Owner response error:', error)
        res.status(500).json({ error: error.message || 'Failed to process response' })
    }
})

// Cancel reservation
router.patch('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params
        const user_id = req.user.id

        const result = await reservationService.cancelReservation(id, user_id)

        res.json({
            message: 'Reservation cancelled successfully',
            reservation: result
        })

    } catch (error) {
        console.error('Cancel reservation error:', error)
        res.status(500).json({ error: error.message || 'Failed to cancel reservation' })
    }
})

module.exports = router
