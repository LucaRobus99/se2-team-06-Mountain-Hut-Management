// Autenticazione REALE: nessun mock.
// Con il proxy Vite, /api viene inoltrato al backend Express (localhost:8080).

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...options
    });
  } catch {
    throw new Error('Unable to reach the server. Make sure the backend is running.');
  }

  const body = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    const err = new Error(body?.error?.message || 'The request could not be completed.');
    err.status = response.status;
    err.code = body?.error?.code;
    throw err;
  }
  return body;
}

export async function login({ email, password }) {
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return data.user;
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS') {
      throw new Error('Incorrect email or password.');
    }
    throw err;
  }
}

export async function getCurrentUser() {
  try {
    const data = await request('/api/auth/me');
    return data.user;
  } catch (err) {
    // Non autenticato e' uno stato normale, non un errore di rete.
    if (err.status === 401) return null;
    throw err;
  }
}

export async function logout() {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // Se la sessione e' gia' scaduta, il logout lato frontend va comunque bene.
    if (err.status !== 401) throw err;
  }
}
