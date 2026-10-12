const API_BASE = '/api/v1';

export interface ApiError {
  status: number;
  code?: string;
  message: string;
}

class ApiClient {
  private getAccessToken(): string | null {
    return localStorage.getItem('bitaran_access_token');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('bitaran_refresh_token');
  }

  private getActiveOrgId(): string | null {
    return localStorage.getItem('bitaran_active_org_id');
  }

  public setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('bitaran_access_token', accessToken);
    localStorage.setItem('bitaran_refresh_token', refreshToken);
  }

  public clearTokens(): void {
    localStorage.removeItem('bitaran_access_token');
    localStorage.removeItem('bitaran_refresh_token');
    localStorage.removeItem('bitaran_active_org_id');
    localStorage.removeItem('bitaran_user');
    localStorage.removeItem('bitaran_memberships');
  }

  public setActiveOrgId(orgId: string): void {
    localStorage.setItem('bitaran_active_org_id', orgId);
  }

  private async refreshTokens(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        this.clearTokens();
        return null;
      }

      const data = await res.json();
      if (data.accessToken && data.refreshToken) {
        this.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      }
      return null;
    } catch {
      this.clearTokens();
      return null;
    }
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    let token = this.getAccessToken();
    const orgId = this.getActiveOrgId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (orgId) {
      headers['X-Org-Id'] = orgId;
    }

    let url = endpoint.startsWith('/') ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`;

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (response.status === 401 && token) {
      const newToken = await this.refreshTokens();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // empty response
      }

      const message =
        errorData?.error?.message ||
        errorData?.message ||
        `Request failed with status ${response.status}`;
      const code = errorData?.error?.code || errorData?.code || 'ERROR';

      const err: ApiError = {
        status: response.status,
        code,
        message,
      };
      throw err;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  public get<T>(endpoint: string, queryParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
    let url = endpoint;
    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      }
      const qs = params.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
