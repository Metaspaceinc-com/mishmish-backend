// src/routes/users.js
const express = require('express')
const { body, validationResult } = require('express-validator')
const { getDatabase } = require('../database/connection')
const multer = require('multer')
const sharp = require('sharp')
const { createClient } = require('@supabase/supabase-js')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.id
        const db = getDatabase()

        const { data: user, error } = await db
            .from('users')
            .select('id, name, email, phone_number, description, profile_image, has_land, created_at')
            .eq('id', userId)
            .single()

        if (error) {
            throw error
        }

        res.json(user)

    } catch (error) {
        console.error('Get profile error:', error)
        res.status(500).json({ error: 'Failed to get profile' })
    }
})

// Update user profile
router.patch('/profile', [
    body('name').optional().trim(),
    body('phone_number').optional().isMobilePhone(),
    body('description').optional().trim(),
    body('has_land').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const userId = req.user.id
        const updates = req.body
        updates.updated_at = new Date().toISOString()

        const db = getDatabase()
        const { data: user, error } = await db
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select('id, name, email, phone_number, description, profile_image, has_land, updated_at')
            .single()

        if (error) {
            throw error
        }

        res.json({
            message: 'Profile updated successfully',
            user
        })

    } catch (error) {
        console.error('Update profile error:', error)
        res.status(500).json({ error: 'Failed to update profile' })
    }
})

// Upload profile image
router.post('/profile/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' })
        }

        const userId = req.user.id

        // Process image with Sharp
        const processedImage = await sharp(req.file.buffer)
            .resize(300, 300)
            .jpeg({ quality: 80 })
            .toBuffer()

        // Upload to Supabase Storage
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        const fileName = `profiles/${userId}_${Date.now()}.jpg`

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, processedImage, {
                contentType: 'image/jpeg'
            })

        if (uploadError) {
            throw uploadError
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(fileName)

        // Update user record
        const db = getDatabase()
        const { data: user, error } = await db
            .from('users')
            .update({
                profile_image: publicUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select('profile_image')
            .single()

        if (error) {
            throw error
        }

        res.json({
            message: 'Profile image updated successfully',
            profile_image: user.profile_image
        })

    } catch (error) {
        console.error('Upload profile image error:', error)
        res.status(500).json({ error: 'Failed to upload image' })
    }
})

// Get user favorites
router.get('/favorites', async (req, res) => {
    try {
        const userId = req.user.id
        const { page = 1, limit = 20 } = req.query

        const db = getDatabase()
        const { data: favorites, error } = await db
            .from('favorite')
            .select('property_id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1)

        if (error) {
            throw error
        }

        // Get property details from Channel Manager
        const channelManagerService = require('../services/channelManager')
        const propertiesWithDetails = await Promise.all(
            favorites.map(async (fav) => {
                const property = await channelManagerService.getProperty(fav.property_id)
                return {
                    ...property,
                    favorited_at: fav.created_at
                }
            })
        )

        res.json({
            favorites: propertiesWithDetails,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit)
            }
        })

    } catch (error) {
        console.error('Get favorites error:', error)
        res.status(500).json({ error: 'Failed to get favorites' })
    }
})

// Add property to favorites
router.post('/favorites', [
    body('property_id').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const userId = req.user.id
        const { property_id } = req.body

        const db = getDatabase()

        // Check if already favorited
        const { data: existing } = await db
            .from('favorite')
            .select('id')
            .eq('user_id', userId)
            .eq('property_id', property_id)
            .single()

        if (existing) {
            return res.status(400).json({ error: 'Property already in favorites' })
        }

        // Add to favorites
        const { data: favorite, error } = await db
            .from('favorite')
            .insert({
                user_id: userId,
                property_id,
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (error) {
            throw error
        }

        res.status(201).json({
            message: 'Property added to favorites',
            favorite
        })

    } catch (error) {
        console.error('Add favorite error:', error)
        res.status(500).json({ error: 'Failed to add favorite' })
    }
})

// Remove property from favorites
router.delete('/favorites/:property_id', async (req, res) => {
    try {
        const userId = req.user.id
        const { property_id } = req.params

        const db = getDatabase()
        const { error } = await db
            .from('favorite')
            .delete()
            .eq('user_id', userId)
            .eq('property_id', property_id)

        if (error) {
            throw error
        }

        res.json({ message: 'Property removed from favorites' })

    } catch (error) {
        console.error('Remove favorite error:', error)
        res.status(500).json({ error: 'Failed to remove favorite' })
    }
})

module.exports = router
