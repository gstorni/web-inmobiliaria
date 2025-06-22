import { TokkoSecurityManager } from "./tokko-security"
import type { TokkoApiResponse, TokkoProperty, TokkoSinglePropertyResponse } from "./tokko-types"

interface SecureTokkoConfig {
  apiKey: string
  baseUrl: string
  readOnlyMode: boolean
}

interface PropertyFilters {
  type?: string
  location?: string
  minPrice?: string
  maxPrice?: string
  minSurface?: string
  maxSurface?: string
  operation?: string
  limit?: string
  offset?: string
}

export class SecureTokkoClient {
  private config: SecureTokkoConfig
  private security: TokkoSecurityManager

  constructor(config: Omit<SecureTokkoConfig, "readOnlyMode">) {
    this.config = { ...config, readOnlyMode: true } // Force read-only mode
    this.security = TokkoSecurityManager.getInstance()

    // Validate API key on initialization
    if (!this.security.validateApiKey(config.apiKey)) {
      throw new Error("Invalid API key format. Ensure you have a valid TokkoBroker API key.")
    }
  }

  private async makeSecureRequest<T>(
    endpoint: string,
    method: "GET" = "GET",
    params: Record<string, string> = {},
  ): Promise<T> {
    // Security validations
    this.security.preventWriteOperations(method)

    if (!this.security.validateHttpMethod(method)) {
      throw new Error(`HTTP method ${method} not allowed. Only GET requests permitted.`)
    }

    if (!this.security.validateEndpoint(endpoint)) {
      throw new Error(`Endpoint ${endpoint} not in whitelist. Access denied.`)
    }

    // Sanitize parameters
    const sanitizedParams = this.security.sanitizeQueryParams(params)

    const url = new URL(`${this.config.baseUrl}${endpoint}`)

    // Add required parameters
    url.searchParams.append("key", this.config.apiKey)
    url.searchParams.append("format", "json")

    // Add sanitized parameters
    Object.entries(sanitizedParams).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value)
    })

    try {
      const response = await fetch(url.toString(), {
        method: "GET", // Hardcoded to GET only
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "IndustrialPro-ReadOnly/1.0",
          "X-Read-Only-Mode": "true",
        },
        // Security headers
        cache: "default",
        credentials: "omit", // Don't send credentials
      })

      if (!response.ok) {
        throw new Error(`TokkoBroker API error: ${response.status} ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error("Secure API request failed:", error)
      throw error
    }
  }

  // All methods use the secure request wrapper with proper typing
  async getProperties(filters: PropertyFilters = {}): Promise<TokkoApiResponse<TokkoProperty>> {
    return this.makeSecureRequest("/property/", "GET", filters)
  }

  async getProperty(id: number): Promise<TokkoSinglePropertyResponse> {
    return this.makeSecureRequest(`/property/${id}/`, "GET")
  }

  async getPropertyTypes(): Promise<TokkoApiResponse<{ id: number; name: string }>> {
    return this.makeSecureRequest("/property_type/", "GET")
  }

  async getLocations(): Promise<TokkoApiResponse<{ id: number; name: string; parent?: { name: string } }>> {
    return this.makeSecureRequest("/location/", "GET")
  }

  // Explicitly disabled write methods
  async createProperty(): Promise<never> {
    throw new Error("SECURITY: Create operations are disabled in read-only mode")
  }

  async updateProperty(): Promise<never> {
    throw new Error("SECURITY: Update operations are disabled in read-only mode")
  }

  async deleteProperty(): Promise<never> {
    throw new Error("SECURITY: Delete operations are disabled in read-only mode")
  }
}

// Export singleton with read-only enforcement
export const secureTokkoClient = new SecureTokkoClient({
  apiKey: process.env.TOKKO_API_KEY || "",
  baseUrl: "https://www.tokkobroker.com/api/v1",
})
