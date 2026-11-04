import type { LandingInput } from '@veta-roja/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface LandingSummary {
  id: string;
  slug: string;
  title: string;
  themeId: string;
  status: 'draft' | 'published';
  groupId: string | null;
  updatedAt: string;
}

export interface Landing extends LandingSummary, Omit<LandingInput, 'slug' | 'title' | 'themeId' | 'status' | 'groupId'> {}

export interface Group {
  id: string;
  name: string;
  landingCount: number;
  createdAt: string;
}

export interface UploadedImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* cuerpo sin JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (username: string, password: string) => request<{ username: string }>('POST', '/api/auth/login', { username, password }),
  me: () => request<{ username: string }>('GET', '/api/auth/me'),
  logout: () => request<void>('POST', '/api/auth/logout'),

  listLandings: () => request<LandingSummary[]>('GET', '/api/admin/landings'),
  getLanding: (id: string) => request<Landing>('GET', `/api/admin/landings/${id}`),
  createLanding: (input: LandingInput) => request<Landing>('POST', '/api/admin/landings', input),
  updateLanding: (id: string, input: LandingInput) => request<Landing>('PUT', `/api/admin/landings/${id}`, input),
  deleteLanding: (id: string) => request<void>('DELETE', `/api/admin/landings/${id}`),

  listGroups: () => request<Group[]>('GET', '/api/admin/groups'),
  createGroup: (name: string) => request<Group>('POST', '/api/admin/groups', { name }),
  renameGroup: (id: string, name: string) => request<Group>('PUT', `/api/admin/groups/${id}`, { name }),
  deleteGroup: (id: string) => request<void>('DELETE', `/api/admin/groups/${id}`),

  getDefaultCtaUrl:() => request<{ url: string | null }>('GET', '/api/admin/settings/default-cta-url'),
  setDefaultCtaUrl: (url: string | null) => request<{ url: string | null }>('PUT', '/api/admin/settings/default-cta-url', { url }),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<UploadedImage>('POST', '/api/admin/images', form);
  },
};
