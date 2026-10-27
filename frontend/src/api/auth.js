
export async function login({ email, password }) {
  let response;

  try {
    response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Il browser conserva il cookie di sessione.
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('Unable to reach the server. Please try again.');
  }

  if (response.ok) {
    // Il frontend non richiede una struttura specifica nella risposta di login.
    // Basta un codice 2xx: il server ha autenticato l'utente.
    return;
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
