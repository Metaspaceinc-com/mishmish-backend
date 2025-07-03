// =============================================================================
// ERROR HANDLER MIDDLEWARE
// =============================================================================

// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
    console.error('Error:', err)

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.details
        })
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token'
        })
    }

    // Supabase errors
    if (err.code) {
        return res.status(400).json({
            error: 'Database Error',
            message: err.message
        })
    }

    // Default error
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    })
}

module.exports = errorHandler
