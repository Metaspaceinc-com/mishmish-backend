// =============================================================================
// JOB QUEUE SYSTEM
// =============================================================================

// src/jobs/queue.js
const Queue = require('bull')
const { getRedis } = require('../services/redis')

let jobQueue

async function initializeJobQueue() {
    const redis = getRedis()

    jobQueue = new Queue('mishmish jobs', {
        redis: {
            port: process.env.REDIS_PORT || 6379,
            host: process.env.REDIS_HOST || 'localhost',
        },
        defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        },
    })

    // Process different job types
    jobQueue.process('reservation-timeout', require('./processors/reservationTimeout'))
    jobQueue.process('send-sms', require('./processors/sendSMS'))
    jobQueue.process('send-email', require('./processors/sendEmail'))
    jobQueue.process('send-whatsapp', require('./processors/sendWhatsApp'))

    // Job event handlers
    jobQueue.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`)
    })

    jobQueue.on('failed', (job, err) => {
        console.error(`Job ${job.id} failed:`, err)
    })

    return jobQueue
}

async function addJob(type, data, options = {}) {
    if (!jobQueue) {
        throw new Error('Job queue not initialized')
    }

    return await jobQueue.add(type, data, options)
}

function getQueue() {
    return jobQueue
}

module.exports = { initializeJobQueue, addJob, getQueue }
