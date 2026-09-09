import AsyncStorage from '@react-native-async-storage/async-storage';
import { autosaveAnswer, finalizeSubmission } from './api_service';

export interface PendingSubmissionItem {
  id: string; // unique pending id
  submission_id: number;
  form_id: number | string;
  form_title: string;
  short_code?: string;
  form_type?: string;
  answers: Record<number, any>;
  questions: any[];
  timestamp: number;
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  retry_count: number;
  error_message?: string;
}

const DRAFT_PREFIX = '@quizary_draft_';
const PENDING_QUEUE_KEY = '@quizary_pending_sync_queue';

/**
 * Save draft answer locally immediately (Real-Time Fail-Safe)
 */
export async function saveLocalAnswerDraft(
  formId: number | string,
  submissionId: number,
  answers: Record<number, any>
): Promise<void> {
  try {
    const key = `${DRAFT_PREFIX}${formId}_${submissionId}`;
    const payload = {
      formId,
      submissionId,
      answers,
      updated_at: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[OfflineSync] Failed to save local draft:', e);
  }
}

/**
 * Get saved local draft answers
 */
export async function getLocalAnswerDraft(
  formId: number | string,
  submissionId: number
): Promise<Record<number, any> | null> {
  try {
    const key = `${DRAFT_PREFIX}${formId}_${submissionId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed.answers || null;
  } catch {
    return null;
  }
}

/**
 * Clear local draft after successful sync
 */
export async function clearLocalAnswerDraft(
  formId: number | string,
  submissionId: number
): Promise<void> {
  try {
    const key = `${DRAFT_PREFIX}${formId}_${submissionId}`;
    await AsyncStorage.removeItem(key);
  } catch {}
}

/**
 * Get all pending queue items
 */
export async function getPendingSubmissions(): Promise<PendingSubmissionItem[]> {
  try {
    const json = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/**
 * Add or update an item in the pending submission queue
 */
export async function enqueuePendingSubmission(
  item: Omit<PendingSubmissionItem, 'id' | 'timestamp' | 'status' | 'retry_count'>
): Promise<PendingSubmissionItem> {
  try {
    const queue = await getPendingSubmissions();
    const existingIdx = queue.findIndex((q) => q.submission_id === item.submission_id);

    const pendingItem: PendingSubmissionItem = {
      ...item,
      id: `pending_${item.submission_id}_${Date.now()}`,
      timestamp: Date.now(),
      status: 'PENDING_SYNC',
      retry_count: 0,
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = { ...queue[existingIdx], ...pendingItem, retry_count: queue[existingIdx].retry_count + 1 };
    } else {
      queue.push(pendingItem);
    }

    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    return pendingItem;
  } catch (e) {
    console.error('[OfflineSync] Failed to enqueue pending submission:', e);
    throw e;
  }
}

/**
 * Remove an item from the pending queue
 */
export async function dequeuePendingSubmission(submissionId: number): Promise<void> {
  try {
    const queue = await getPendingSubmissions();
    const filtered = queue.filter((q) => q.submission_id !== submissionId);
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('[OfflineSync] Failed to dequeue submission:', e);
  }
}

/**
 * Update status of a pending queue item
 */
export async function updatePendingItemStatus(
  submissionId: number,
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED',
  error_message?: string
): Promise<void> {
  try {
    const queue = await getPendingSubmissions();
    const item = queue.find((q) => q.submission_id === submissionId);
    if (item) {
      item.status = status;
      if (error_message) item.error_message = error_message;
      await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (e) {
    console.error('[OfflineSync] Failed to update item status:', e);
  }
}

/**
 * Process the pending submission queue (Auto-Retry Background Sync)
 */
export async function processPendingSubmissions(): Promise<{ synced: number; failed: number }> {
  const queue = await getPendingSubmissions();
  const pendingItems = queue.filter((q) => q.status === 'PENDING_SYNC');

  if (pendingItems.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of pendingItems) {
    try {
      const { submission_id, answers, questions, form_id } = item;

      // 1. Sync answers to API
      const syncPromises = questions.map(async (q) => {
        const val = answers[q.id];
        if (val === undefined || val === null) return;

        const rawType = String(q.type || q.question_type || '').toLowerCase();
        if (
          rawType === 'multiple_choice' ||
          rawType === 'checkbox' ||
          rawType === 'dropdown' ||
          rawType === 'select' ||
          rawType === 'choice' ||
          Array.isArray(val) ||
          typeof val === 'number'
        ) {
          const option_ids = Array.isArray(val) ? val : typeof val === 'number' ? [val] : [];
          if (option_ids.length > 0) {
            await autosaveAnswer(submission_id, { question_id: q.id, option_ids });
          }
        } else if (rawType !== 'file_upload' && rawType !== 'file') {
          const text = String(val).trim();
          if (text) {
            await autosaveAnswer(submission_id, { question_id: q.id, answer_text: text });
          }
        }
      });

      await Promise.all(syncPromises);

      // 2. Finalize submission
      await finalizeSubmission(submission_id);

      // 3. Mark as SYNCED & remove from queue & clear local draft
      await updatePendingItemStatus(submission_id, 'SYNCED');
      await dequeuePendingSubmission(submission_id);
      await clearLocalAnswerDraft(form_id, submission_id);

      syncedCount++;
    } catch (err: any) {
      const errMsg = err?.message || '';
      console.warn(`[OfflineSync] Sync failed for submission ${item.submission_id}:`, errMsg);

      // If backend permanently denied access or item no longer exists, remove from queue to prevent log spam
      if (/access denied|forbidden|not found|403|404/i.test(errMsg)) {
        await dequeuePendingSubmission(item.submission_id);
      } else {
        await updatePendingItemStatus(item.submission_id, 'PENDING_SYNC', errMsg || 'Network error');
      }
      failedCount++;
    }
  }

  return { synced: syncedCount, failed: failedCount };
}
