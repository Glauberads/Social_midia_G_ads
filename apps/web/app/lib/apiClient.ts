import { supabase } from './supabaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public status: number, public message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('glauberads_preferred_tenant') : null;
  if (tenantId && !headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', tenantId);
  }

  if (!headers.has('Content-Type') && options.body instanceof String || typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Required to send HTTP-only session cookies cross-origin
    headers,
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    let errorData = null;
    try {
      const data = await response.json();
      errorData = data;
      errorMsg = data.message || errorMsg;
    } catch {
      // Not JSON
    }
    throw new ApiError(response.status, errorMsg, errorData);
  }

  // Se a resposta for 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}
