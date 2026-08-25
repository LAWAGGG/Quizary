import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Dynamic host setup: auto-detect LAN IP from Expo dev server
const getHost = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants.manifest as any)?.debuggerHost ||
    (Constants.manifest2 as any)?.extra?.expoGo?.developer?.tool;
  if (hostUri) {
    const ip = String(hostUri).split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') return `http://${ip}:8000/api`;
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000/api';
  return 'http://localhost:8000/api';
};

export const BASE_URL = getHost();
const TOKEN_KEY = 'quizary_auth_token';

// ── TOKEN STORAGE ────────────────────────────────────────────
export async function saveToken(token: string) {
  try {
    if (Platform.OS === 'web') localStorage.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) { console.error('saveToken error', err); }
}

export async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch { return null; }
}

export async function removeToken() {
  try {
    if (Platform.OS === 'web') localStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) { console.error('removeToken error', err); }
}

function extractErrorMessage(err: any, defaultMsg: string): string {
  if (typeof err.message === 'string') return err.message;
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail) && err.detail.length > 0 && err.detail[0].msg)
    return err.detail[0].msg;
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const firstKey = Object.keys(err.errors[0])[0];
    return err.errors[0][firstKey] || defaultMsg;
  }
  return defaultMsg;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) await removeToken();
      throw new Error(extractErrorMessage(errorData, `Request failed (${response.status})`));
    }
    return response.json();
  } catch (err: any) {
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    ) {
      throw new Error(
        `Gagal terhubung ke ${BASE_URL}.\n\nPastikan uvicorn dijalankan dengan --host 0.0.0.0`
      );
    }
    throw err;
  }
}

async function fetchMultipart(endpoint: string, method: string, formData: FormData) {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body: formData });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, `Request failed (${response.status})`));
  }
  return response.json();
}

// ── 1. AUTHENTICATION ────────────────────────────────────────
export async function apiLogin(body: { email: string; password: string }) {
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, 'Email atau password salah.'));
    }
    const data = await res.json();
    if (data.token) await saveToken(data.token);
    return data;
  } catch (err: any) {
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    )
      throw new Error(
        `Gagal terhubung ke ${BASE_URL}.\n\nPastikan uvicorn dijalankan dengan --host 0.0.0.0`
      );
    throw err;
  }
}

export async function apiRegister(body: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, 'Registrasi gagal. Email mungkin sudah terdaftar.'));
    }
    const data = await res.json();
    if (data.token) await saveToken(data.token);
    return data;
  } catch (err: any) {
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    )
      throw new Error(
        `Gagal terhubung ke ${BASE_URL}.\n\nPastikan uvicorn dijalankan dengan --host 0.0.0.0`
      );
    throw err;
  }
}

export async function apiLogout() {
  try { await fetchWithAuth('/logout', { method: 'POST' }); } catch {}
  await removeToken();
}

export async function getMe() {
  return fetchWithAuth('/me');
}

export async function updateProfile(body: { name?: string }) {
  return fetchWithAuth('/me', { method: 'PUT', body: JSON.stringify(body) });
}

// ── 2. DASHBOARD ─────────────────────────────────────────────
export async function getDashboardSummary() {
  return fetchWithAuth('/dashboard/summary');
}

// ── 3. FORMS ─────────────────────────────────────────────────
export async function fetchMyForms(params?: {
  status?: string;
  type?: string;
  page?: number;
  per_page?: number;
}) {
  const qp = new URLSearchParams();
  if (params?.status) qp.append('status', params.status);
  if (params?.type) qp.append('type', params.type);
  if (params?.page) qp.append('page', String(params.page));
  if (params?.per_page) qp.append('per_page', String(params.per_page));
  const query = qp.toString() ? `?${qp.toString()}` : '';
  return fetchWithAuth(`/forms${query}`);
}

export async function createForm(body: {
  title: string;
  description?: string;
  type: 'form' | 'quiz';
  require_login?: boolean;
  submission_limit?: string;
}) {
  return fetchWithAuth('/forms', { method: 'POST', body: JSON.stringify(body) });
}

export async function getFormDetail(formId: string | number) {
  return fetchWithAuth(`/forms/${formId}`);
}

export async function updateForm(formId: string | number, body: any) {
  return fetchWithAuth(`/forms/${formId}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function deleteForm(formId: string | number) {
  return fetchWithAuth(`/forms/${formId}`, { method: 'DELETE' });
}

export async function publishForm(
  formId: string | number,
  status: 'published' | 'draft' | 'closed' = 'published'
) {
  return fetchWithAuth(`/forms/${formId}/publish`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Banner
export async function uploadBanner(formId: string | number, fileUri: string, mimeType = 'image/jpeg') {
  const fd = new FormData();
  const filename = fileUri.split('/').pop() || 'banner.jpg';
  fd.append('banner', { uri: fileUri, name: filename, type: mimeType } as any);
  return fetchMultipart(`/forms/${formId}/banner`, 'POST', fd);
}

export async function deleteBanner(formId: string | number) {
  return fetchWithAuth(`/forms/${formId}/banner`, { method: 'DELETE' });
}

// ── 4. QUESTIONS ─────────────────────────────────────────────
export async function getQuestions(formId: string | number) {
  return fetchWithAuth(`/forms/${formId}/questions`);
}

export async function createQuestion(formId: string | number, body: any) {
  return fetchWithAuth(`/forms/${formId}/questions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateQuestion(questionId: string | number, body: any) {
  return fetchWithAuth(`/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteQuestion(questionId: string | number) {
  return fetchWithAuth(`/questions/${questionId}`, { method: 'DELETE' });
}

export async function uploadQuestionImage(questionId: string | number, fileUri: string, mimeType = 'image/jpeg') {
  const fd = new FormData();
  const filename = fileUri.split('/').pop() || 'question_image.jpg';
  fd.append('file', { uri: fileUri, name: filename, type: mimeType } as any);
  return fetchMultipart(`/questions/${questionId}/image`, 'POST', fd);
}

export async function uploadOptionImage(questionId: string | number, optionId: string | number, fileUri: string, mimeType = 'image/jpeg') {
  const fd = new FormData();
  const filename = fileUri.split('/').pop() || 'option_image.jpg';
  fd.append('file', { uri: fileUri, name: filename, type: mimeType } as any);
  return fetchMultipart(`/questions/${questionId}/option/${optionId}/image`, 'POST', fd);
}

export async function reorderQuestions(formId: string | number, orders: number[]) {
  return fetchWithAuth('/questions/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ form_id: Number(formId), orders }),
  });
}

// Import DOCX
export async function importDocx(formId: string | number, fileUri: string) {
  const fd = new FormData();
  const filename = fileUri.split('/').pop() || 'questions.docx';
  fd.append('file', {
    uri: fileUri,
    name: filename,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  } as any);
  return fetchMultipart(`/forms/${formId}/import/docx`, 'POST', fd);
}

// ── 5. PUBLIC ACCESS (RESPONDENT / GUEST) ────────────────────
export async function getPublicForm(shortCode: string) {
  let cleanCode = (shortCode || '').trim();
  if (cleanCode.includes('/q/')) {
    const parts = cleanCode.split('/q/');
    cleanCode = parts[parts.length - 1].split('/')[0].split('?')[0];
  }
  const res = await fetch(`${BASE_URL}/q/${cleanCode.toUpperCase()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Quiz / Form tidak ditemukan atau belum dipublikasikan.'));
  }
  return res.json();
}

export async function checkCanStart(shortCode: string) {
  return fetchWithAuth(`/q/${shortCode}/start`);
}

// ── 6. SUBMISSION ─────────────────────────────────────────────
export async function createSubmission(
  formId: string | number,
  name?: string,
  email?: string
) {
  const body: any = { form_id: Number(formId) };
  if (name) body.respondent_name = name;
  if (email) body.respondent_email = email;
  return fetchWithAuth('/submissions', { method: 'POST', body: JSON.stringify(body) });
}

export async function autosaveAnswer(
  submissionId: string | number,
  payload: { question_id: number; option_ids?: number[]; answer_text?: string }
) {
  return fetchWithAuth(`/submissions/${submissionId}/autosave`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function finalizeSubmission(submissionId: string | number) {
  return fetchWithAuth(`/submissions/${submissionId}/submit`, { method: 'POST' });
}

export async function getSubmissionDetail(submissionId: string | number) {
  return fetchWithAuth(`/submissions/${submissionId}`);
}

export async function getMySubmissions() {
  return fetchWithAuth('/me/submissions');
}

export async function uploadAnswerFile(
  submissionId: string | number,
  questionId: string | number,
  fileUri: string,
  mimeType = 'image/jpeg'
) {
  const fd = new FormData();
  const filename = fileUri.split('/').pop() || 'answer_file.jpg';
  fd.append('file', { uri: fileUri, name: filename, type: mimeType } as any);
  return fetchMultipart(`/submissions/${submissionId}/questions/${questionId}/upload`, 'POST', fd);
}

// ── 7. RESULTS & ANALYTICS ───────────────────────────────────
export async function getFormResults(
  formId: string | number,
  params?: { status?: string; page?: number; per_page?: number; sort?: string }
) {
  const qp = new URLSearchParams();
  if (params?.status) qp.append('status', params.status);
  if (params?.page) qp.append('page', String(params.page));
  if (params?.per_page) qp.append('per_page', String(params.per_page));
  if (params?.sort) qp.append('sort', params.sort);
  const query = qp.toString() ? `?${qp.toString()}` : '';
  return fetchWithAuth(`/forms/${formId}/results${query}`);
}

export async function getFormAnalytics(formId: string | number) {
  return fetchWithAuth(`/forms/${formId}/analytics`);
}
