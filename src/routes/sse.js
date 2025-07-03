// =============================================================================
// SERVER-SENT EVENTS (REAL-TIME UPDATES)
// =============================================================================

// src/routes/sse.js
const express = require('express')
const { getRedis } = require('../services/redis')

const router = express.Router()

// SSE endpoint for real-time updates
router.get('/reservation/:id', async (req, res) => {
    const { id } = req.params
    const userId = req.user.id

    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        reservation_id: id,
        timestamp: new Date().toISOString()
    })}\n\n`)

    // Set up Redis subscriber for real-time updates
    const redis = getRedis()
    const subscriber = redis.duplicate()
    await subscriber.connect()

    const channel = `reservation:${id}:updates`
    await subscriber.subscribe(channel, (message) => {
        res.write(`data: ${message}\n\n`)
    })

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
        })}\n\n`)
    }, 30000)

    // Handle client disconnect
    req.on('close', async () => {
        clearInterval(heartbeat)
        await subscriber.unsubscribe(channel)
        await subscriber.disconnect()
        res.end()
    })
})

// SSE endpoint for general user notifications
router.get('/notifications', async (req, res) => {
    const userId = req.user.id

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    })

    res.write(`data: ${JSON.stringify({
        type: 'connected',
        user_id: userId,
        timestamp: new Date().toISOString()
    })}\n\n`)

    const redis = getRedis()
    const subscriber = redis.duplicate()
    await subscriber.connect()

    const channel = `user:${userId}:notifications`
    await subscriber.subscribe(channel, (message) => {
        res.write(`data: ${message}\n\n`)
    })

    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
        })}\n\n`)
    }, 30000)

    req.on('close', async () => {
        clearInterval(heartbeat)
        await subscriber.unsubscribe(channel)
        await subscriber.disconnect()
        res.end()
    })
})

module.exports = router
