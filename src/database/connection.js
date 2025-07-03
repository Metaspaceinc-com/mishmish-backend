// =============================================================================
// DATABASE CONNECTION
// =============================================================================

// src/database/connection.js
const { createClient } = require('@supabase/supabase-js')

let supabase

async function initializeDatabase() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase credentials')
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    // Test connection
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet
        throw new Error(`Database connection failed: ${error.message}`)
    }

    return supabase
}

function getDatabase() {
    if (!supabase) {
        throw new Error('Database not initialized')
    }
    return supabase
}

module.exports = { initializeDatabase, getDatabase }