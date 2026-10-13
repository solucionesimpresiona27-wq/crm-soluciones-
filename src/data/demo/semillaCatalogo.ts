/**
 * Semilla de la vista previa · catálogo: categorías (las mismas que instala la base de datos),
 * productos de ejemplo con sus costos y precios FICTICIOS por lista (mayoreo y agencia).
 * Los productos y precios públicos son los mismos que ya mostraba la vista previa.
 */
import type { Almacen } from './almacen'
import { productosBase } from './datosDemo'
import { busquedaDe, type Ctx } from './semillaContexto'

/** Mismas categorías y orden que la migración 03 (catálogo). */
const CATEGORIAS: Array<[string, string, number]> = [
  ['Impresión y publicidad', 'Vinil', 10],
  ['Impresión y publicidad', 'Lonas y gran formato', 20],
  ['Impresión y publicidad', 'Rotulación', 30],
  ['Impresión y publicidad', 'Instalación de publicidad', 40],
  ['Impresión y publicidad', 'Señalética', 50],
  ['Impresión y publicidad', 'Letreros', 60],
  ['Impresión y publicidad', 'Cuadros decorativos y resina', 70],
  ['Impresión y publicidad', 'Impresión', 80],
  ['Promocionales y personalización', 'DTF', 110],
  ['Promocionales y personalización', 'Sublimación', 120],
  ['Promocionales y personalización', 'Artículos personalizados', 130],
  ['Promocionales y personalización', 'Corte y grabado láser', 140],
  ['Producción e instalación', 'Fabricación', 210],
  ['Producción e instalación', 'Instalaciones', 220],
  ['Producción e instalación', 'Mantenimiento y remodelación', 230],
  ['Servicios digitales', 'Desarrollo web', 310],
  ['Servicios digitales', 'Inteligencia artificial y automatización', 320],
  ['Servicios digitales', 'Edición y contenido', 330],
  ['Servicios digitales', 'Publicidad digital', 340],
]

/** Id estable de una categoría a partir de su nombre. */
export const idCategoria = (nombre: string) => `cat-${busquedaDe(nombre).replace(/[^a-z0-9]+/g, '-')}`

/** Qué etapas necesita cada producto (igual criterio que la semilla de la base de datos). */
const ETAPAS: Record<string, { diseno: boolean; produccion: boolean; instalacion: boolean }> = {
  pr4: { diseno: true, produccion: true, instalacion: true },
  pr11: { diseno: false, produccion: false, instalacion: true },
  pr12: { diseno: true, produccion: false, instalacion: false },
  pr13: { diseno: true, produccion: false, instalacion: false },
  pr14: { diseno: true, produccion: false, instalacion: false },
}

export function semillaCatalogo(c: Ctx): Pick<Almacen, 'categorias' | 'productos' | 'producto_costos' | 'producto_precios'> {
  const creado = c.ts(c.mes(10).dia(5), 9)
  const categorias: Almacen['categorias'] = CATEGORIAS.map(([grupo, nombre, orden]) => ({
    id: idCategoria(nombre),
    grupo,
    nombre,
    orden,
    descripcion: null,
    activo: true,
    created_at: creado,
    updated_at: creado,
  }))

  const productos: Almacen['productos'] = productosBase.map((p) => {
    const etapas = ETAPAS[p.id] ?? { diseno: true, produccion: true, instalacion: false }
    return {
      id: p.id,
      nombre: p.nombre,
      descripcion: null,
      categoria_id: idCategoria(p.cat),
      metodo_calculo: p.metodo_calculo,
      unidad: p.unidad,
      precio_venta: p.precio_venta,
      precio_minimo: p.precio_minimo ?? null,
      escalas: p.escalas ?? [],
      sku: null,
      tiempo_entrega: null,
      requiere_diseno: etapas.diseno,
      requiere_produccion: etapas.produccion,
      requiere_instalacion: etapas.instalacion,
      activo: true,
      busqueda: busquedaDe(p.nombre, p.cat),
      created_by: 'demo-admin',
      created_at: creado,
      updated_at: creado,
    }
  })

  const producto_costos: Almacen['producto_costos'] = productosBase
    .filter((p) => p.costos)
    .map((p) => ({ producto_id: p.id, ...p.costos!, notas: null, proveedor: null, updated_at: creado }))

  // Precios por lista FICTICIOS (el público es precio_venta). Solo productos que ya tienen precio de ejemplo.
  const precios: Array<[string, 'mayoreo' | 'agencia', number, number | null, Array<{ desde: number; precio: number }>]> = [
    ['pr1', 'mayoreo', 160, 140, []],
    ['pr1', 'agencia', 150, 130, []],
    ['pr2', 'mayoreo', 235, 170, []],
    ['pr2', 'agencia', 220, 160, []],
    ['pr8', 'mayoreo', 85, null, [{ desde: 50, precio: 70 }]],
    ['pr8', 'agencia', 80, null, [{ desde: 50, precio: 66 }]],
    ['pr15', 'agencia', 380, null, []],
  ]
  const producto_precios: Almacen['producto_precios'] = precios.map(([producto_id, lista, precio, precio_minimo, escalas]) => ({
    producto_id,
    lista,
    precio,
    precio_minimo,
    escalas,
    created_at: creado,
    updated_at: creado,
  }))

  return { categorias, productos, producto_costos, producto_precios }
}
