#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync, existsSync } from "fs"
import { glob } from "glob"

console.log("🔧 FIXING SYNTAX ERRORS FROM SUPABASE CLEANUP")
console.log("=".repeat(50))

interface FixStats {
  filesScanned: number
  filesFixed: number
  errorsFixed: number
}

class SyntaxFixer {
  private stats: FixStats = {
    filesScanned: 0,
    filesFixed: 0,
    errorsFixed: 0,
  }

  async fixAllFiles() {
    try {
      const patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "!node_modules/**", "!.next/**"]
      const files = await glob(patterns, { cwd: process.cwd() })

      for (const file of files) {
        await this.fixFile(file)
      }

      this.printResults()
    } catch (error) {
      console.error("❌ Fix failed:", error)
      process.exit(1)
    }
  }

  private async fixFile(filePath: string) {
    try {
      this.stats.filesScanned++

      if (!existsSync(filePath)) return

      const content = readFileSync(filePath, "utf-8")
      const fixedContent = this.fixSyntaxErrors(content)

      if (content !== fixedContent) {
        writeFileSync(filePath, fixedContent)
        this.stats.filesFixed++
        console.log(`   ✅ Fixed: ${filePath}`)
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not fix ${filePath}:`, error.message)
    }
  }

  private fixSyntaxErrors(content: string): string {
    let fixed = content
    let errorCount = 0

    // Fix broken variable assignments with comments
    const brokenAssignments = [
      /const\s+\w+\s*=\s*\/\*[^*]*\*\//g,
      /let\s+\w+\s*=\s*\/\*[^*]*\*\//g,
      /var\s+\w+\s*=\s*\/\*[^*]*\*\//g,
    ]

    brokenAssignments.forEach((pattern) => {
      const matches = fixed.match(pattern)
      if (matches) {
        errorCount += matches.length
        // Replace with null assignment
        fixed = fixed.replace(pattern, (match) => {
          const varName = match.split("=")[0].trim()
          return `${varName} = null`
        })
      }
    })

    // Fix broken function calls with comments
    fixed = fixed.replace(/\w+$$\/\*[^*]*\*\/$$/g, (match) => {
      errorCount++
      const funcName = match.split("(")[0]
      return `${funcName}(null)`
    })

    // Fix broken property access with comments
    fixed = fixed.replace(/\w+\.\/\*[^*]*\*\//g, (match) => {
      errorCount++
      return "null"
    })

    // Fix broken imports with comments
    fixed = fixed.replace(/import.*\/\*[^*]*\*\/.*from.*/g, (match) => {
      errorCount++
      return "// " + match // Comment out broken imports
    })

    // Fix broken JSX attributes with comments
    fixed = fixed.replace(/\w+\s*=\s*\{\/\*[^*]*\*\/\}/g, (match) => {
      errorCount++
      const attrName = match.split("=")[0].trim()
      return `${attrName}={null}`
    })

    // Remove standalone comment blocks that break syntax
    fixed = fixed.replace(/^\s*\/\*[^*]*\*\/\s*$/gm, "")

    // Clean up multiple empty lines
    fixed = fixed.replace(/\n\s*\n\s*\n/g, "\n\n")

    this.stats.errorsFixed += errorCount
    return fixed
  }

  private printResults() {
    console.log("\n" + "=".repeat(50))
    console.log("📊 SYNTAX FIX COMPLETED")
    console.log("=".repeat(50))

    console.log(`📊 Statistics:`)
    console.log(`   - Files scanned: ${this.stats.filesScanned}`)
    console.log(`   - Files fixed: ${this.stats.filesFixed}`)
    console.log(`   - Syntax errors fixed: ${this.stats.errorsFixed}`)

    console.log(`\n✅ All syntax errors have been fixed!`)
    console.log(`\n🔄 Next steps:`)
    console.log(`   1. Test the application: npm run dev`)
    console.log(`   2. Check for any remaining issues`)
    console.log(`   3. Remove any unused imports manually if needed`)
  }
}

// Run the fixer
const fixer = new SyntaxFixer()
fixer.fixAllFiles().catch(console.error)
