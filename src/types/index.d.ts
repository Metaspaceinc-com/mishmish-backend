// src/types/index.ts - TypeScript Interfaces

export interface User {
	id: number
	name: string
	email: string
	email_verified_at?: Date
	phone_number: string
	created_at: Date
	updated_at: Date
	description?: string
	profile_image?: string
	has_land: boolean
}

export interface Owner {
	id: number
	full_name: string
	dob: Date
	phone_number: string
	email: string
	title_deed?: number
	national_id?: number
	passport?: number
	address: string
	is_verified: boolean
	verified_at?: Date
	created_at: Date
}

export interface Property {
	id: number
	owner_id: number
	home_type: string
	property_type: string
	total_occupancy: number
	total_bedrooms: number
	total_bathrooms: number
	summary?: string
	address: string
	price_per_shift: number
	price_per_day: number
	published_at?: Date
	created_at: Date
	updated_at: Date
	latitude?: number
	longitude?: number
}

export interface Amenity {
	id: number
	name: string
	description?: string
}

export interface Shift {
	id: number
	name: "morning" | "evening" | "full_day"
	start_time: string
	end_time: string
}

export interface Reservation {
	id: number
	user_id: number
	property_id: number
	shift_id: number
	start_date: Date
	end_date: Date
	reservation_token: string
	status:
		| "pending"
		| "approved"
		| "rejected"
		| "expired"
		| "paid"
		| "failed"
		| "cancelled"
	payment_status: "none" | "pre_authorized" | "captured" | "failed"
	payment_reference?: string
	payment_attempts: number
	owner_response_at?: Date
	owner_response_type?: "approved" | "rejected" | "timeout"
	created_at: Date
	updated_at: Date
}

export interface Payment {
	id: number
	reservation_id: number
	status: "pre_authorized" | "captured" | "failed"
	amount: number
	method: "card" | "wallet"
	gateway_response: any
	attempt_number: number
	created_at: Date
	updated_at: Date
}

export interface Notification {
	id: number
	reservation_id: number
	recipient_type: "user" | "owner"
	recipient_id: number
	channel: "sms" | "whatsapp" | "email"
	type: string
	status: "pending" | "sent" | "failed" | "read"
	message: string
	sent_at?: Date
	created_at: Date
}

export interface Lock {
	id: number
	property_id: number
	user_id: number
	reservation_token: string
	start_date: Date
	end_date: Date
	lock_type: "reservation" | "maintenance" | "fraud_hold"
	is_active: boolean
	locked_until: Date
	created_at: Date
	updated_at: Date
}
