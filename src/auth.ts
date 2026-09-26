import Keycloak from 'keycloak-js'

// Keycloak (IndiaMoonMars realm) is served behind Nginx at /auth
export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? `${window.location.origin}/auth`,
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'IndiaMoonMars',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'imm-frontend',
})

export async function initAuth(): Promise<void> {
  await keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false })
}

/** Logged-in username (Keycloak lower-cases it); this is the crew ID used across IMM-OS APIs. */
export function currentUser(): string {
  return (keycloak.tokenParsed?.preferred_username as string | undefined) ?? ''
}

export function hasRole(role: string): boolean {
  return keycloak.hasRealmRole(role)
}

export function logout(): void {
  keycloak.logout({ redirectUri: window.location.origin })
}

/** fetch() that refreshes the access token when needed and sends it as a Bearer token. */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  try {
    await keycloak.updateToken(30)
  } catch {
    await keycloak.login()
    throw new Error('Session expired')
  }
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${keycloak.token}`)
  return fetch(input, { ...init, headers })
}
