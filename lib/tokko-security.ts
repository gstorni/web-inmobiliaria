import { SECURITY_CONFIG } from "./security-config"

export class TokkoSecurityManager {
  private static instance: TokkoSecurityManager

  private constructor() {}

  static getInstance(): TokkoSecurityManager {
    if (!TokkoSecurityManager.instance) {
      TokkoSecurityManager.instance = new TokkoSecurityManager()
    }
    return TokkoSecurityManager.instance
  }

  /**
   * Validates that the HTTP method is read-only
   */
  validateHttpMethod(method: string): boolean {
    return SECURITY_CONFIG.ALLOWED_HTTP_METHODS.includes(method as "GET")
  }

  /**
   * Validates that the endpoint is in the whitelist
   */
  validateEndpoint(endpoint: string): boolean {
    return SECURITY_CONFIG.ALLOWED_ENDPOINTS.some(
      (allowed) => endpoint.startsWith(allowed) || endpoint.includes(allowed),
    )
  }

  /**
   * Prevents any write operations
   */
  preventWriteOperations(method: string): void {
    if (SECURITY_CONFIG.FORBIDDEN_METHODS.includes(method as "POST" | "PUT" | "PATCH" | "DELETE")) {
      throw new Error(`Security violation: ${method} operations are forbidden. Read-only access only.`)
    }
  }

  /**
   * Validates API key format and presence
   */
  validateApiKey(apiKey: string | undefined): boolean {
    if (!apiKey) return false

    const { minLength, pattern } = SECURITY_CONFIG.API_KEY_VALIDATION
    return apiKey.length >= minLength && pattern.test(apiKey)
  }

  /**
   * Sanitizes query parameters to prevent injection
   */
  sanitizeQueryParams(params: Record<string, unknown>): Record<string, string> {
    const sanitized: Record<string, string> = {}

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" || typeof value === "number") {
        // Remove potentially dangerous characters
        const cleanValue = String(value).replace(/[<>'"&]/g, "")
        sanitized[key] = cleanValue
      }
    }

    return sanitized
  }
}
