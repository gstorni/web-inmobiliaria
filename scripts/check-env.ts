// Simple script to check if all required environment variables are set
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKKO_API_KEY",
]

console.log("🔍 Environment Variables Check")
console.log("=".repeat(40))

let allGood = true

requiredEnvVars.forEach((varName) => {
  const value = process.env[varName]
  if (value) {
    // Show first 10 chars for security
    const preview = value.length > 10 ? `${value.substring(0, 10)}...` : value
    console.log(`✅ ${varName}: ${preview}`)
  } else {
    console.log(`❌ ${varName}: NOT SET`)
    allGood = false
  }
})

console.log("=".repeat(40))

if (allGood) {
  console.log("🎉 All environment variables are set!")
  console.log("You can now run: npx tsx scripts/setup-supabase-cache.ts")
} else {
  console.log("❌ Missing environment variables!")
  console.log("\n💡 Create/update your .env.local file with:")
  console.log("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
  console.log("TOKKO_API_KEY=your_existing_tokko_key")
  console.log("\n📍 Get these from your Supabase project dashboard:")
  console.log("   Settings > API > Project URL & API Keys")
}
