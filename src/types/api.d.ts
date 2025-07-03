// API Request/Response Types
export interface RegisterRequest {
	name: string
	email: string
	phone_number: string
	password: string
	description?: string
	has_land?: boolean
}

export interface LoginRequest {
	email: string
	password: string
}

export interface AuthResponse {
	message: string
	user: Omit<User, "password">
	token: string
}

export interface CreateReservationRequest {
	property_id: number
	shift_id: number
	start_date: string
	end_date: string
}

export interface CreateReservationResponse {
	message: string
	reservation: Reservation
}

export interface PropertySearchResponse {
	properties: ChannelManagerProperty[]
	pagination: {
		page: number
		limit: number
		total: number
		total_pages: number
	}
}

export interface SSEMessage {
	type:
		| "connected"
		| "status_update"
		| "payment_processing"
		| "confirmed"
		| "failed"
		| "heartbeat"
	reservation_id?: number
	status?: string
	payment_reference?: string
	message?: string
	timestamp: string
}

export interface JobData {
	reservation_id?: number
	notification_id?: number
	phone_number?: string
	email?: string
	recipient_type?: "user" | "owner"
	timeout_at?: Date
}

export interface NotificationData {
	type: string
	reservation_id: number
	property_name?: string
	guest_name?: string
	dates?: string
	amount?: number
	reason?: string
	message?: string
}
