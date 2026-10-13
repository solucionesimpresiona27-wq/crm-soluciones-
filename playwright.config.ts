import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de punta a punta contra la app REAL y Supabase local.
 * Requisitos: `supabase start`, `node scripts/sembrar-local.mjs` y `.env.local` apuntando a Supabase local.
 */
const puerto = Number(process.env.E2E_PUERTO ?? 5181)

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${puerto}`,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] }, testMatch: /movil\.spec\.ts/ },
  ],
  webServer: {
    command: `npx vite --port ${puerto} --host 127.0.0.1`,
    url: `http://127.0.0.1:${puerto}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
