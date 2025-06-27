#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs"
import { glob } from "glob"

console.log("🧹 COMPLETE SUPABASE REMOVAL")
console.log("=".repeat(40))

interface RemovalStats {
  filesProcessed: number
  filesModified: number
  filesDeleted: number
  linesRemoved: number
  errors: string[]
}

class SupabaseRemover {
  private stats: RemovalStats = {
    filesProcessed: 0,
    filesModified: 0,
    filesDeleted: 0,
    linesRemoved: 0,
    errors: [],
  }

  async removeAll() {
    try {
      console.log("📋 Step 1: Removing Supabase files...")
      await this.removeSupabaseFiles()

      console.log("\n📋 Step 2: Cleaning code references...")
      await this.cleanCodeReferences()

      console.log("\n📋 Step 3: Updating package.json...")
      await this.updatePackageJson()

      console.log("\n📋 Step 4: Cleaning environment files...")
      await this.cleanEnvironmentFiles()

      this.printResults()
    } catch (error) {
      console.error("❌ Removal failed:", error)
      process.exit(1)
    }
  }

  private async removeSupabaseFiles() {
    const supabaseFiles = [
      "lib/supabase-client.ts",
      "lib/supabase.ts",
      "components/supabase-provider.tsx",
      "types/supabase.ts",
      "utils/supabase.ts",
      "hooks/use-supabase.ts",
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

  private async cleanCodeReferences() {
    const patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "!node_modules/**", "!.next/**"]
    const files = await glob(patterns, { cwd: process.cwd() })

    for (const file of files) {
      try {
        this.stats.filesProcessed++
        const content = readFileSync(file, "utf-8")
        const cleanedContent = this.cleanSupabaseReferences(content)

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

  private cleanSupabaseReferences(content: string): string {
    const lines = content.split("\n")
    const cleanedLines: string[] = []
    let linesRemoved = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip lines with Supabase imports
      if (this.isSupabaseImport(line)) {
        linesRemoved++
        continue
      }

      // Skip lines with Supabase client creation
      if (this.isSupabaseClientCreation(line)) {
        linesRemoved++
        continue
      }

      // Clean Supabase environment variable references
      let cleanedLine = line
      cleanedLine = cleanedLine.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/g, "null")
      cleanedLine = cleanedLine.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/g, "null")
      cleanedLine = cleanedLine.replace(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/g, "null")

      // Clean Supabase client method calls
      cleanedLine = cleanedLine.replace(/supabase\.[a-zA-Z_][a-zA-Z0-9_]*$$[^)]*$$/g, "null")
      cleanedLine = cleanedLine.replace(/getSupabaseClient$$$$/g, "null")
      cleanedLine = cleanedLine.replace(/createClient$$[^)]*supabase[^)]*$$/gi, "null")

      // Skip lines that are now just whitespace or null assignments
      if (
        cleanedLine.trim() === "null" ||
        cleanedLine.trim() === "const = null" ||
        cleanedLine.trim() === "let = null"
      ) {
        linesRemoved++
        continue
      }

      cleanedLines.push(cleanedLine)
    }

    this.stats.linesRemoved += linesRemoved

    // Clean up excessive empty lines
    let result = cleanedLines.join("\n")
    result = result.replace(/\n\s*\n\s*\n/g, "\n\n")

    return result
  }

  private isSupabaseImport(line: string): boolean {
    return (
      line.includes('from "@supabase/supabase-js"') ||
      line.includes("from '@supabase/supabase-js'") ||
      line.includes('from "@supabase/') ||
      line.includes("from '@supabase/") ||
      line.includes("/supabase-client") ||
      line.includes("/supabase.ts") ||
      /import.*supabase.*from/i.test(line)
    )
  }

  private isSupabaseClientCreation(line: string): boolean {
    return (
      (line.includes("createClient(") && (line.includes("supabase") || line.includes("SUPABASE"))) ||
      line.includes("getSupabaseClient") ||
      line.includes("getSupabaseAdminClient") ||
      /supabase.*=.*createClient/i.test(line)
    )
  }

  private async updatePackageJson() {
    try {
      const packageJsonPath = "package.json"
      if (!existsSync(packageJsonPath)) return

      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))

      const supabaseDeps = [
        "@supabase/supabase-js",
        "@supabase/auth-helpers-nextjs",
        "@supabase/auth-ui-react",
        "@supabase/auth-helpers-react",
        "@supabase/realtime-js",
      ]

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

  private async cleanEnvironmentFiles() {
    const envFiles = [".env.local", ".env", ".env.example", ".env.development"]

    for (const envFile of envFiles) {
      if (!existsSync(envFile)) continue

      try {
        let content = readFileSync(envFile, "utf-8")
        const originalContent = content

        // Remove Supabase environment variables
        const supabaseEnvPatterns = [
          /^NEXT_PUBLIC_SUPABASE_URL=.*$/gm,
          /^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/gm,
          /^SUPABASE_SERVICE_ROLE_KEY=.*$/gm,
          /^SUPABASE_PROJECT_REF=.*$/gm,
          /^SUPABASE_JWT_SECRET=.*$/gm,
          /^SUPABASE_PROJECT_ID=.*$/gm,
        ]

        supabaseEnvPatterns.forEach((pattern) => {
          content = content.replace(pattern, "")
        })

        // Clean up empty lines
        content = content.replace(/\n\s*\n\s*\n/g, "\n\n")
        content = content.trim()

        if (content !== originalContent) {
          writeFileSync(envFile, content + "\n")
          console.log(`   ✅ Cleaned: ${envFile}`)
        }
      } catch (error) {
        this.stats.errors.push(`Failed to clean ${envFile}: ${error.message}`)
      }
    }
  }

  private printResults() {
    console.log("\n" + "=".repeat(40))
    console.log("📊 SUPABASE REMOVAL COMPLETED")
    console.log("=".repeat(40))

    console.log(`📊 Statistics:`)
    console.log(`   - Files processed: ${this.stats.filesProcessed}`)
    console.log(`   - Files modified: ${this.stats.filesModified}`)
    console.log(`   - Files deleted: ${this.stats.filesDeleted}`)
    console.log(`   - Lines removed: ${this.stats.linesRemoved}`)

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`)
      this.stats.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
      if (this.stats.errors.length > 10) {
        console.log(`   ... and ${this.stats.errors.length - 10} more errors`)
      }
    }

    console.log(`\n✅ Supabase removal completed!`)
    console.log(`\n🔄 Next steps:`)
    console.log(`   1. Run: npm install`)
    console.log(`   2. Test the application: npm run dev`)
    console.log(`   3. Check for any remaining compilation errors`)
    console.log(`   4. Remove any manual references if needed`)
  }
}

// Run the removal
const remover = new SupabaseRemover()
remover.removeAll().catch(console.error)
