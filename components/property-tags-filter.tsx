"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import { INDUSTRIAL_PROPERTY_TAGS } from "@/lib/tokko-property-tags"

interface PropertyTagsFilterProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  showOnlyIndustrial?: boolean
}

export function PropertyTagsFilter({ selectedTags, onTagsChange, showOnlyIndustrial = true }: PropertyTagsFilterProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["industrial_equipment"])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  const handleTagToggle = (tagId: string) => {
    const newTags = selectedTags.includes(tagId) ? selectedTags.filter((id) => id !== tagId) : [...selectedTags, tagId]
    onTagsChange(newTags)
  }

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTags.filter((id) => id !== tagId))
  }

  const clearAllTags = () => {
    onTagsChange([])
  }

  if (showOnlyIndustrial) {
    // Group industrial tags by category
    const industrialTagsByCategory = INDUSTRIAL_PROPERTY_TAGS.reduce(
      (acc, tag) => {
        if (!acc[tag.category]) acc[tag.category] = []
        acc[tag.category].push(tag)
        return acc
      },
      {} as Record<string, typeof INDUSTRIAL_PROPERTY_TAGS>,
    )

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Características Industriales</h3>
          {selectedTags.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllTags} className="text-xs">
              Limpiar todo
            </Button>
          )}
        </div>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Filtros activos:</p>
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tagId) => {
                const tag = INDUSTRIAL_PROPERTY_TAGS.find((t) => t.id.toString() === tagId)
                return tag ? (
                  <Badge
                    key={tagId}
                    variant="secondary"
                    className="flex items-center gap-1 cursor-pointer hover:bg-red-100 text-xs"
                    onClick={() => removeTag(tagId)}
                  >
                    <span>{tag.nameEs}</span>
                    <X className="h-3 w-3" />
                  </Badge>
                ) : null
              })}
            </div>
          </div>
        )}

        {/* Industrial Categories */}
        <div className="space-y-3">
          {Object.entries(industrialTagsByCategory).map(([category, tags]) => {
            const isExpanded = expandedCategories.includes(category)
            const categoryNames = {
              equipment: "🏭 Equipamiento",
              infrastructure: "⚡ Infraestructura",
              spaces: "🏢 Espacios",
              features: "🔧 Características",
              security: "🛡️ Seguridad",
            }

            return (
              <div key={category} className="border rounded-lg p-3">
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-medium">
                    {categoryNames[category as keyof typeof categoryNames] || category}
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`tag-${tag.id}`}
                          checked={selectedTags.includes(tag.id.toString())}
                          onChange={() => handleTagToggle(tag.id.toString())}
                          className="mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`tag-${tag.id}`} className="text-xs cursor-pointer">
                          {tag.nameEs}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Full categories view (if needed)
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Características y Amenities</h3>
      {/* Implementation for full categories would go here */}
    </div>
  )
}
