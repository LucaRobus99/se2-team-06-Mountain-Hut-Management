export async function createMenu(input) {
  let response;
  try {
    response = await fetch('/api/menus', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Cannot connect to the hut server. Please try again.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Unable to save the menu.');
    error.details = body?.error?.details || [];
    throw error;
  }
  return body;
}
