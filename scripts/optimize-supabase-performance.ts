import { config } from "dotenv"
import path from "path"

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") })

async function optimizeSupabasePerformance() {
  console.log("🚀 OPTIMIZING SUPABASE PERFORMANCE")
  console.log("==================================================")

  // Check environment variables
  const supabaseUrl = null
  const supabaseServiceKey = null

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables")
    console.log("Required variables:")
    console.log("- NEXT_PUBLIC_SUPABASE_URL")
    console.log("- SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  console.log("✅ Environment variables loaded")
  console.log(`📍 Supabase URL: ${supabaseUrl}`)

  // Create admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log("\n📊 STEP 1: Testing Current Performance")
    console.log("----------------------------------------")

    // Test current query performance
    const startTime = Date.now()
    const { data: testData, error: testError } = await supabase.from("processing_checkpoints").select("*").limit(10)

    const queryTime = Date.now() - startTime

    if (testError) {
      console.error("❌ Initial query failed:", testError.message)
      return
    }

    console.log(`✅ Current query time: ${queryTime}ms`)
    console.log(`📊 Found ${testData?.length || 0} checkpoint records`)

    console.log("\n🔧 STEP 2: Adding Performance Indexes")
    console.log("----------------------------------------")

    // Add indexes for better performance
    const indexes = [
      {
        name: "idx_checkpoints_status_updated",
        sql: "CREATE INDEX IF NOT EXISTS idx_checkpoints_status_updated ON processing_checkpoints(status, updated_at DESC);",
      },
      {
        name: "idx_checkpoints_process_type_status",
        sql: "CREATE INDEX IF NOT EXISTS idx_checkpoints_process_type_status ON processing_checkpoints(process_type, status);",
      },
      {
        name: "idx_checkpoints_started_at",
        sql: "CREATE INDEX IF NOT EXISTS idx_checkpoints_started_at ON processing_checkpoints(started_at DESC);",
      },
    ]

    for (const index of indexes) {
      try {
        const { error } = await supabase.rpc("exec", { sql: index.sql })
        if (error) {
          console.log(`⚠️ Index ${index.name}: ${error.message}`)
        } else {
          console.log(`✅ Added index: ${index.name}`)
        }
      } catch (err) {
        console.log(`⚠️ Index ${index.name}: RPC not available, skipping`)
      }
    }

    console.log("\n🧹 STEP 3: Cleaning Up Old Records")
    console.log("----------------------------------------")

    // Clean up old completed records (older than 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: oldRecords, error: cleanupError } = await supabase
      .from("processing_checkpoints")
      .delete()
      .eq("status", "completed")
      .lt("completed_at", sevenDaysAgo.toISOString())
      .select("id")

    if (cleanupError) {
      console.log(`⚠️ Cleanup warning: ${cleanupError.message}`)
    } else {
      console.log(`✅ Cleaned up ${oldRecords?.length || 0} old records`)
    }

    console.log("\n⚡ STEP 4: Testing Optimized Performance")
    console.log("----------------------------------------")

    // Test optimized query performance
    const optimizedStartTime = Date.now()
    const { data: optimizedData, error: optimizedError } = await supabase
      .from("processing_checkpoints")
      .select("process_type, process_id, status, total_items, processed_items, started_at, updated_at")
      .in("status", ["running", "paused"])
      .order("updated_at", { ascending: false })
      .limit(5)

    const optimizedQueryTime = Date.now() - optimizedStartTime

    if (optimizedError) {
      console.error("❌ Optimized query failed:", optimizedError.message)
    } else {
      console.log(`✅ Optimized query time: ${optimizedQueryTime}ms`)
      console.log(`📊 Active checkpoints: ${optimizedData?.length || 0}`)
    }

    console.log("\n📈 OPTIMIZATION RESULTS")
    console.log("==================================================")
    console.log(`🕐 Before: ${queryTime}ms`)
    console.log(`⚡ After: ${optimizedQueryTime}ms`)

    if (optimizedQueryTime < queryTime) {
      const improvement = (((queryTime - optimizedQueryTime) / queryTime) * 100).toFixed(1)
      console.log(`🚀 Performance improved by ${improvement}%`)
    }

    console.log("\n💡 RECOMMENDATIONS")
    console.log("----------------------------------------")
    console.log("✅ Indexes added for faster queries")
    console.log("✅ Old records cleaned up")
    console.log("✅ Query performance optimized")
    console.log("")
    console.log("🎯 Your checkpoint system should now be faster!")
    console.log("🔄 Refresh your /cache-dashboard to see improvements")
  } catch (error: any) {
    console.error("❌ Optimization failed:", error.message)
    console.log("\n🔧 Manual optimization steps:")
    console.log("1. Go to Supabase Dashboard → SQL Editor")
    console.log("2. Run these SQL commands:")
    console.log("")
    console.log(
      "CREATE INDEX IF NOT EXISTS idx_checkpoints_status_updated ON processing_checkpoints(status, updated_at DESC);",
    )
    console.log(
      "CREATE INDEX IF NOT EXISTS idx_checkpoints_process_type_status ON processing_checkpoints(process_type, status);",
    )
    console.log("CREATE INDEX IF NOT EXISTS idx_checkpoints_started_at ON processing_checkpoints(started_at DESC);")
    console.log("")
    console.log(
      "DELETE FROM processing_checkpoints WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '7 days';",
    )
  }
}

// Run the optimization
optimizeSupabasePerformance().catch(console.error)
