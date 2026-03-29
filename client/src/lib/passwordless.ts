import { Client } from '@passwordlessdev/passwordless-client'

let _client: Client | null = null

function client(): Client {
  if (!_client) throw new Error('Passwordless client not initialized')
  return _client
}

export function initPasswordlessClient(apiKey: string) {
  _client = new Client({ apiKey })
}

export const passwordlessClient = {
  register: (...args: Parameters<Client['register']>) => client().register(...args),
  signinWithAlias: (...args: Parameters<Client['signinWithAlias']>) =>
    client().signinWithAlias(...args),
}
