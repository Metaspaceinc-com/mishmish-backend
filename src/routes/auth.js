// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

// src/routes/auth.js
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const { getDatabase } = require('../database/connection')

const router = express.Router()

// Register user
router.post('/register', [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('phone_number').isMobilePhone(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { name, email, phone_number, password, description, has_land } = req.body

        const db = getDatabase()

        // Check if user exists
        const { data: existingUser } = await db
            .from('users')
            .select('id')
            .eq('email', email)
            .single()

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12)

        // Create user
        const { data: user, error } = await db
            .from('users')
            .insert({
                name,
                email,
                phone_number,
                password: hashedPassword,
                description: description || null,
                has_land: has_land || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id, name, email, phone_number, description, has_land, created_at')
            .single()

        if (error) {
            throw error
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        res.status(201).json({
            message: 'User registered successfully',
            user,
            token
        })

    } catch (error) {
        console.error('Registration error:', error)
        res.status(500).json({ error: 'Registration failed' })
    }
})

// Login user
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { email, password } = req.body

        const db = getDatabase()

        // Get user with password
        const { data: user, error } = await db
            .from('users')
            .select('*')
            .eq('email', email)
            .single()

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password)
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        // Remove password from response
        delete user.password

        res.json({
            message: 'Login successful',
            user,
            token
        })

    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ error: 'Login failed' })
    }
})

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { token } = req.body

        if (!token) {
            return res.status(401).json({ error: 'No token provided' })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // Generate new token
        const newToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        res.json({ token: newToken })

    } catch (error) {
        res.status(401).json({ error: 'Invalid token' })
    }
})

module.exports = router
