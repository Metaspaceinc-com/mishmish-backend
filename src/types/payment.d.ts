// Payment Gateway Types
export interface APSPaymentRequest {
	merchant_identifier: string
	access_code: string
	merchant_reference: string
	amount: number
	currency: string
	language: string
	customer_name: string
	customer_email: string
	command: "AUTHORIZATION" | "CAPTURE"
	return_url: string
	fort_id?: string
}

export interface APSPaymentResponse {
	response_code: string
	authorization_code?: string
	fort_id?: string
	merchant_reference: string
	transaction_id?: string
}
