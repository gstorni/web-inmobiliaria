"use client"

import { useState, useEffect } from "react"
import { TOKKO_PROPERTY_TYPES, getIndustrialPropertyTypes, getTopIndustrialTypes } from "@/lib/tokko-property-types"

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
  const [availableTypes, setAvailableTypes] = useState(TOKKO_PROPERTY_TYPES)

  useEffect(() => {
    if (showOnlyIndustrial) {
      if (showPriority) {
        setAvailableTypes(getTopIndustrialTypes())
      } else {
        setAvailableTypes(getIndustrialPropertyTypes())
      }
    } else {
      setAvailableTypes(TOKKO_PROPERTY_TYPES)
    }
  }, [showOnlyIndustrial, showPriority])

  if (showOnlyIndustrial) {
    return (
      <select
        className="w-full p-2 border border-gray-300 rounded-md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todos los tipos industriales</option>
        {getIndustrialPropertyTypes().map((type) => (
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
      <option value="">Todos los tipos</option>

      {/* Industrial Principal - High Priority */}
      <optgroup label="🏭 Industrial Principal">
        <option value="12">Industrial Ship (Nave Industrial)</option>
        <option value="24">Warehouse (Galpón)</option>
        <option value="14">Storage (Depósito)</option>
        <option value="27">Terreno Industrial</option>
      </optgroup>

      {/* Industrial Secundario */}
      <optgroup label="🏢 Industrial Secundario">
        <option value="16">Storage Room (Depósito Pequeño)</option>
        <option value="7">Business Premises (Local Comercial)</option>
        <option value="8">Commercial Building (Edificio Comercial)</option>
        <option value="26">Terreno Comercial</option>
      </optgroup>

      {/* Terrenos y Desarrollo */}
      <optgroup label="🏗️ Terrenos y Desarrollo">
        <option value="1">Land (Terreno)</option>
        <option value="18">Farm (Campo/Granja)</option>
        <option value="19">Ranch (Estancia)</option>
        <option value="9">Countryside (Campo)</option>
      </optgroup>

      {/* Oficinas y Servicios */}
      <optgroup label="🏢 Oficinas y Servicios">
        <option value="5">Office (Oficina)</option>
        <option value="11">Hotel</option>
        <option value="15">Business Permit (Habilitación Comercial)</option>
      </optgroup>

      {/* Residencial */}
      <optgroup label="🏠 Residencial">
        <option value="2">Apartment (Departamento)</option>
        <option value="3">House (Casa)</option>
        <option value="4">Weekend House (Casa de Fin de Semana)</option>
        <option value="13">Condo (PH)</option>
        <option value="25">Villa</option>
      </optgroup>

      {/* Especialidades */}
      <optgroup label="🚢 Especialidades">
        <option value="6">Mooring (Amarre)</option>
        <option value="20">Nautical Bed (Cama Náutica)</option>
        <option value="21">Island (Isla)</option>
        <option value="17">Wine Cellar (Bodega)</option>
        <option value="23">Terrace (Terraza)</option>
        <option value="10">Garage (Cochera)</option>
      </optgroup>
    </select>
  )
}
