// =============================================================================
// JOB PROCESSORS
// =============================================================================

// src/jobs/processors/sendEmail.js
const nodemailer = require('nodemailer')
const { getDatabase } = require('../../database/connection')

module.exports = async function (job) {
  const { notification_id, email, recipient_type } = job.data
  const db = getDatabase()

  try {
    // Get notification details
    const { data: notification } = await db
      .from('notification')
      .select('*')
      .eq('id', notification_id)
      .single()

    if (!notification) {
      throw new Error('Notification not found')
    }

    // Create email transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    // Email content
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@mishmish.com',
      to: email,
      subject: this.getEmailSubject(notification.type),
      html: this.getEmailTemplate(notification, recipient_type)
    }

    // Send email
    await transporter.sendMail(mailOptions)

    // Update notification status
    await db
      .from('notification')
      .update({
        channel: 'email',
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', notification_id)

    return { success: true, channel: 'email' }

  } catch (error) {
    console.error(`Email sending failed for notification ${notification_id}:`, error)

    // Update notification status as failed
    await db
      .from('notification')
      .update({
        channel: 'email',
        status: 'failed',
        sent_at: new Date().toISOString()
      })
      .eq('id', notification_id)

    throw error
  }
}

// Helper methods for email processor
function getEmailSubject(type) {
  const subjects = {
    'booking_request': 'New Booking Request - Action Required',
    'booking_approved': 'Booking Approved - Payment Processing',
    'booking_rejected': 'Booking Update',
    'booking_confirmed': 'Booking Confirmed!',
    'payment_failed': 'Payment Issue - Action Required'
  }
  return subjects[type] || 'Notification from Mishmish'
}

function getEmailTemplate(notification, recipientType) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Mishmish Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Mishmish</h1>
        </div>
        <div class="content">
          <p>${notification.message}</p>
          ${recipientType === 'owner' && notification.type === 'booking_request' ?
      `<p><a href="${process.env.APP_URL}/owner/reservations/${notification.reservation_id}" class="button">Review Booking</a></p>` :
      ''
    }
        </div>
        <div class="footer">
          <p>© 2025 Mishmish. All rights reserved.</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
