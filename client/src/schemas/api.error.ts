export interface APIError { 
    response?: {
        data?: {
            error?: string
        }
    }
}