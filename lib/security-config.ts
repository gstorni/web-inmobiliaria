// Security configuration for TokkoBroker integration
export const SECURITY_CONFIG = {
  // Enforce read-only operations
  ALLOWED_HTTP_METHODS: ["GET"] as const,

  // API endpoint whitelist - only read operations
  ALLOWED_ENDPOINTS: ["/property/", "/property_type/", "/location/", "/currency/", "/operation_type/"] as const,

  // Forbidden operations that could modify data
  FORBIDDEN_METHODS: ["POST", "PUT", "PATCH", "DELETE"] as const,

  // Rate limiting to prevent abuse
  RATE_LIMIT: {
    requests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // API key validation
  API_KEY_VALIDATION: {
    required: true,
    minLength: 32,
    pattern: /^[a-zA-Z0-9]+$/,
  },
} as const
