const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user_id: string;
    email: string;
    username: string;
    account_name?: string;
    profile_image?: string;
    token: string;
  };
}

export interface User {
  user_id: string;
  email: string;
  username: string;
  account_name?: string;
  profile_image?: string;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data?: {
    account_name?: string;
    profile_image?: string;
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function registerUser(email: string, username: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || 'Registration failed');
  return data;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || 'Login failed');
  return data;
}

export async function getCurrentUser(token: string): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function uploadProfileImage(token: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/profile/upload-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    // Không set Content-Type — browser tự set multipart/form-data + boundary
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Upload ảnh thất bại');
  return data.data.image_url; // URL Cloudinary
}

export async function updateProfile(
  token: string,
  payload: { account_name?: string; profile_image?: string }
): Promise<ProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || 'Update profile failed');
  return data;
}

export async function updateAccountName(token: string, account_name: string): Promise<ProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/profile/name`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ account_name }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || 'Update name failed');
  return data;
}

export async function updateProfileImage(token: string, image_url: string): Promise<ProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/profile/image`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ image_url }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.message || 'Update image failed');
  return data;
}