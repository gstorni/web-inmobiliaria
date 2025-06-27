import { config } from "dotenv"
import { resolve } from "path"
import { existsSync, readFileSync } from "fs"

console.log("🔍 Environment File Check")
console.log("=".repeat(50))

// Check if .env.local exists
const envPath = resolve(process.cwd(), ".env.local")
console.log(`📁 Looking for: ${envPath}`)

if (!existsSync(envPath)) {
  console.log("❌ .env.local file NOT FOUND!")
  console.log("\n💡 Create .env.local file with:")
  console.log("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
  console.log("TOKKO_API_KEY=your_tokko_api_key_here")
  process.exit(1)
}

console.log("✅ .env.local file found!")

// Load environment variables
config({ path: envPath })

// Check file contents (safely)
try {
  const envContent = readFileSync(envPath, "utf-8")
  const lines = envContent.split("\n").filter((line) => line.trim() && !line.startsWith("#"))

  console.log(`📄 Found ${lines.length} environment variables`)

  lines.forEach((line) => {
    const [key] = line.split("=")
    if (key) {
      console.log(`   • ${key.trim()}`)
    }
  })
} catch (error) {
  console.log("⚠️ Could not read .env.local contents")
}

console.log("\n" + "=".repeat(50))

// Test the loaded variables
const requiredVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKKO_API_KEY",
]

let allGood = true

requiredVars.forEach((varName) => {
  const value = process.env[varName]
  if (value) {
    // Show first 20 chars for security
    const preview = value.length > 20 ? `${value.substring(0, 20)}...` : value
    console.log(`✅ ${varName}: ${preview}`)
  } else {
    console.log(`❌ ${varName}: NOT SET`)
    allGood = false
  }
})

console.log("=".repeat(50))

if (allGood) {
  console.log("🎉 All required environment variables are set!")

  // Test Supabase URL format
  const supabaseUrl = null!
  if (supabaseUrl.startsWith("https://") && supabaseUrl.includes(".supabase.co")) {
    console.log("✅ Supabase URL format looks correct")
  } else {
    console.log("⚠️ Supabase URL format might be incorrect")
    console.log(`   Expected: https://your-project.supabase.co`)
    console.log(`   Got: ${supabaseUrl}`)
  }
} else {
  console.log("❌ Missing required environment variables!")
  console.log("\n💡 Add missing variables to your .env.local file")
}
