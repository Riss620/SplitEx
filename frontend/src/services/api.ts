/**
 * SplitEx API Client
 * ===================
 * Handles all HTTP communication with the backend.
 *
 * Auth Strategy:
 *   - Access Token (15min): stored in-memory (not localStorage — XSS safe)
 *   - Refresh Token (7d):   stored in httpOnly cookie (XSS-proof, CSRF-safe with SameSite)
 *
 * Cross-Origin Deployment:
 *   - Frontend: Vercel  (e.g., https://splitex.vercel.app)
 *   - Backend:  Render  (e.g., https://splitex-api.onrender.com)
 *   - cookies require: credentials:'include' on ALL requests
 *   - CORS must have: credentials:true + matching origin
 *   - Cookie must have: sameSite:'none', secure:true in production
 *
 * VITE_API_URL env var:
 *   - local dev: http://localhost:3001/api  (set in frontend/.env)
 *   - production: https://your-backend.onrender.com/api (set in Vercel env vars)
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// In-memory access token store (never touches localStorage)
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export const apiRequest = async (path: string, options: RequestOptions = {}) => {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  // Attach access token if available
  if (!options.skipAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    // CRITICAL: must be 'include' for cookies to be sent cross-origin
    // Without this, the refreshToken cookie is never sent to Render from Vercel
    credentials: 'include',
  });

  // ── Silent Token Refresh ──────────────────────────────────────────────────
  // If access token expired (401), try refreshing using the httpOnly cookie.
  // On success, retry the original request with the new access token.
  if (response.status === 401 && !options.skipAuth) {
    try {
      loggerDebug('Access token expired, attempting silent refresh...');

      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // CRITICAL: send the refreshToken cookie
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        accessToken = refreshData.accessToken;

        // Retry the original request with the fresh access token
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${accessToken}`);
        if (!(options.body instanceof FormData)) {
          retryHeaders.set('Content-Type', 'application/json');
        }

        const retryResponse = await fetch(url, {
          ...options,
          headers: retryHeaders,
          credentials: 'include',
        });

        if (!retryResponse.ok) {
          const errData = await retryResponse.json().catch(() => ({}));
          throw new Error(errData.message || 'Request failed after token refresh');
        }
        return await retryResponse.json();
      } else {
        // Refresh failed (token expired or revoked) — force logout
        accessToken = null;
        window.dispatchEvent(new Event('auth-expired'));
        throw new Error('Session expired. Please log in again.');
      }
    } catch (err: any) {
      throw err;
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `API error ${response.status}`);
  }

  return await response.json();
};

const loggerDebug = (msg: string) => {
  if (import.meta.env.DEV) {
    console.debug(`[API Client]: ${msg}`);
  }
};
