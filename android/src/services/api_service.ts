import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

const getHost = () => {
  let envUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (envUrl) {
    envUrl = envUrl.replace(/\/+$/, '');
    if (!envUrl.endsWith('/api')) {
      envUrl += '/api';
    }
    return envUrl;
  }

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
const USER_KEY = 'quizary_auth_user';

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

export async function saveUser(user: any) {
  try {
    const serialized = JSON.stringify(user);
    if (Platform.OS === 'web') localStorage.setItem(USER_KEY, serialized);
    else await SecureStore.setItemAsync(USER_KEY, serialized);
  } catch (err) { console.error('saveUser error', err); }
}

export async function getStoredUser(): Promise<any | null> {
  try {
    const raw = Platform.OS === 'web' ? localStorage.getItem(USER_KEY) : await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function removeStoredUser() {
  try {
    if (Platform.OS === 'web') localStorage.removeItem(USER_KEY);
    else await SecureStore.deleteItemAsync(USER_KEY);
  } catch (err) { console.error('removeStoredUser error', err); }
}

export async function removeToken() {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (err) { console.error('removeToken error', err); }
}

function extractErrorMessage(err: any, defaultMsg: string): string {
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const first = err.errors[0];
    const firstKey = Object.keys(first)[0];
    const val = first[firstKey];
    if (typeof val === 'string' && val) return val;
    // Handle _schema errors (password_confirmation mismatch etc)
    if (first['_schema'] || first['_errors']) return first['_schema'] || first['_errors'] || defaultMsg;
  }
  if (Array.isArray(err.detail) && err.detail.length > 0 && err.detail[0].msg)
    return err.detail[0].msg;
  if (typeof err.detail === 'string') return err.detail;
  if (typeof err.message === 'string' && err.message !== 'Invalid fields') return err.message;
  // Fallback: if message is generic Invalid fields but errors exist, show first error
  if (typeof err.message === 'string') return err.message;
  return defaultMsg;
}

let activeSubmissionToken: string | null = null;

export function setSubmissionToken(token: string | null) {
  activeSubmissionToken = token;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (activeSubmissionToken) headers['X-Submission-Token'] = activeSubmissionToken;
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) await removeToken();
      throw new Error(extractErrorMessage(errorData, `Request failed (${response.status})`));
    }
    return response.json();
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('CLEARTEXT') || msg.includes('10.0.2.2')) {
      throw new Error('Koneksi HTTP 10.0.2.2 diblokir (CLEARTEXT). Build APK pakai EXPO_PUBLIC_API_URL=https://<tunnel>.trycloudflare.com/api lalu rebuild --clear-cache.');
    }
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    ) {
      throw new Error('Gagal terhubung ke server.');
    }
    throw err;
  }
}

async function fetchMultipart(endpoint: string, method: string, formData: FormData) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (activeSubmissionToken) headers['X-Submission-Token'] = activeSubmissionToken;

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, { method, headers, body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, `Upload failed (${response.status})`));
    }
    return response.json();
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('CLEARTEXT') || msg.includes('10.0.2.2')) {
      throw new Error('Koneksi HTTP diblokir (CLEARTEXT). Pakai https tunnel untuk APK.');
    }
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    ) {
      throw new Error('Gagal terhubung ke server saat mengunggah file.');
    }
    throw err;
  }
}

export async function apiLogin(body: { email: string; password: string }) {
  try {
    console.log('[DEBUG AUTH] Sending POST to:', `${BASE_URL}/login`, 'for email:', body.email);
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log('[DEBUG AUTH] POST /login failed:', res.status, err);
      throw new Error(extractErrorMessage(err, 'Email atau password salah.'));
    }
    const data = await res.json();
    console.log('[DEBUG AUTH] POST /login response data:', JSON.stringify(data));
    if (data.token) await saveToken(data.token);
    if (data.user) await saveUser(data.user);
    return data;
  } catch (err: any) {
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    )
      throw new Error('Gagal terhubung ke server.');
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
    console.log('[DEBUG AUTH] Sending POST /register for:', body.name, body.email);
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log('[DEBUG AUTH] POST /register failed:', res.status, err);
      throw new Error(extractErrorMessage(err, 'Registrasi gagal. Email mungkin sudah terdaftar.'));
    }
    const data = await res.json();
    console.log('[DEBUG AUTH] POST /register response data:', JSON.stringify(data));
    if (data.token) await saveToken(data.token);
    if (data.user) await saveUser(data.user);
    return data;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('CLEARTEXT') || msg.includes('10.0.2.2')) {
      throw new Error('Koneksi HTTP diblokir (CLEARTEXT). Build ulang APK dengan EXPO_PUBLIC_API_URL=https://<tunnel>/api');
    }
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    )
      throw new Error('Gagal terhubung ke server.');
    throw err;
  }
}

// FUNGSI VERIFIKASI OTP
export async function verifyOtpApi(body: { email: string; code: string }) {
  try {
    console.log('[DEBUG AUTH] Sending POST /otp/verify for:', body.email);
    const res = await fetch(`${BASE_URL}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log('[DEBUG AUTH] POST /otp/verify failed:', res.status, err);
      throw new Error(extractErrorMessage(err, 'Verifikasi OTP gagal. Kode salah atau sudah kadaluarsa.'));
    }
    const data = await res.json();
    console.log('[DEBUG AUTH] POST /otp/verify response data:', JSON.stringify(data));
    if (data.token) await saveToken(data.token);
    if (data.user) await saveUser(data.user);
    return data;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('CLEARTEXT') || msg.includes('10.0.2.2')) {
      throw new Error('Koneksi HTTP diblokir (CLEARTEXT). Build ulang APK dengan EXPO_PUBLIC_API_URL=https://<tunnel>/api');
    }
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    )
      throw new Error('Gagal terhubung ke server.');
    throw err;
  }
}

// FUNGSI KIRIM ULANG OTP
// CATATAN: nama endpoint '/auth/resend-otp' ini tebakan berdasarkan pola
// '/auth/verify-otp' yang sudah ada. Konfirmasi ke temen yang pegang backend,
// kalau ternyata beda, cukup ganti string URL di baris fetch() di bawah ini.
export async function resendOtpApi(body: { email: string }) {
  try {
    console.log('[DEBUG AUTH] Sending POST /otp/resend for:', body.email);
    const res = await fetch(`${BASE_URL}/otp/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log('[DEBUG AUTH] POST /otp/resend failed:', res.status, err);
      throw new Error(extractErrorMessage(err, 'Gagal mengirim ulang kode OTP.'));
    }
    const data = await res.json();
    console.log('[DEBUG AUTH] POST /auth/resend-otp response data:', JSON.stringify(data));
    return data;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('CLEARTEXT') || msg.includes('10.0.2.2')) {
      throw new Error('Koneksi HTTP diblokir (CLEARTEXT). Build ulang APK dengan EXPO_PUBLIC_API_URL=https://<tunnel>/api');
    }
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      String(err).includes('Network')
    )
      throw new Error('Gagal terhubung ke server.');
    throw err;
  }
}

export async function apiLogout() {
  try { await fetchWithAuth('/logout', { method: 'POST' }); } catch {}
  await removeToken();
}

export async function getMe() {
  const data = await fetchWithAuth('/me');
  console.log('[DEBUG AUTH] GET /me response data:', JSON.stringify(data));
  if (data) await saveUser(data);
  return data;
}

export async function updateProfile(body: { name?: string; avatar?: string }) {
  if (body.avatar) {
    const token = await getToken();
    const rawName = body.avatar.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(rawName);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const filename = rawName.includes('.') ? rawName : `${rawName}.${ext}`;

    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'gif') mimeType = 'image/gif';

    console.log('[DEBUG AVATAR] Uploading via FileSystem.uploadAsync...');
    const uploadResult = await FileSystem.uploadAsync(`${BASE_URL}/me`, body.avatar, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'avatar',
      mimeType,
      parameters: body.name !== undefined ? { name: body.name } : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    console.log('[DEBUG AVATAR] Upload status:', uploadResult.status);
    console.log('[DEBUG AVATAR] Upload body:', uploadResult.body);

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      let errData: any = {};
      try {
        errData = JSON.parse(uploadResult.body);
      } catch {}
      throw new Error(extractErrorMessage(errData, `Upload gagal (${uploadResult.status})`));
    }

    const res = JSON.parse(uploadResult.body);
    if (res) await saveUser(res);
    return res;
  }

  const formData = new FormData();
  if (body.name !== undefined) {
    formData.append('name', body.name);
  }
  console.log('[DEBUG PROFILE] Sending PUT /me with formData...');
  const res = await fetchMultipart('/me', 'PUT', formData);
  console.log('[DEBUG PROFILE] PUT /me response data:', JSON.stringify(res));
  if (res) await saveUser(res);
  return res;
}

export async function changePassword(body: {
  old_password: string;
  new_password: string;
  new_password_confirmation: string;
}) {
  return fetchWithAuth('/me/password', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getDashboardSummary() {
  return fetchWithAuth('/dashboard/summary');
}

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

// QUESTIONS
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

// PUBLIC ACCESS (RESPONDENT / GUEST) 
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
  const data = await res.json();
  return { ...data, short_code: data.short_code || cleanCode.toUpperCase() };
}

export async function checkCanStart(shortCode: string) {
  return fetchWithAuth(`/q/${shortCode}/start`);
}

// SUBMISSION 
export async function createSubmission(
  formId: string | number,
  name?: string,
  email?: string
) {
  const body: any = { form_id: Number(formId) };
  if (name) body.respondent_name = name;
  if (email) body.respondent_email = email;
  const res = await fetchWithAuth('/submissions', { method: 'POST', body: JSON.stringify(body) });
  if (res && res.access_token) {
    setSubmissionToken(res.access_token);
  }
  return res;
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

export async function checkPassword(
  submissionId: string | number,
  questionId: string | number,
  answer: string
) {
  return fetchWithAuth(`/submissions/${submissionId}/questions/${questionId}/check-password`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function lockSubmission(submissionId: string | number, reason?: string) {
  if (!submissionId || submissionId === 'null' || submissionId === 'undefined') {
    return null;
  }
  const payload = { reason: reason || 'window-blur' };
  try {
    return await fetchWithAuth(`/submissions/${submissionId}/lock`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isNotFound = msg.includes('Not Found') || msg.toLowerCase().includes('not found');
    if (isNotFound) {
      try {
        let last: any = null;
        for (let i = 0; i < 3; i++) {
          last = await fetchWithAuth(`/submissions/${submissionId}/tab-exit`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (last?.status === 'locked' || last?.warnings_left === 0) break;
        }
        return last;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function finalizeSubmission(submissionId: string | number) {
  return fetchWithAuth(`/submissions/${submissionId}/submit`, { method: 'POST' });
}

// ANTI-CHEAT
export async function reportTabExit(submissionId: string | number, reason?: string) {
  return fetchWithAuth(`/submissions/${submissionId}/tab-exit`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function getSubmissionDetail(submissionId: string | number) {
  return fetchWithAuth(`/submissions/${submissionId}`);
}

export async function getMySubmissions(params?: { page?: number; per_page?: number }) {
  const qp = new URLSearchParams();
  if (params?.page) qp.append('page', String(params.page));
  if (params?.per_page) qp.append('per_page', String(params.per_page));
  const qs = qp.toString() ? `?${qp.toString()}` : '';
  return fetchWithAuth(`/me/submissions${qs}`);
}

export async function getLeaderboard(formCode: string, submissionId?: string | number) {
  const url = submissionId
    ? `/q/${formCode}/leaderboard?limit=10&submission_id=${submissionId}`
    : `/q/${formCode}/leaderboard?limit=10`;
  return fetchWithAuth(url);
}

export async function uploadAnswerFile(
  submissionId: string | number,
  questionId: string | number,
  fileUri: string,
  mimeType = 'application/octet-stream',
  fileName?: string
) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (activeSubmissionToken) headers['X-Submission-Token'] = activeSubmissionToken;

  const endpointUrl = `${BASE_URL}/submissions/${submissionId}/answers/${questionId}/file`;

  try {
    if (FileSystem?.uploadAsync) {
      const uploadRes = await FileSystem.uploadAsync(endpointUrl, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mimeType || 'application/octet-stream',
        headers,
      });

      if (uploadRes.status >= 200 && uploadRes.status < 300) {
        let parsed = {};
        try {
          parsed = JSON.parse(uploadRes.body);
        } catch {
          parsed = { answer_file: uploadRes.body };
        }
        return parsed;
      } else {
        let errJson = {};
        try {
          errJson = JSON.parse(uploadRes.body);
        } catch {}
        throw new Error(extractErrorMessage(errJson, `Upload failed (${uploadRes.status})`));
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('uploadAsync')) {
      throw err;
    }
  }

  // Fallback to fetchMultipart
  const fd = new FormData();
  const name = fileName || fileUri.split('/').pop() || 'answer_file';
  fd.append('file', {
    uri: fileUri,
    name,
    type: mimeType || 'application/octet-stream',
  } as any);
  return fetchMultipart(`/submissions/${submissionId}/answers/${questionId}/file`, 'POST', fd);
}

export async function deleteAnswerFile(
  submissionId: string | number,
  questionId: string | number
) {
  return fetchWithAuth(`/submissions/${submissionId}/answers/${questionId}/file`, {
    method: 'DELETE',
  });
}

// RESULTS & ANALYTICS 
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
