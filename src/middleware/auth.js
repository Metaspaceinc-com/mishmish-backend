// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

// src/middleware/auth.js
const jwt = require('jsonwebtoken')
const { getDatabase } = require('../database/connection')

async function authMiddleware(req, res, next) {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '')

        if (!token) {
            return res.status(401).json({ error: 'No token provided' })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Get user from database
        const db = getDatabase()
        const { data: user, error } = await db
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single()

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' })
        }

        req.user = user
        next()
    } catch (error) {
        console.error('Auth middleware error:', error)
        res.status(401).json({ error: 'Invalid token' })
    }
}

module.exports = authMiddleware