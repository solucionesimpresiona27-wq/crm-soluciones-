/**
 * Semilla de la vista previa · sistema: equipo (con una cuenta desactivada), enlaces del
 * portal del cliente con sus respuestas y una bitácora de ejemplo. DATOS FICTICIOS.
 */
import { dinero } from '@/lib/format'
import type { Perfil, Rol } from '../tipos'
import type { Almacen } from './almacen'
import { perfilesDemo } from './datosDemo'
import { registrarBitacora } from './reglas'
import type { Ctx } from './semillaContexto'

/** Los 4 perfiles de ejemplo del inicio de sesión más un instalador y una cuenta desactivada. */
export function semillaPerfiles(c: Ctx): { porRol: Record<Rol, Perfil>; todos: Perfil[] } {
  const porRol = perfilesDemo()
  const alta = c.ts(c.mes(6).dia(1), 9)
  for (const p of Object.values(porRol)) {
    p.created_at = alta
    p.updated_at = alta
    p.ultimo_acceso = c.ts(c.hoy, 8, 30)
  }
  const extra: Perfil[] = [
    {
      ...porRol.produccion,
      id: 'demo-instalador',
      nombre: 'Pedro Álvarez',
      email: 'instalacion@demo.local',
      puesto: 'Instalación',
      ultimo_acceso: c.ts(c.dia(-1), 18),
    },
    {
      ...porRol.ventas,
      id: 'demo-ventas-2',
      nombre: 'Mariana Soto',
      email: 'mostrador@demo.local',
      puesto: 'Mostrador (temporada)',
      activo: false,
      comision_pct: 3,
      ultimo_acceso: c.ts(c.mes(2).dia(20), 18),
    },
  ]
  return { porRol, todos: [...Object.values(porRol), ...extra] }
}

/** Enlaces del portal: vigentes, uno revocado y uno vencido; con las respuestas de los clientes. */
export function semillaPortal(a: Almacen, c: Ctx) {
  const cot = (id: string) => a.cotizaciones.find((x) => x.id === id)!
  const dias = (fecha: string, n: number) => new Date(new Date(fecha).getTime() + n * 86_400_000).toISOString()
  const enlace = (
    id: string,
    tipo: 'cotizacion' | 'pedido',
    doc: string,
    token: string,
    creado: string,
    vigencia: number,
    extra: Partial<Almacen['portal_enlaces'][number]> = {},
  ): Almacen['portal_enlaces'][number] => ({
    id,
    token,
    tipo,
    cotizacion_id: tipo === 'cotizacion' ? doc : null,
    pedido_id: tipo === 'pedido' ? doc : null,
    expira_at: dias(creado, vigencia),
    revocado: false,
    revocado_at: null,
    revocado_por: null,
    vistas: 0,
    ultimo_acceso_at: null,
    created_by: 'demo-ventas',
    created_at: creado,
    ...extra,
  })
  const pedido5 = a.pedidos.find((p) => p.id === 'demo-ped-5')!
  a.portal_enlaces = [
    enlace('demo-enl-1', 'cotizacion', 'demo-cot-1', 'vista-previa-COT-0001-enlace-ficticio-7Hq2', c.ts(cot('demo-cot-1').fecha, 17, 5), 30, {
      vistas: 3,
      ultimo_acceso_at: c.ts(c.hoy, 9, 12),
    }),
    enlace('demo-enl-2', 'pedido', 'demo-ped-5', 'vista-previa-PED-0044-enlace-ficticio-K9w4', pedido5.created_at, 30, {
      vistas: 6,
      ultimo_acceso_at: c.ts(c.hoy, 8, 47),
      created_by: 'demo-admin',
    }),
    enlace('demo-enl-3', 'cotizacion', 'demo-cot-3', 'vista-previa-COT-0003-enlace-ficticio-Z2m8', c.ts(cot('demo-cot-3').fecha, 17, 2), 30, {
      vistas: 2,
      ultimo_acceso_at: cot('demo-cot-3').aceptada_at,
      created_by: 'demo-admin',
    }),
    enlace('demo-enl-4', 'cotizacion', 'demo-cot-6', 'vista-previa-COT-0006-enlace-ficticio-R5t1', c.ts(cot('demo-cot-6').fecha, 17, 0), 30, {
      revocado: true,
      revocado_at: c.ts(c.dia(-3), 13),
      revocado_por: 'demo-ventas',
      vistas: 1,
    }),
    enlace('demo-enl-5', 'pedido', 'demo-h1-1', 'vista-previa-pedido-anterior-vencido-Q8p3', c.ts(c.mes(1).dia(24), 12), 7, {
      vistas: 4,
      created_by: 'demo-admin',
    }),
  ]
  a.portal_respuestas = [
    {
      id: a.folios.respuesta++,
      enlace_id: 'demo-enl-3',
      accion: 'aprobar_cotizacion',
      cotizacion_id: 'demo-cot-3',
      pedido_id: null,
      archivo_id: null,
      nombre: 'Dra. Mariana Gil',
      comentario: 'Adelante, por favor. El anticipo se transfiere hoy.',
      ip: null,
      user_agent: 'Vista previa (dato ficticio)',
      created_at: cot('demo-cot-3').aceptada_at ?? c.ts(c.dia(-4), 12),
    },
    {
      id: a.folios.respuesta++,
      enlace_id: 'demo-enl-2',
      accion: 'cambios_diseno',
      cotizacion_id: null,
      pedido_id: 'demo-ped-5',
      archivo_id: 'demo-arch-1',
      nombre: 'Ing. Roberto Salas',
      comentario: 'Cambiar el teléfono de ventas por el 33 0000 0000.',
      ip: null,
      user_agent: 'Vista previa (dato ficticio)',
      created_at: a.archivos.find((x) => x.id === 'demo-arch-1')?.aprobacion_at ?? c.ts(c.dia(-3), 16),
    },
  ]
}

/** Bitácora de ejemplo a partir de los registros sembrados (las acciones en la demo agregan más). */
export function semillaBitacora(a: Almacen, c: Ctx) {
  const limite = c.ts(c.dia(-12), 0)
  const entradas: Array<Parameters<typeof registrarBitacora>[1]> = []
  for (const p of a.pedidos.filter((x) => x.created_at >= limite)) {
    entradas.push({ tabla: 'pedidos', registro_id: p.id, accion: 'crear', etiqueta: `${p.folio} · ${p.titulo}`, usuario_id: p.created_by, created_at: p.created_at })
    if (p.estado === 'cancelado') {
      entradas.push({ tabla: 'pedidos', registro_id: p.id, accion: 'cancelar', etiqueta: `${p.folio} · ${p.titulo}`, cambios: { estado: ['nuevo', 'cancelado'] }, usuario_id: 'demo-admin', created_at: p.cancelado_at ?? p.updated_at })
    }
  }
  for (const pg of a.pagos.filter((x) => x.created_at >= limite)) {
    const folio = a.pedidos.find((p) => p.id === pg.pedido_id)?.folio ?? 'pedido'
    entradas.push({ tabla: 'pagos', registro_id: pg.id, accion: 'crear', etiqueta: `Pago de ${dinero(pg.importe)} · ${folio}`, usuario_id: pg.registrado_por, created_at: pg.created_at })
  }
  for (const q of a.cotizaciones.filter((x) => x.enviada_at && x.enviada_at >= limite)) {
    entradas.push({ tabla: 'cotizaciones', registro_id: q.id, accion: 'cambio_estado', etiqueta: `${q.folio} · ${q.titulo ?? ''}`.trim(), cambios: { estado: ['borrador', 'enviada'] }, usuario_id: q.vendedor?.id ?? null, created_at: q.enviada_at! })
  }
  for (const g of a.gastos.filter((x) => x.created_at >= limite)) {
    entradas.push({ tabla: 'gastos', registro_id: g.id, accion: g.cancelado ? 'cancelar' : 'crear', etiqueta: `Gasto de ${dinero(g.monto)} · ${g.concepto}`, usuario_id: g.usuario_id, created_at: g.created_at })
  }
  for (const k of a.cortes_caja) {
    const [y, m, d] = k.fecha.split('-')
    entradas.push({ tabla: 'cortes_caja', registro_id: k.id, accion: 'crear', etiqueta: `Corte de caja del ${d}/${m}/${y}`, usuario_id: k.cerrado_por, created_at: k.created_at })
  }
  for (const r of a.portal_respuestas) {
    entradas.push({ tabla: 'portal_respuestas', registro_id: String(r.id), accion: r.accion === 'cambios_diseno' ? 'cambio_estado' : 'aprobar', etiqueta: `${r.nombre} respondió desde el portal`, usuario_id: null, created_at: r.created_at })
  }
  entradas.push({ tabla: 'configuracion', registro_id: '1', accion: 'modificar', etiqueta: 'Configuración del negocio', cambios: { vigencia_dias: [30, 15] }, usuario_id: 'demo-admin', created_at: c.ts(c.dia(-20), 10) })
  entradas.push({ tabla: 'perfiles', registro_id: 'demo-ventas-2', accion: 'modificar', etiqueta: 'Mariana Soto', cambios: { activo: [true, false] }, usuario_id: 'demo-admin', created_at: c.ts(c.mes(2).dia(21), 10) })
  entradas.sort((x, y) => (x.created_at ?? '').localeCompare(y.created_at ?? ''))
  for (const e of entradas) registrarBitacora(a, e)
  // Los cambios hechos desde el portal se atribuyen al cliente
  for (const b of a.bitacora) if (b.tabla === 'portal_respuestas') b.usuario_nombre = 'Cliente (portal)'
}
