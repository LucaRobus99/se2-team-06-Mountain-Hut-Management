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
        err.details = Array.isArray(body?.error?.details) ? body.error.details : [];
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

// Optional account features: backend implementation must match these endpoints.
export async function updateMyProfile({ name, phone }) {
    const data = await request('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
    });
    return data.user;
}

export async function changeMyPassword({ currentPassword, newPassword }) {
    return request('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
    });
}

export async function logout() {
    try {
        await request('/api/auth/logout', { method: 'POST' });
    } catch (err) {
        // Se la sessione e' gia' scaduta, il logout lato frontend va comunque bene.
        if (err.status !== 401) throw err;
    }
}

export async function registerHiker({ name, email, phone, password, notes, emergencyContact }) {
    try {
        const data = await request('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password, notes, emergencyContact }),
        });
        return data.user;
    } catch (err) {
        if (err.code === 'EMAIL_ALREADY_REGISTERED') {
            err.message = 'This email already has an account. Please log in instead.';
            throw err;
        }
        throw err;
    }
}
