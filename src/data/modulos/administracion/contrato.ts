/**
 * MÓDULO ADMINISTRACIÓN · contrato de datos.
 * Espacios: `api.configuracion` (datos del negocio y logo), `api.plantillas` (mensajes de
 * WhatsApp), `api.usuarios` (equipo, roles, permisos y cuentas) y `api.bitacora`.
 *
 * Permisos: leer configuración, plantillas activas y el equipo, cualquier usuario activo.
 * Todo lo demás es solo de administración. Altas, contraseñas, correo y (des)activación de
 * cuentas pasan por la función del servidor `admin-usuarios` (la llave secreta nunca llega al navegador).
 * RFC y razón social de la empresa solo se imprimen si `mostrar_datos_fiscales` está activo.
 */
import type { Configuracion, Perfil, Permiso, Plantilla, Rol } from '@/data/tipos'
import type { Json, Tables } from '@/lib/database.types'

export type { Configuracion, Plantilla }

/** Lo que la administración puede editar de la configuración (sin id ni fechas). */
export type CambiosConfiguracion = Partial<Omit<Configuracion, 'id' | 'updated_at'>>

/**
 * Lo que cualquier usuario activo ve de sus compañeros (para elegir responsables).
 * Correo, teléfono, permisos, comisión y último acceso solo los ve administración o la propia persona.
 */
export type MiembroEquipo = Pick<Perfil, 'id' | 'nombre' | 'rol' | 'puesto'>

/** Usuario del CRM con sus permisos personalizados (solo los que difieren del rol). */
export type Usuario = Perfil & { permisos_personalizados: Partial<Record<Permiso, boolean>> }

export interface NuevoUsuario {
  email: string
  /** Al menos 8 caracteres, con letras y números */
  password: string
  nombre: string
  rol: Rol
  telefono?: string | null
  puesto?: string | null
}

export interface CambiosUsuario {
  nombre?: string
  telefono?: string | null
  puesto?: string | null
  rol?: Rol
  /** % de comisión sobre lo cobrado sin IVA */
  comision_pct?: number
}

export type EntradaBitacora = Tables<'bitacora'>

export interface FiltrosBitacora {
  tabla?: string
  usuarioId?: string
  registroId?: string
  accion?: 'crear' | 'modificar' | 'eliminar' | 'cambio_estado' | 'aprobar' | 'cancelar'
  /** AAAA-MM-DD */
  desde?: string
  hasta?: string
  /** Busca en la etiqueta */
  texto?: string
  limite?: number
  /** Paginación: entradas con id menor a este */
  antesDe?: number
}

export interface ApiAdministracion {
  configuracion: {
    obtener(): Promise<Configuracion>
    /** Guarda solo los campos enviados. Solo administración. */
    guardar(cambios: CambiosConfiguracion): Promise<Configuracion>
    /** Sube el logo (PNG, JPG, WebP o SVG, máx. 2 MB) y lo deja en la configuración. */
    subirLogo(archivo: File | Blob): Promise<Configuracion>
    quitarLogo(): Promise<Configuracion>
  }
  plantillas: {
    /** Plantillas ACTIVAS por orden (las usan los botones de WhatsApp). */
    listar(): Promise<Plantilla[]>
    /** Todas, incluidas las desactivadas (pantalla de configuración). Solo administración. */
    todas(): Promise<Plantilla[]>
    /** Edita nombre, texto, orden o activa/desactiva. Variables: {cliente}, {folio}, {total}, {enlace}… */
    guardar(id: string, cambios: Partial<Pick<Plantilla, 'nombre' | 'texto' | 'activo' | 'orden'>>): Promise<Plantilla>
    /** Nueva plantilla propia. La clave es única (minúsculas y guiones bajos). */
    crear(datos: Pick<Plantilla, 'clave' | 'nombre' | 'contexto' | 'texto'> & { orden?: number }): Promise<Plantilla>
  }
  usuarios: {
    /** Equipo activo (selectores de responsable, vendedor…). */
    equipo(): Promise<MiembroEquipo[]>
    /** Todos los usuarios, activos primero. Solo administración. */
    listar(): Promise<Usuario[]>
    /** Alta con contraseña inicial (función admin-usuarios). */
    crear(datos: NuevoUsuario): Promise<{ id: string }>
    /** Nombre, teléfono, puesto, rol y comisión. Solo administración (o uno mismo sin rol ni comisión). */
    actualizar(id: string, cambios: CambiosUsuario): Promise<Usuario>
    /**
     * Permisos distintos a los de su rol: true concede, false quita, null vuelve al del rol.
     * Administración siempre tiene todos.
     */
    cambiarPermisos(id: string, permisos: Partial<Record<Permiso, boolean | null>>): Promise<Usuario>
    /** Activa o desactiva la cuenta (no se puede desactivar la propia ni al último administrador). */
    activar(id: string, activo: boolean): Promise<void>
    restablecerContrasena(id: string, password: string): Promise<void>
    cambiarEmail(id: string, email: string): Promise<void>
  }
  bitacora: {
    /** Quién creó, cambió, aprobó o canceló qué (lo más reciente primero). Solo administración. */
    listar(filtros?: FiltrosBitacora): Promise<EntradaBitacora[]>
  }
}

/** Para mostrar los cambios de la bitácora: {campo: [antes, después]}. */
export type CambiosBitacora = Record<string, [Json, Json]>
