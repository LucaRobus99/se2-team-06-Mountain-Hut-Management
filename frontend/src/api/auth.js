
export async function login({ email, password }) {
  let response;

  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Il browser conserva il cookie di sessione.
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Unable to reach the server. Please try again.');
  }

  if (response.ok) {
    // La risposta contiene l'utente autenticato: { user: { id, email, displayName, role, phone } }.
    const data = await response.json().catch(() => null);
    return data?.user ?? null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Incorrect email or password.');
  }

  if (response.status === 404) {
    throw new Error('The login service is not available yet.');
  }

  if (response.status >= 500) {
    throw new Error('A server error occurred. Please try again later.');
  }

  // Il backend Mountain Hut usa errori JSON con un campo "detail".
  const errorData = await response.json().catch(() => null);
  throw new Error(errorData?.detail || 'Login failed. Please try again.');
}

export async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (!response.ok) return null; // 401: nessuna sessione attiva.
    const data = await response.json();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Anche se il server non risponde, l'utente viene disconnesso lato client.
  }
}
