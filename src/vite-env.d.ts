/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_DEMO?: string
  /** Solo vista previa: 'memoria' para publicar dentro de un visor sin URL propia */
  readonly VITE_RUTAS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
