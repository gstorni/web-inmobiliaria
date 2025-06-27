"use client"

import {
  TOKKO_DEVELOPMENT_TYPES,
  DEVELOPMENT_CATEGORIES,
  getIndustrialDevelopmentTypes,
} from "@/lib/tokko-development-types"

interface DevelopmentTypeFilterProps {
  value: string
  onChange: (value: string) => void
  showOnlyIndustrial?: boolean
}

export function DevelopmentTypeFilter({ value, onChange, showOnlyIndustrial = false }: DevelopmentTypeFilterProps) {
  if (showOnlyIndustrial) {
    return (
      <select
        className="w-full p-2 border border-gray-300 rounded-md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todos los desarrollos industriales</option>
        {getIndustrialDevelopmentTypes().map((type) => (
          <option key={type.id} value={type.id.toString()}>
            {type.nameEs} ({type.name})
          </option>
        ))}
      </select>
    )
  }

  return (
    <select
      className="w-full p-2 border border-gray-300 rounded-md"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Todos los desarrollos</option>

      {/* Industrial & Logistic */}
      <optgroup label="🏭 Industrial y Logístico">
        {DEVELOPMENT_CATEGORIES.industrial.types.map((typeId) => {
          const type = TOKKO_DEVELOPMENT_TYPES.find((t) => t.id === typeId)
          return type ? (
            <option key={type.id} value={type.id.toString()}>
              {type.nameEs} ({type.name})
            </option>
          ) : null
        })}
      </optgroup>

      {/* Commercial & Office */}
      <optgroup label="🏢 Comercial y Oficinas">
        {DEVELOPMENT_CATEGORIES.commercial.types.map((typeId) => {
          const type = TOKKO_DEVELOPMENT_TYPES.find((t) => t.id === typeId)
          return type ? (
            <option key={type.id} value={type.id.toString()}>
              {type.nameEs} ({type.name})
            </option>
          ) : null
        })}
      </optgroup>

      {/* Residential */}
      <optgroup label="🏠 Residencial">
        {DEVELOPMENT_CATEGORIES.residential.types.map((typeId) => {
          const type = TOKKO_DEVELOPMENT_TYPES.find((t) => t.id === typeId)
          return type ? (
            <option key={type.id} value={type.id.toString()}>
              {type.nameEs} ({type.name})
            </option>
          ) : null
        })}
      </optgroup>

      {/* Specialty */}
      <optgroup label="🌊 Especialidades">
        {DEVELOPMENT_CATEGORIES.specialty.types.map((typeId) => {
          const type = TOKKO_DEVELOPMENT_TYPES.find((t) => t.id === typeId)
          return type ? (
            <option key={type.id} value={type.id.toString()}>
              {type.nameEs} ({type.name})
            </option>
          ) : null
        })}
      </optgroup>
    </select>
  )
}
