// =============================================================================
// JOB PROCESSORS
// =============================================================================

// src/jobs/processors/reservationTimeout.js
const reservationService = require('../../services/reservation')

module.exports = async function (job) {
    const { reservation_id } = job.data

    console.log(`Processing reservation timeout for ${reservation_id}`)

    try {
        await reservationService.handleReservationTimeout(reservation_id)
        return { success: true }
    } catch (error) {
        console.error(`Timeout processing failed for reservation ${reservation_id}:`, error)
        throw error
    }
}