const API_BASE = 'http://localhost:4000/api';
let authFailureHandler = null;

function getToken() {
  return localStorage.getItem('study_token');
}

function createApiError(message, { status, code, recoverable }) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.recoverable = recoverable;
  return error;
}

async function parseResponseData(response, responseType) {
  if (responseType === 'blob') {
    if (!response.ok) {
      return response.json().catch(() => ({}));
    }
    return response.blob();
  }
  return response.json().catch(() => ({}));
}

async function request(path, options = {}, responseType = 'json') {
  const token = getToken();
  const hasFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        ...(hasFormDataBody ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw createApiError('Cannot reach server at localhost:4000', {
      code: 'NETWORK',
      recoverable: true,
    });
  }

  const data = await parseResponseData(response, responseType);
  if (!response.ok) {
    const message = data?.error || 'Request failed';
    if (response.status === 401) {
      const authError = createApiError(message, {
        status: 401,
        code: 'AUTH',
        recoverable: false,
      });
      if (token && !path.startsWith('/auth/') && typeof authFailureHandler === 'function') {
        authFailureHandler(authError);
      }
      throw authError;
    }

    throw createApiError(message, {
      status: response.status,
      code: 'HTTP',
      recoverable: response.status >= 500,
    });
  }

  return data;
}

export const api = {
  register: (email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request('/me'),
  listSessions: () => request('/sessions'),
  createSession: (payload) =>
    request('/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSession: (id, payload) =>
    request(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  settings: () => request('/settings'),
  updateSettings: (payload) =>
    request('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  stats: (range = 'week', cursor) => {
    const params = new URLSearchParams({ range });
    if (cursor) params.set('cursor', cursor);
    return request(`/stats?${params.toString()}`);
  },
  listSubjects: () => request('/subjects'),
  createSubject: (payload) =>
    request('/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSubject: (id, payload) =>
    request(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteSubject: (id) =>
    request(`/subjects/${id}`, {
      method: 'DELETE',
    }),
  exportData: () => request('/data/export', {}, 'blob'),
  importData: (payload) =>
    request('/data/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetData: () =>
    request('/data/reset', {
      method: 'DELETE',
    }),
  account: () => request('/account'),
  updateProfile: (displayName) =>
    request('/account/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),
  updateEmail: (email, currentPassword) =>
    request('/account/email', {
      method: 'PUT',
      body: JSON.stringify({ email, currentPassword }),
    }),
  updatePassword: (currentPassword, newPassword) =>
    request('/account/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  deleteAccount: (currentPassword) =>
    request('/account', {
      method: 'DELETE',
      body: JSON.stringify({ currentPassword }),
    }),
  logoutAllSessions: (currentPassword) =>
    request('/security/logout-all', {
      method: 'POST',
      body: JSON.stringify({ currentPassword }),
    }),
};

export function setToken(token) {
  localStorage.setItem('study_token', token);
}

export function clearToken() {
  localStorage.removeItem('study_token');
}

export function setAuthFailureHandler(handler) {
  authFailureHandler = typeof handler === 'function' ? handler : null;
}
