// Channel Manager API Types
export interface ChannelManagerProperty {
	id: number
	name: string
	description: string
	address: string
	latitude: number
	longitude: number
	owner_id: number
	images: string[]
	amenities: string[]
	pricing: {
		morning: number
		evening: number
		full_day: number
	}
	availability: {
		[date: string]: {
			morning: boolean
			evening: boolean
			full_day: boolean
		}
	}
}

export interface ChannelManagerSearchParams {
	location?: string
	check_in: Date
	check_out: Date
	shift: "morning" | "evening" | "full_day"
	guests?: number
	page?: number
	limit?: number
}

export interface ChannelManagerSearchResponse {
	data: ChannelManagerProperty[]
	total: number
	page: number
	limit: number
}

export interface ChannelManagerAvailabilityResponse {
	available: boolean
	price: number
	lock_token?: string
	message?: string
}

export interface ChannelManagerLockResponse {
	success: boolean
	expires_at: string
	message?: string
}
