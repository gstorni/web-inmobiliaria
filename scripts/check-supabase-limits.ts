import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

async function checkSupabaseLimits() {
  console.log("🔍 CHECKING SUPABASE FREE TIER LIMITS")
  console.log("============================================================")

  // Check environment variables
  const supabaseUrl = null
  const supabaseKey = null
  const serviceKey = null

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables")
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log("\n📊 STEP 1: Database Size Check")
  console.log("----------------------------------------")

  try {
    // Check table sizes
    const tables = ["properties_cache", "property_images", "processing_checkpoints"]
    let totalSize = 0

    for (const table of tables) {
      try {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })

        if (error) {
          console.log(`⚠️ ${table}: Cannot access (${error.message})`)
        } else {
          console.log(`📋 ${table}: ${count || 0} records`)
          totalSize += count || 0
        }
      } catch (err) {
        console.log(`⚠️ ${table}: Access error`)
      }
    }

    console.log(`📊 Total records across all tables: ${totalSize}`)

    // Estimate database size
    const estimatedSizeMB = Math.round((totalSize * 2) / 1000) // Rough estimate
    console.log(`💾 Estimated database size: ~${estimatedSizeMB}MB`)

    if (estimatedSizeMB > 400) {
      console.log("🚨 WARNING: Approaching 500MB free tier limit!")
    } else {
      console.log("✅ Database size looks OK for free tier")
    }
  } catch (error) {
    console.error("❌ Database size check failed:", error)
  }

  console.log("\n🔗 STEP 2: Connection Test")
  console.log("----------------------------------------")

  try {
    const startTime = Date.now()
    const { data, error } = await supabase.from("properties_cache").select("id").limit(1)

    const responseTime = Date.now() - startTime

    if (error) {
      console.log("❌ Connection failed:", error.message)
    } else {
      console.log(`✅ Connection successful (${responseTime}ms)`)

      if (responseTime > 5000) {
        console.log("⚠️ Slow response - possible free tier throttling")
      } else if (responseTime > 2000) {
        console.log("⚠️ Moderate response time - some throttling possible")
      } else {
        console.log("✅ Good response time")
      }
    }
  } catch (error) {
    console.error("❌ Connection test failed:", error)
  }

  console.log("\n⚡ STEP 3: Rate Limit Test")
  console.log("----------------------------------------")

  try {
    console.log("🔄 Testing multiple concurrent requests...")
    const promises = []

    // Test 10 concurrent requests
    for (let i = 0; i < 10; i++) {
      promises.push(supabase.from("properties_cache").select("id").limit(1))
    }

    const startTime = Date.now()
    const results = await Promise.allSettled(promises)
    const totalTime = Date.now() - startTime

    const successful = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    console.log(`📊 Results: ${successful} successful, ${failed} failed`)
    console.log(`⏱️ Total time: ${totalTime}ms`)

    if (failed > 0) {
      console.log("🚨 RATE LIMITING DETECTED - Free tier limits hit!")
      console.log("💡 Solution: Upgrade to Pro or reduce concurrent requests")
    } else if (totalTime > 10000) {
      console.log("⚠️ Slow concurrent requests - possible throttling")
    } else {
      console.log("✅ Concurrent requests working well")
    }
  } catch (error) {
    console.error("❌ Rate limit test failed:", error)
  }

  console.log("\n🏗️ STEP 4: Project Information")
  console.log("----------------------------------------")

  try {
    // Extract project info from URL
    const projectId = supabaseUrl.split("//")[1]?.split(".")[0]
    console.log(`🆔 Project ID: ${projectId}`)
    console.log(`🌐 Project URL: ${supabaseUrl}`)

    // Check if it's a free tier URL pattern
    if (supabaseUrl.includes(".supabase.co")) {
      console.log("📦 Tier: Likely Free Tier (shared infrastructure)")
      console.log("💡 Free tier limitations:")
      console.log("   • 60 concurrent connections")
      console.log("   • 500MB database size")
      console.log("   • Rate limiting on API requests")
      console.log("   • Auto-pause after 1 week inactivity")
    }
  } catch (error) {
    console.log("⚠️ Could not determine project information")
  }

  console.log("\n💡 RECOMMENDATIONS")
  console.log("============================================================")

  console.log("Based on your usage pattern:")
  console.log("• 229 properties + 1,882 images = Heavy database usage")
  console.log("• Concurrent sync operations = High connection usage")
  console.log("• Retry logic = Additional connection pressure")
  console.log("")
  console.log("🎯 SOLUTIONS:")
  console.log("1. 🆙 Upgrade to Supabase Pro ($25/month)")
  console.log("   • Removes connection limits")
  console.log("   • 8GB database size")
  console.log("   • Better performance")
  console.log("")
  console.log("2. 🔧 Optimize for Free Tier:")
  console.log("   • Reduce batch sizes (5-10 items)")
  console.log("   • Add delays between requests")
  console.log("   • Use connection pooling")
  console.log("   • Process images separately")
  console.log("")
  console.log("3. 📊 Monitor Usage:")
  console.log("   • Check Supabase dashboard for metrics")
  console.log("   • Watch for auto-pause warnings")
  console.log("   • Monitor database size growth")

  console.log("\n✅ Limit check complete!")
}

// Run the check
checkSupabaseLimits().catch(console.error)
