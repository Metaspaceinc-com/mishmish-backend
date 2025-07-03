// src/server.js - Main server entry point
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const winston = require('winston')
const expressWinston = require('express-winston')

// Import routes and middleware
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const ownerRoutes = require('./routes/owners')
const propertyRoutes = require('./routes/properties')
const reservationRoutes = require('./routes/reservations')
const paymentRoutes = require('./routes/payments')
const notificationRoutes = require('./routes/notifications')
const sseRoutes = require('./routes/sse')

const authMiddleware = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')
const { initializeDatabase } = require('./database/connection')
const { initializeRedis } = require('./services/redis')
const { initializeJobQueue } = require('./jobs/queue')

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}))

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
})
app.use('/api/', limiter)

// Parsing middleware
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
})

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }))
}

app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: "HTTP {{req.method}} {{req.url}}",
    expressFormat: true,
    colorize: false
}))

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    })
})

// API routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', authMiddleware, userRoutes)
app.use('/api/v1/owners', authMiddleware, ownerRoutes)
app.use('/api/v1/properties', authMiddleware, propertyRoutes)
app.use('/api/v1/reservations', authMiddleware, reservationRoutes)
app.use('/api/v1/payments', authMiddleware, paymentRoutes)
app.use('/api/v1/notifications', authMiddleware, notificationRoutes)
app.use('/api/v1/events', authMiddleware, sseRoutes)

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    })
})

// Global error handler
app.use(errorHandler)

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully')
    process.exit(0)
})

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully')
    process.exit(0)
})

// Initialize services and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase()
        console.log('✅ Database connected')

        // Initialize Redis
        await initializeRedis()
        console.log('✅ Redis connected')

        // Initialize job queue
        await initializeJobQueue()
        console.log('✅ Job queue initialized')

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Mishmish API running on port ${PORT}`)
            console.log(`📖 Health check: http://localhost:${PORT}/health`)
            console.log(`🔗 API base: http://localhost:${PORT}/api/v1`)
        })

    } catch (error) {
        console.error('❌ Failed to start server:', error)
        process.exit(1)
    }
}

startServer()
