// TokkoBroker Development Types - Official List
export const TOKKO_DEVELOPMENT_TYPES = [
  { code: "OB", id: 1, name: "Office Building", nameEs: "Edificio de Oficinas" },
  { code: "BU", id: 2, name: "Building", nameEs: "Edificio" },
  { code: "CC", id: 3, name: "Country club", nameEs: "Country Club" },
  { code: "PN", id: 4, name: "Private Neighborhood", nameEs: "Barrio Privado" },
  { code: "NA", id: 5, name: "Nautical", nameEs: "Náutico" },
  { code: "RU", id: 6, name: "Rural", nameEs: "Rural" },
  { code: "PL", id: 7, name: "Parking Lot Building", nameEs: "Edificio de Cocheras" },
  { code: "IC", id: 8, name: "Industrial Condo", nameEs: "Condominio Industrial" },
  { code: "LC", id: 9, name: "Logistic Center", nameEs: "Centro Logístico" },
  { code: "CO", id: 10, name: "Condominio", nameEs: "Condominio" },
  { code: "OT", id: 11, name: "Otro", nameEs: "Otro" },
  { code: "CM", id: 12, name: "Comercial", nameEs: "Comercial" },
  { code: "13", id: 13, name: "Hotel", nameEs: "Hotel" },
  { code: "BA", id: 14, name: "Barrio Abierto", nameEs: "Barrio Abierto" },
] as const

// Industrial Development Types (most relevant for industrial properties)
export const INDUSTRIAL_DEVELOPMENT_TYPES = [
  { id: 8, name: "Industrial Condo", nameEs: "Condominio Industrial", code: "IC" },
  { id: 9, name: "Logistic Center", nameEs: "Centro Logístico", code: "LC" },
  { id: 12, name: "Comercial", nameEs: "Comercial", code: "CM" },
  { id: 7, name: "Parking Lot Building", nameEs: "Edificio de Cocheras", code: "PL" },
  { id: 1, name: "Office Building", nameEs: "Edificio de Oficinas", code: "OB" },
  { id: 6, name: "Rural", nameEs: "Rural", code: "RU" },
] as const

// Helper functions
export function getDevelopmentTypeById(id: number) {
  return TOKKO_DEVELOPMENT_TYPES.find((type) => type.id === id)
}

export function getDevelopmentTypeByCode(code: string) {
  return TOKKO_DEVELOPMENT_TYPES.find((type) => type.code === code)
}

export function getIndustrialDevelopmentTypes() {
  return INDUSTRIAL_DEVELOPMENT_TYPES
}

export function isIndustrialDevelopment(typeId: number): boolean {
  return INDUSTRIAL_DEVELOPMENT_TYPES.some((type) => type.id === typeId)
}

// Development type categories for filtering
export const DEVELOPMENT_CATEGORIES = {
  industrial: {
    name: "Industrial y Logístico",
    icon: "🏭",
    types: [8, 9, 12, 7],
  },
  commercial: {
    name: "Comercial y Oficinas",
    icon: "🏢",
    types: [1, 12, 13],
  },
  residential: {
    name: "Residencial",
    icon: "🏠",
    types: [2, 3, 4, 10, 14],
  },
  specialty: {
    name: "Especialidades",
    icon: "🌊",
    types: [5, 6, 11],
  },
} as const
