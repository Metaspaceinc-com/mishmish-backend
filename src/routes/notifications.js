// src/routes/notifications.js
const express = require('express')
const { getDatabase } = require('../database/connection')

const router = express.Router()

// Get user notifications
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id
        const { page = 1, limit = 20, unread_only = false } = req.query

        const db = getDatabase()
        let query = db
            .from('notification')
            .select('*')
            .eq('recipient_type', 'user')
            .eq('recipient_id', userId)
            .order('created_at', { ascending: false })

        if (unread_only === 'true') {
            query = query.eq('status', 'sent')
        }

        const { data: notifications, error } = await query
            .range((page - 1) * limit, page * limit - 1)

        if (error) {
            throw error
        }

        res.json({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        })

    } catch (error) {
        console.error('Get notifications error:', error)
        res.status(500).json({ error: 'Failed to get notifications' })
    }
})

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.user.id

        const db = getDatabase()
        const { data: notification, error } = await db
            .from('notification')
            .update({ status: 'read' })
            .eq('id', id)
            .eq('recipient_id', userId)
            .eq('recipient_type', 'user')
            .select()
            .single()

        if (error || !notification) {
            return res.status(404).json({ error: 'Notification not found' })
        }

        res.json({
            message: 'Notification marked as read',
            notification
        })

    } catch (error) {
        console.error('Mark notification read error:', error)
        res.status(500).json({ error: 'Failed to mark notification as read' })
    }
})

module.exports = router