// tests/helpers/testData.js
const bcrypt = require('bcryptjs')

const createTestUser = async (db, overrides = {}) => {
    const userData = {
        name: 'Test User',
        email: 'test@example.com',
        phone_number: '+1234567890',
        password: await bcrypt.hash('password123', 10),
        has_land: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides
    }

    const { data: user, error } = await db
        .from('users')
        .insert(userData)
        .select('id, name, email, phone_number, has_land, created_at')
        .single()

    if (error) throw error
    return user
}

const createTestOwner = async (db, overrides = {}) => {
    const ownerData = {
        full_name: 'Test Owner',
        dob: '1990-01-01',
        phone_number: '+1234567891',
        email: 'owner@example.com',
        address: '123 Test Street',
        is_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        ...overrides
    }

    const { data: owner, error } = await db
        .from('owner')
        .insert(ownerData)
        .select()
        .single()

    if (error) throw error
    return owner
}

const createTestReservation = async (db, userId, overrides = {}) => {
    const reservationData = {
        user_id: userId,
        property_id: 123,
        shift_id: 1,
        start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
        reservation_token: `test_token_${Date.now()}`,
        status: 'pending',
        payment_status: 'none',
        payment_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides
    }

    const { data: reservation, error } = await db
        .from('reservation')
        .insert(reservationData)
        .select()
        .single()

    if (error) throw error
    return reservation
}

module.exports = {
    createTestUser,
    createTestOwner,
    createTestReservation
}
