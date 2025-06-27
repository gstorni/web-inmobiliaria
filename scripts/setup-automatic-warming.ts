import dotenv from "dotenv"
import { writeFileSync, readFileSync } from "fs"
import { join } from "path"

dotenv.config({ path: ".env.local" })

function setupAutomaticWarming() {
  console.log("🔧 Setting up automatic cache warming")
  console.log("=".repeat(50))

  // Create a cron job script
  const cronScript = `#!/bin/bash
# Automatic Redis Cache Warming
# Runs every 2 hours to keep cache fresh

cd ${process.cwd()}
npx tsx scripts/warm-redis-cache.ts --max=100 --quiet
`

  // Write the cron script
  const cronPath = join(process.cwd(), "scripts", "auto-warm-cache.sh")
  writeFileSync(cronPath, cronScript, { mode: 0o755 })
  console.log(`✅ Created cron script: ${cronPath}`)

  // Create a systemd timer (for Linux systems)
  const systemdService = `[Unit]
Description=Redis Cache Warming Service
After=network.target

[Service]
Type=oneshot
User=${process.env.USER || "www-data"}
WorkingDirectory=${process.cwd()}
ExecStart=/usr/bin/npx tsx scripts/warm-redis-cache.ts --max=100 --quiet
Environment=NODE_ENV=production
`

  const systemdTimer = `[Unit]
Description=Redis Cache Warming Timer
Requires=redis-cache-warming.service

[Timer]
OnCalendar=*:0/120  # Every 2 hours
Persistent=true

[Install]
WantedBy=timers.target
`

  // Write systemd files
  const servicePath = join(process.cwd(), "scripts", "redis-cache-warming.service")
  const timerPath = join(process.cwd(), "scripts", "redis-cache-warming.timer")

  writeFileSync(servicePath, systemdService)
  writeFileSync(timerPath, systemdTimer)

  console.log(`✅ Created systemd service: ${servicePath}`)
  console.log(`✅ Created systemd timer: ${timerPath}`)

  // Create a Node.js monitoring script
  const monitorScript = `// Automatic Cache Monitoring and Warming
import { enhancedHybridCacheService } from '../lib/enhanced-hybrid-cache-service'

async function autoWarmCache() {
  try {
    const stats = enhancedHybridCacheService.getEnhancedStats()
    
    // Warm cache if hit rate is below 70%
    if (stats.hitRates.redis < 70) {
      console.log(\`🔥 Auto-warming cache (hit rate: \${stats.hitRates.redis.toFixed(1)}%)\`)
      await enhancedHybridCacheService.performPredictiveWarming()
    }
    
    // Log performance metrics
    console.log(\`📊 Cache Status: \${stats.hitRates.redis.toFixed(1)}% hit rate, \${stats.capacity.redisSize} properties cached\`)
    
  } catch (error) {
    console.error('❌ Auto-warming failed:', error.message)
  }
}

// Run every 30 minutes
setInterval(autoWarmCache, 30 * 60 * 1000)
autoWarmCache() // Run immediately

export { autoWarmCache }
`

  const monitorPath = join(process.cwd(), "scripts", "auto-monitor.ts")
  writeFileSync(monitorPath, monitorScript)
  console.log(`✅ Created monitoring script: ${monitorPath}`)

  // Update package.json with scripts
  try {
    const packagePath = join(process.cwd(), "package.json")
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"))

    if (!packageJson.scripts) packageJson.scripts = {}

    packageJson.scripts["cache:warm"] = "tsx scripts/warm-redis-cache.ts"
    packageJson.scripts["cache:monitor"] = "tsx scripts/monitor-cache-performance.ts"
    packageJson.scripts["cache:test"] = "tsx scripts/test-cache-hit-rate.ts"
    packageJson.scripts["cache:auto"] = "tsx scripts/auto-monitor.ts"

    writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
    console.log("✅ Updated package.json with cache scripts")
  } catch (error) {
    console.warn("⚠️ Could not update package.json:", error.message)
  }

  console.log("\n🎯 SETUP COMPLETE!")
  console.log("=".repeat(50))
  console.log("Available commands:")
  console.log("• npm run cache:warm    - Warm the cache manually")
  console.log("• npm run cache:monitor - Monitor cache performance")
  console.log("• npm run cache:test    - Test current hit rate")
  console.log("• npm run cache:auto    - Start automatic monitoring")

  console.log("\nFor automatic warming:")
  console.log("• Cron: Add to crontab: 0 */2 * * * " + cronPath)
  console.log("• Systemd: sudo cp scripts/*.{service,timer} /etc/systemd/system/")
  console.log("• Node.js: npm run cache:auto (keeps running)")

  console.log("\n📊 Monitor your cache at: http://localhost:3000/enhanced-dashboard")
}

setupAutomaticWarming()
