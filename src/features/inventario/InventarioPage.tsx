import * as Tooltip from '@radix-ui/react-tooltip'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { SegmentedControl } from '@/components/glass'
import { useSeccionesVisibles } from '@/components/shell/usarModulos'
import GastosVista from './gastos/GastosVista'
import MaterialesVista from './materiales/MaterialesVista'
import MovimientosVista from './movimientos/MovimientosVista'
import ProveedoresVista from './proveedores/ProveedoresVista'

/**
 * Inventario (/inventario/*): materiales, movimientos, proveedores y gastos.
 * Acciones rápidas: /inventario?nuevo=1 (alta de material), /inventario?bajo=1 (stock bajo),
 * /inventario/movimientos?material=<id>, /inventario/gastos?registrar=1.
 */
export default function InventarioPage() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const secciones = useSeccionesVisibles('/inventario')
  const actual = [...secciones].sort((a, b) => b.ruta.length - a.ruta.length).find((s) => pathname === s.ruta || pathname.startsWith(`${s.ruta}/`))?.ruta ?? '/inventario'

  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="flex flex-col gap-4 pt-1">
        {secciones.length > 1 ? (
          <SegmentedControl
            etiqueta="Secciones de inventario"
            segmentos={secciones.map((s) => ({ valor: s.ruta, etiqueta: s.titulo }))}
            valor={actual}
            onCambio={(r) => navegar(r)}
            className="w-full overflow-x-auto sm:w-auto sm:self-start"
          />
        ) : null}
        <Routes>
          <Route index element={<MaterialesVista />} />
          <Route path="movimientos" element={<MovimientosVista />} />
          <Route path="proveedores" element={<ProveedoresVista />} />
          <Route path="gastos" element={<GastosVista />} />
          <Route path="*" element={<MaterialesVista />} />
        </Routes>
      </div>
    </Tooltip.Provider>
  )
}
