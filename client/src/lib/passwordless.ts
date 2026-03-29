import { Client } from '@passwordlessdev/passwordless-client'

export const passwordlessClient = new Client({
  apiKey: import.meta.env.VITE_PASSWORDLESS_API_KEY ?? '',
})
