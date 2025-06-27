"use client"

interface PropertyTypeFilterProps {
  value: string
  onChange: (value: string) => void
  showOnlyIndustrial?: boolean
  showPriority?: boolean
}

export function PropertyTypeFilter({
  value,
  onChange,
  showOnlyIndustrial = false,
  showPriority = false,
}: PropertyTypeFilterProps) {
  // Map based on actual database content
  const actualPropertyTypes = [
    // Industrial Principal (high priority)
    { id: "12", code: "IS", name: "Nave Industrial", count: 43, priority: 1 },
    { id: "14", code: "ST", name: "Depósito", count: 119, priority: 1 },
    { id: "27", code: "IL", name: "Terreno Industrial", count: 3, priority: 1 },

    // Industrial Secundario
    { id: "7", code: "LO", name: "Local Comercial", count: 1, priority: 2 },
    { id: "26", code: "CL", name: "Terreno Comercial", count: 2, priority: 2 },

    // Oficinas y Servicios
    { id: "5", code: "OF", name: "Oficina", count: 11, priority: 3 },

    // Terrenos y Desarrollo
    { id: "1", code: "LA", name: "Terreno", count: 41, priority: 3 },

    // Residencial
    { id: "2", code: "AP", name: "Departamento", count: 4, priority: 4 },
    { id: "13", code: "PH", name: "PH", count: 1, priority: 4 },
    { id: "3", code: "HO", name: "Casa", count: 1, priority: 4 },
  ]

  const getFilteredTypes = () => {
    if (showOnlyIndustrial) {
      return actualPropertyTypes.filter((type) => type.priority <= 2)
    }
    return actualPropertyTypes
  }

  const filteredTypes = getFilteredTypes()

  return (
    <select
      className="w-full p-2 border border-gray-300 rounded-md"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Todos los tipos</option>

      {/* Industrial Principal - High Priority */}
      <optgroup label="🏭 Industrial Principal">
        <option value="12">Nave Industrial ({actualPropertyTypes.find((t) => t.id === "12")?.count || 0})</option>
        <option value="14">Depósito ({actualPropertyTypes.find((t) => t.id === "14")?.count || 0})</option>
        <option value="27">Terreno Industrial ({actualPropertyTypes.find((t) => t.id === "27")?.count || 0})</option>
      </optgroup>

      {/* Industrial Secundario */}
      <optgroup label="🏢 Industrial Secundario">
        <option value="7">Local Comercial ({actualPropertyTypes.find((t) => t.id === "7")?.count || 0})</option>
        <option value="26">Terreno Comercial ({actualPropertyTypes.find((t) => t.id === "26")?.count || 0})</option>
      </optgroup>

      {/* Oficinas y Servicios */}
      <optgroup label="🏢 Oficinas y Servicios">
        <option value="5">Oficina ({actualPropertyTypes.find((t) => t.id === "5")?.count || 0})</option>
      </optgroup>

      {/* Terrenos y Desarrollo */}
      <optgroup label="🏗️ Terrenos y Desarrollo">
        <option value="1">Terreno ({actualPropertyTypes.find((t) => t.id === "1")?.count || 0})</option>
      </optgroup>

      {/* Residencial */}
      <optgroup label="🏠 Residencial">
        <option value="2">Departamento ({actualPropertyTypes.find((t) => t.id === "2")?.count || 0})</option>
        <option value="13">PH ({actualPropertyTypes.find((t) => t.id === "13")?.count || 0})</option>
        <option value="3">Casa ({actualPropertyTypes.find((t) => t.id === "3")?.count || 0})</option>
      </optgroup>
    </select>
  )
}
