#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs"
import { glob } from "glob"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🧹 REMOVING SUPABASE DEPENDENCIES")
console.log("=".repeat(40))

interface CleanupStats {
  filesScanned: number
  filesModified: number
  importsRemoved: number
  referencesRemoved: number
  filesDeleted: number
  errors: string[]
}

class SupabaseCleanup {
  private stats: CleanupStats = {
    filesScanned: 0,
    filesModified: 0,
    importsRemoved: 0,
    referencesRemoved: 0,
    filesDeleted: 0,
    errors: [],
  }

  async cleanup() {
    try {
      console.log("📋 Step 1: Scanning for Supabase references...")
      await this.scanAndCleanFiles()

      console.log("\n📋 Step 2: Removing Supabase-specific files...")
      await this.removeSupabaseFiles()

      console.log("\n📋 Step 3: Updating package.json...")
      await this.updatePackageJson()

      console.log("\n📋 Step 4: Cleaning environment variables...")
      await this.cleanEnvironmentVariables()

      this.printResults()
    } catch (error) {
      console.error("❌ Cleanup failed:", error)
      process.exit(1)
    }
  }

  private async scanAndCleanFiles() {
    const patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "!node_modules/**", "!.next/**", "!dist/**"]

    const files = await glob(patterns, { cwd: process.cwd() })

    for (const file of files) {
      try {
        this.stats.filesScanned++
        const content = readFileSync(file, "utf-8")
        const cleanedContent = this.cleanFileContent(content, file)

        if (content !== cleanedContent) {
          writeFileSync(file, cleanedContent)
          this.stats.filesModified++
          console.log(`   ✅ Cleaned: ${file}`)
        }
      } catch (error) {
        this.stats.errors.push(`Failed to process ${file}: ${error.message}`)
      }
    }
  }

  private cleanFileContent(content: string, filename: string): string {
    let cleaned = content

    // Remove Supabase imports
    const supabaseImportPatterns = [
      /import.*from\s+['"]@supabase\/supabase-js['"];?\n?/g,
      /import.*from\s+['"]\.\.?\/.*supabase.*['"];?\n?/g,
      /import\s*{\s*[^}]*supabase[^}]*\s*}\s*from.*['"];?\n?/gi,
    ]

    supabaseImportPatterns.forEach((pattern) => {
      const matches = cleaned.match(pattern)
      if (matches) {
        this.stats.importsRemoved += matches.length
        cleaned = cleaned.replace(pattern, "")
      }
    })

    // Remove Supabase client references
    const supabaseReferencePatterns = [
      /supabase\.[a-zA-Z_][a-zA-Z0-9_]*$$[^)]*$$/g,
      /getSupabaseClient$$$$/g,
      /getSupabaseAdminClient$$$$/g,
      /createClient$$[^)]*supabase[^)]*$$/gi,
    ]

    supabaseReferencePatterns.forEach((pattern) => {
      const matches = cleaned.match(pattern)
      if (matches) {
        this.stats.referencesRemoved += matches.length
        // Replace with placeholder comments
        cleaned = cleaned.replace(pattern, "")
      }
    })

    // Remove Supabase-specific environment variable references
    cleaned = cleaned.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/g, "/* Supabase URL removed */")
    cleaned = cleaned.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/g, "/* Supabase key removed */")
    cleaned = cleaned.replace(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/g, "/* Supabase service key removed */")

    // Clean up empty lines and comments
    cleaned = cleaned.replace(/\/\* Supabase reference removed \*\/\s*\n?/g, "")
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n") // Remove excessive empty lines

    return cleaned
  }

  private async removeSupabaseFiles() {
    const supabaseFiles = [
      "lib/supabase-client.ts",
      "lib/supabase.ts",
      "components/supabase-provider.tsx",
      "types/supabase.ts",
      "utils/supabase.ts",
    ]

    for (const file of supabaseFiles) {
      if (existsSync(file)) {
        try {
          unlinkSync(file)
          this.stats.filesDeleted++
          console.log(`   🗑️ Deleted: ${file}`)
        } catch (error) {
          this.stats.errors.push(`Failed to delete ${file}: ${error.message}`)
        }
      }
    }
  }

  private async updatePackageJson() {
    try {
      const packageJsonPath = "package.json"
      if (!existsSync(packageJsonPath)) return

      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))

      // Remove Supabase dependencies
      const supabaseDeps = ["@supabase/supabase-js", "@supabase/auth-helpers-nextjs", "@supabase/auth-ui-react"]

      let removed = false
      supabaseDeps.forEach((dep) => {
        if (packageJson.dependencies?.[dep]) {
          delete packageJson.dependencies[dep]
          removed = true
          console.log(`   📦 Removed dependency: ${dep}`)
        }
        if (packageJson.devDependencies?.[dep]) {
          delete packageJson.devDependencies[dep]
          removed = true
          console.log(`   📦 Removed dev dependency: ${dep}`)
        }
      })

      if (removed) {
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
        console.log("   ✅ Updated package.json")
      }
    } catch (error) {
      this.stats.errors.push(`Failed to update package.json: ${error.message}`)
    }
  }

  private async cleanEnvironmentVariables() {
    try {
      const envFiles = [".env.local", ".env", ".env.example"]

      for (const envFile of envFiles) {
        if (!existsSync(envFile)) continue

        let content = readFileSync(envFile, "utf-8")
        const originalContent = content

        // Remove Supabase environment variables
        const supabaseEnvPatterns = [
          /NEXT_PUBLIC_SUPABASE_URL=.*\n?/g,
          /NEXT_PUBLIC_SUPABASE_ANON_KEY=.*\n?/g,
          /SUPABASE_SERVICE_ROLE_KEY=.*\n?/g,
          /SUPABASE_PROJECT_REF=.*\n?/g,
          /SUPABASE_JWT_SECRET=.*\n?/g,
        ]

        supabaseEnvPatterns.forEach((pattern) => {
          content = content.replace(pattern, "")
        })

        // Clean up empty lines
        content = content.replace(/\n\s*\n\s*\n/g, "\n\n")

        if (content !== originalContent) {
          writeFileSync(envFile, content)
          console.log(`   ✅ Cleaned: ${envFile}`)
        }
      }
    } catch (error) {
      this.stats.errors.push(`Failed to clean environment variables: ${error.message}`)
    }
  }

  private printResults() {
    console.log("\n" + "=".repeat(40))
    console.log("📊 SUPABASE CLEANUP COMPLETED")
    console.log("=".repeat(40))

    console.log(`📊 Statistics:`)
    console.log(`   - Files scanned: ${this.stats.filesScanned}`)
    console.log(`   - Files modified: ${this.stats.filesModified}`)
    console.log(`   - Imports removed: ${this.stats.importsRemoved}`)
    console.log(`   - References removed: ${this.stats.referencesRemoved}`)
    console.log(`   - Files deleted: ${this.stats.filesDeleted}`)

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`)
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
    }

    console.log(`\n✅ Supabase cleanup completed!`)
    console.log(`\n🔄 Next steps:`)
    console.log(`   1. Run: npm install (to update dependencies)`)
    console.log(`   2. Run: npx tsx scripts/fix-hot-properties-constraint.sql`)
    console.log(`   3. Test the application: npm run dev`)
    console.log(`   4. Remove any remaining manual references`)
  }
}

// Run cleanup
const cleanup = new SupabaseCleanup()
cleanup.cleanup().catch(console.error)
