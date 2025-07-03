// src/routes/payments.js
const express = require('express')
const { getDatabase } = require('../database/connection')

const router = express.Router()

// Get payment history for user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id
        const { page = 1, limit = 20 } = req.query

        const db = getDatabase()
        const { data: payments, error } = await db
            .from('payment')
            .select(`
        *,
        reservation:reservation_id(
          id,
          start_date,
          end_date,
          property:property_id(name, address)
        )
      `)
            .eq('reservation.user_id', userId)
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1)

        if (error) {
            throw error
        }

        res.json({
            payments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        })

    } catch (error) {
        console.error('Get payments error:', error)
        res.status(500).json({ error: 'Failed to get payments' })
    }
})

// Get specific payment details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.user.id

        const db = getDatabase()
        const { data: payment, error } = await db
            .from('payment')
            .select(`
        *,
        reservation:reservation_id(
          *,
          property:property_id(name, address),
          shift:shift_id(name, start_time, end_time)
        )
      `)
            .eq('id', id)
            .eq('reservation.user_id', userId)
            .single()

        if (error || !payment) {
            return res.status(404).json({ error: 'Payment not found' })
        }

        res.json(payment)

    } catch (error) {
        console.error('Get payment error:', error)
        res.status(500).json({ error: 'Failed to get payment' })
    }
})

module.exports = router
