// TokkoBroker Property Types - Updated Official List (26 types)
export const TOKKO_PROPERTY_TYPES = [
  { code: "LA", id: 1, name: "Land", nameEs: "Terreno" },
  { code: "AP", id: 2, name: "Apartment", nameEs: "Departamento" },
  { code: "HO", id: 3, name: "House", nameEs: "Casa" },
  { code: "WE", id: 4, name: "Weekend House", nameEs: "Casa de Fin de Semana" },
  { code: "OF", id: 5, name: "Office", nameEs: "Oficina" },
  { code: "AM", id: 6, name: "Mooring", nameEs: "Amarre" },
  { code: "LO", id: 7, name: "Business Premises", nameEs: "Local Comercial" },
  { code: "CO", id: 8, name: "Commercial Building", nameEs: "Edificio Comercial" },
  { code: "CS", id: 9, name: "Countryside", nameEs: "Campo" },
  { code: "GA", id: 10, name: "Garage", nameEs: "Cochera" },
  { code: "HL", id: 11, name: "Hotel", nameEs: "Hotel" },
  { code: "IS", id: 12, name: "Industrial Ship", nameEs: "Nave Industrial" },
  { code: "PH", id: 13, name: "Condo", nameEs: "PH" },
  { code: "ST", id: 14, name: "Storage", nameEs: "Depósito" },
  { code: "FC", id: 15, name: "Business Permit", nameEs: "Habilitación Comercial" },
  { code: "SR", id: 16, name: "Storage Room", nameEs: "Depósito Pequeño" },
  { code: "WI", id: 17, name: "Wine Cellar", nameEs: "Bodega" },
  { code: "FA", id: 18, name: "Farm", nameEs: "Campo/Granja" },
  { code: "CH", id: 19, name: "Ranch", nameEs: "Estancia" },
  { code: "CN", id: 20, name: "Nautical Bed", nameEs: "Cama Náutica" },
  { code: "IS", id: 21, name: "Island", nameEs: "Isla" }, // Note: Same code as ID 12, different meaning
  { code: "TE", id: 23, name: "Terrace", nameEs: "Terraza" },
  { code: "GL", id: 24, name: "Warehouse", nameEs: "Galpón" }, // NEW: Very important for industrial
  { code: "VL", id: 25, name: "Villa", nameEs: "Villa" },
  { code: "CL", id: 26, name: "Terreno comercial", nameEs: "Terreno Comercial" }, // NEW: Commercial land
  { code: "IL", id: 27, name: "Terreno industrial", nameEs: "Terreno Industrial" }, // NEW: Industrial land
] as const

// Industrial and Commercial Property Types (most relevant for your business)
export const INDUSTRIAL_PROPERTY_TYPES = [
  { id: 12, name: "Industrial Ship", nameEs: "Nave Industrial", code: "IS", priority: 1 },
  { id: 24, name: "Warehouse", nameEs: "Galpón", code: "GL", priority: 1 }, // NEW: High priority
  { id: 14, name: "Storage", nameEs: "Depósito", code: "ST", priority: 1 },
  { id: 27, name: "Terreno industrial", nameEs: "Terreno Industrial", code: "IL", priority: 1 }, // NEW: High priority
  { id: 16, name: "Storage Room", nameEs: "Depósito Pequeño", code: "SR", priority: 2 },
  { id: 7, name: "Business Premises", nameEs: "Local Comercial", code: "LO", priority: 2 },
  { id: 8, name: "Commercial Building", nameEs: "Edificio Comercial", code: "CO", priority: 2 },
  { id: 26, name: "Terreno comercial", nameEs: "Terreno Comercial", code: "CL", priority: 2 }, // NEW
  { id: 5, name: "Office", nameEs: "Oficina", code: "OF", priority: 3 },
  { id: 10, name: "Garage", nameEs: "Cochera", code: "GA", priority: 3 },
  { id: 1, name: "Land", nameEs: "Terreno", code: "LA", priority: 3 },
] as const

// Helper functions
export function getPropertyTypeById(id: number) {
  return TOKKO_PROPERTY_TYPES.find((type) => type.id === id)
}

export function getPropertyTypeByCode(code: string) {
  return TOKKO_PROPERTY_TYPES.find((type) => type.code === code)
}

export function getIndustrialPropertyTypes() {
  return INDUSTRIAL_PROPERTY_TYPES.sort((a, b) => a.priority - b.priority)
}

export function isIndustrialProperty(typeId: number): boolean {
  return INDUSTRIAL_PROPERTY_TYPES.some((type) => type.id === typeId)
}

// Updated property type categories for filtering
export const PROPERTY_CATEGORIES = {
  industrial_primary: {
    name: "🏭 Industrial Principal",
    icon: "🏭",
    types: [12, 24, 14, 27], // Industrial Ship, Warehouse, Storage, Industrial Land
    priority: 1,
  },
  industrial_secondary: {
    name: "🏢 Industrial Secundario",
    icon: "🏢",
    types: [16, 7, 8, 26], // Storage Room, Business Premises, Commercial Building, Commercial Land
    priority: 2,
  },
  land_development: {
    name: "🏗️ Terrenos y Desarrollo",
    icon: "🏗️",
    types: [1, 27, 26, 18, 19, 9], // Land, Industrial Land, Commercial Land, Farm, Ranch, Countryside
    priority: 3,
  },
  office_services: {
    name: "🏢 Oficinas y Servicios",
    icon: "🏢",
    types: [5, 11, 15], // Office, Hotel, Business Permit
    priority: 4,
  },
  residential: {
    name: "🏠 Residencial",
    icon: "🏠",
    types: [2, 3, 4, 13, 25], // Apartment, House, Weekend House, Condo, Villa
    priority: 5,
  },
  specialty: {
    name: "🚢 Especialidades",
    icon: "🚢",
    types: [6, 20, 21, 17, 23, 10], // Mooring, Nautical Bed, Island, Wine Cellar, Terrace, Garage
    priority: 6,
  },
} as const

// Get property types by category with priority sorting
export function getPropertyTypesByCategory() {
  return Object.entries(PROPERTY_CATEGORIES)
    .sort(([, a], [, b]) => a.priority - b.priority)
    .map(([key, category]) => ({
      key,
      ...category,
      types: category.types.map((typeId) => TOKKO_PROPERTY_TYPES.find((t) => t.id === typeId)).filter(Boolean),
    }))
}

// Get high-priority industrial types for quick filters
export function getTopIndustrialTypes() {
  return INDUSTRIAL_PROPERTY_TYPES.filter((type) => type.priority === 1)
}
