import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  AppState,
  AppStateStatus,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppAlert } from '../context/AlertContext';
import {
  getPublicForm,
  checkCanStart,
  createSubmission,
  getSubmissionDetail,
  autosaveAnswer,
  lockSubmission,
  finalizeSubmission,
  setSubmissionToken,
  getToken,
  uploadAnswerFile,
  checkPassword,
} from '../services/api_service';
import {
  saveLocalAnswerDraft,
  enqueuePendingSubmission,
  dequeuePendingSubmission,
  clearLocalAnswerDraft,
} from '../services/offline_sync_service';
import { QuizLandingStep } from '../components/quiz/QuizLandingStep';
import { QuizStyleAnsweringStep } from '../components/quiz/QuizStyleAnsweringStep';
import { QuizQuestionCard } from '../components/quiz/QuizQuestionCard';
import { QuestionZoomModal } from '../components/quiz/QuestionZoomModal';
import { QuizSubmittedStep } from '../components/quiz/QuizSubmittedStep';
import { RestrictedWarningOverlay } from '../components/quiz/RestrictedWarningOverlay';
import { ViolatingLockOverlay } from '../components/quiz/ViolatingLockOverlay';
import { getThemeGradientColors } from '../components/quiz/QuizBackground';
import { useAppPinning } from '../hooks/useAppPinning';
import { useCheatSound } from '../hooks/useCheatSound';
import { useLockedVolume } from '../hooks/useLockedVolume';
import { useFloatingBlock } from '../hooks/useFloatingBlock';
import { stripHtmlTags } from '../components/RichTextRenderer';

function parseWibDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(/[\s:-]+/).map(Number);
  if (parts.length < 3) return null;
  const [d, m, Y, H = 0, M = 0, S = 0] = parts;
  return new Date(Date.UTC(Y, m - 1, d, (H || 0) - 7, M || 0, S || 0));
}

function formatTimer(ms: number | null) {
  if (ms === null || ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ shortCode?: string; formId?: string; submissionId?: string; resumeSubmissionId?: string }>();
  const shortCode = (params.shortCode as string) || '';
  const resumeId = (params.resumeSubmissionId as string) || (params.submissionId as string) || '';
  const { colors, language } = useAppTheme();
  const { showAlert } = useAppAlert();

  const [publicForm, setPublicForm] = useState<any>(null);
  const [canStartInfo, setCanStartInfo] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [fileUploading, setFileUploading] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [zoomQuestion, setZoomQuestion] = useState<any>(null);

  // Restricted flow states
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(5);
  const [lockedVisible, setLockedVisible] = useState(false);
  const [cheatReason, setCheatReason] = useState<string>('window-blur');
  const [lockedAt, setLockedAt] = useState<number | null>(null);
  const [refreshingLock, setRefreshingLock] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [pwWrong, setPwWrong] = useState<Record<number, boolean>>({});
  const [pwChecking, setPwChecking] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(5);
  const submissionIdRef = useRef<number | null>(null);
  const isRestrictedRef = useRef(false);
  const answeringRef = useRef(false);
  const warningVisibleRef = useRef(false);
  const lockedVisibleRef = useRef(false);
  const pinInProgressRef = useRef(false);
  const warningStartRef = useRef(0);
  const { pin, unpin, canPin, isExpoGo, nativeMissing } = useAppPinning();
  const { play: playCheat, stop: stopCheat } = useCheatSound();
  const { lock: lockVolume, unlock: unlockVolume } = useLockedVolume();
  const { hasFloating, setSecure } = useFloatingBlock();

  const themeColor =
    publicForm?.theme_color ||
    publicForm?.color ||
    publicForm?.themeColor ||
    publicForm?.settings?.theme_color ||
    colors.primary;

  const isQuizStyle = (publicForm?.display_style || 'card') === 'quiz';

  const cardScrollRef = useRef<ScrollView>(null);

  // Auto scroll to top when switching sections
  useEffect(() => {
    cardScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentSectionIdx]);

  // Keep refs updated
  useEffect(() => {
    submissionIdRef.current = submission?.submission_id || submission?.id || null;
  }, [submission]);
  useEffect(() => {
    isRestrictedRef.current = !!(publicForm?.type === 'quiz' && publicForm?.is_restricted);
  }, [publicForm]);
  useEffect(() => {
    warningVisibleRef.current = warningVisible;
  }, [warningVisible]);
  useEffect(() => {
    lockedVisibleRef.current = lockedVisible;
  }, [lockedVisible]);

  const refreshCanStart = useCallback(async () => {
    if (!shortCode) return null;
    try {
      const can = await checkCanStart(shortCode);
      setCanStartInfo(can);
      if (can && !can.can_start && can.reason === 'already_submitted') setAlreadySubmitted(true);
      return can;
    } catch {
      return null;
    }
  }, [shortCode]);

  // Resume via submissionId (khusus in_progress dari submission list)
  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      setLoading(true);
      try {
        const detail: any = await getSubmissionDetail(resumeId);
        // Public form untuk tema/header — fallback minimal jika getPublicForm gagal (mis. form draft/privat)
        if (detail.short_code) {
          try {
            const form = await getPublicForm(detail.short_code);
            setPublicForm(form);
          } catch {
            setPublicForm({ id: detail.form_id, title: detail.form_title || 'Form', short_code: detail.short_code, type: detail.type || 'form', display_style: 'card', theme_color: null } as any);
          }
        } else if (detail.form_id) {
          setPublicForm({ id: detail.form_id, title: detail.form_title || 'Form', short_code: detail.short_code, type: detail.type || 'form', display_style: 'card', theme_color: null } as any);
        } else {
          setPublicForm({ id: 0, title: detail.form_title || 'Form', type: 'form', display_style: 'card' } as any);
        }
        // Set submission langsung tanpa landing
        setSubmission({ submission_id: detail.id, id: detail.id, ...detail, access_token: detail.access_token });
        if (detail.access_token) setSubmissionToken(detail.access_token);
        setQuestions(detail.questions || []);
        setSections(detail.sections || []);
        setCurrentSectionIdx(0);
        if (detail.answers && Array.isArray(detail.answers)) {
          const init: Record<number, any> = {};
          detail.answers.forEach((a: any) => {
            const qtype = String(a.question_type || a.type || '').toLowerCase();
            if (['short_answer', 'essay', 'date', 'time', 'datetime', 'password'].includes(qtype)) init[a.question_id] = a.answer_text || '';
            else if (qtype === 'file_upload') { if (a.answer_file) init[a.question_id] = a.answer_file; }
            else init[a.question_id] = a.selected_option_ids || [];
          });
          setAnswers(init);
        }
        answeringRef.current = true;
        submissionIdRef.current = Number(resumeId);
        // Jika restricted, pin/volume akan aktif via AppState/polling; trigger pin sekarang jika bisa
        // Delay sedikit biar publicForm ter-set dulu
        setTimeout(async () => {
          if (isRestrictedRef.current && canPin) {
            lockVolume().catch(() => {});
            await pin().catch(() => {});
          }
        }, 500);
      } catch (e: any) {
        showAlert({ type: 'error', title: 'Gagal memuat', message: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [resumeId]);

  // Fetch public form + canStart (initial landing — jangan blok not_started di landing, hanya draft/closed)
  useEffect(() => {
    (async () => {
      if (resumeId) {
        // Sudah handle via resumeId di atas
        return;
      }
      if (!shortCode) {
        setLoading(false);
        return;
      }
      try {
        const form = await getPublicForm(shortCode);
        setPublicForm(form);
        try {
          const can = await checkCanStart(shortCode);
          // Hanya set already_submitted di landing; not_started/closed ditangani setelah Start (via handleStart) biar QR scan tetap ke landing dulu
          if (can && !can.can_start && can.reason === 'already_submitted') {
            setCanStartInfo(can);
            setAlreadySubmitted(true);
          } else if (can && can.can_start && can.require_identity) {
            setShowIdentityForm(true);
          } else if (can && can.can_start) {
            // Simpan can yang bisa start untuk identity check, tapi jangan auto block not_started
            setCanStartInfo(can);
          }
        } catch {}
      } catch (e: any) {
        showAlert({ type: 'error', title: 'Gagal memuat', message: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [shortCode]);

  // Poll submission if locked (check if creator unlocked)
  // Cleanup timer and unpin + unlock volume + stop sound + secure off on unmount (secure disabled for debugging)
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearInterval(warningTimerRef.current);
      unpin().catch(() => {});
      unlockVolume().catch(() => {});
      stopCheat().catch(() => {});
    };
  }, [unpin, unlockVolume, stopCheat]);

  // Block hardware back when pinned (restricted quiz in progress)
  useEffect(() => {
    const handler = () => {
      if (isRestrictedRef.current && answeringRef.current && !lockedVisibleRef.current) {
        // In pinned mode, back should be blocked; show hint
        if (canPin) {
          showAlert({
            type: 'warning',
            title: language === 'ID' ? 'Terkunci' : 'Locked',
            message: language === 'ID'
              ? 'Ujian sedang dipin. Tekan Recent lama + Back untuk keluar (akan terkunci).'
              : 'Exam is pinned. Long-press Recent + Back to exit (will lock).',
          });
          return true;
        }
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [canPin, language]);

  const triggerFloatingLock = useCallback(async (reason: string) => {
    if (lockedVisibleRef.current) return;
    const sid = submissionIdRef.current;
    if (!sid) return;
    const now = Date.now();
    setLockedAt(now);
    setCheatReason(reason);
    setLockedVisible(true);
    lockedVisibleRef.current = true;
    setWarningVisible(false);
    warningVisibleRef.current = false;
    stopCheat().catch(() => {});
    lockSubmission(sid, reason).catch(() => {});
  }, [stopCheat]);

  const handleCheckLockedStatus = useCallback(async () => {
    const sid = submissionIdRef.current;
    if (!sid) return;
    setRefreshingLock(true);
    try {
      const detail = await getSubmissionDetail(sid);
      const status = detail.status;
      if (status === 'in_progress') {
        setLockedVisible(false);
        lockedVisibleRef.current = false;
        setWarningVisible(false);
        warningVisibleRef.current = false;
        setCheatReason('window-blur');
        setLockedAt(null);
        setSubmission((prev: any) => ({ ...prev, status: 'in_progress' }));
        stopCheat().catch(() => {});
        // keep secure flag on when unlocked (still restricted) - disabled for debugging
        // setSecure(true).catch(() => {});
        showAlert({ type: 'success', title: language === 'ID' ? 'Dibuka Kembali' : 'Unlocked', message: language === 'ID' ? 'Pengawas telah membuka kembali ujian. Silakan lanjutkan.' : 'Proctor has unlocked the exam. Please continue.' });
      } else if (status === 'locked') {
        setCheatReason(detail.cheat_reason || 'window-blur');
        showAlert({ type: 'warning', title: language === 'ID' ? 'Masih Terkunci' : 'Still Locked', message: language === 'ID' ? 'Ujian masih terkunci, tunggu keputusan pengawas.' : 'Exam is still locked, waiting for proctor decision.' });
      } else if (status === 'cheating' || status === 'submitted' || status === 'auto_submitted') {
        await unpin().catch(() => {});
        await unlockVolume().catch(() => {});
        await stopCheat().catch(() => {});
        // await setSecure(false).catch(() => {});
        setLockedVisible(false);
        setWarningVisible(false);
        router.replace({ pathname: '/(tabs)/home' } as any);
      }
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Gagal cek status', message: e.message });
    } finally {
      setRefreshingLock(false);
    }
  }, [language, unpin]);

  // Timer countdown for exam (expired_at)
  useEffect(() => {
    if (!submission?.expired_at) return;
    const deadline = parseWibDate(submission.expired_at);
    if (!deadline) return;
    const id = setInterval(() => {
      const diff = deadline.getTime() - Date.now();
      if (diff <= 0) {
        clearInterval(id);
        setTimeLeft(0);
        handleAutoSubmit();
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [submission?.expired_at]);

  // Floating overlay auto-check (all floating: PiP, multi-window, overlay)
  useEffect(() => {
    if (!submission) return;
    if (!isRestrictedRef.current) return;
    const id = setInterval(async () => {
      if (!answeringRef.current || lockedVisibleRef.current || pinInProgressRef.current) return;
      try {
        const floating = await hasFloating();
        if (floating) {
          await triggerFloatingLock('floating-overlay');
        }
      } catch {}
    }, 800);
    return () => clearInterval(id);
  }, [submission, hasFloating, triggerFloatingLock]);

  // AppState restricted handler -> 5 sec warning
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const restricted = isRestrictedRef.current;
      const sid = submissionIdRef.current;
      const isAnswering = answeringRef.current;
      if (!restricted || !sid || !isAnswering) return;
      if (lockedVisibleRef.current) return;
      if (pinInProgressRef.current) return;

      if (next === 'background' || next === 'inactive') {
        // Start warning if not already — loop cheat sound during warning
        if (warningVisibleRef.current) return;
        warningStartRef.current = Date.now();
        countdownRef.current = 5;
        setWarningCountdown(5);
        setWarningVisible(true);
        warningVisibleRef.current = true;
        playCheat().catch(() => {});
        if (warningTimerRef.current) clearInterval(warningTimerRef.current);
        warningTimerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - warningStartRef.current) / 1000);
          const remain = Math.max(0, 5 - elapsed);
          countdownRef.current = remain;
          setWarningCountdown(remain);
          if (remain <= 0) {
            if (warningTimerRef.current) clearInterval(warningTimerRef.current);
            warningTimerRef.current = null;
            setWarningVisible(false);
            warningVisibleRef.current = false;
            stopCheat().catch(() => {});
            // Trigger lock — silent at lock
            const now = Date.now();
            setLockedAt(now);
            setCheatReason('window-blur');
            setLockedVisible(true);
            lockedVisibleRef.current = true;
            // Server lock
            lockSubmission(sid, 'window-blur').catch(() => {});
          }
        }, 250);
      } else if (next === 'active') {
        // Jika kembali sebelum habis, biarkan user tekan tombol.
        // Jika sudah lewat 5 detik saat di background (timer throttled),
        // cek langsung saat active dan lock jika perlu
        if (warningVisibleRef.current) {
          const elapsed = Math.floor((Date.now() - warningStartRef.current) / 1000);
          if (elapsed >= 5) {
            if (warningTimerRef.current) clearInterval(warningTimerRef.current);
            warningTimerRef.current = null;
            setWarningVisible(false);
            warningVisibleRef.current = false;
            stopCheat().catch(() => {});
            const now = Date.now();
            setLockedAt(now);
            setCheatReason('window-blur');
            setLockedVisible(true);
            lockedVisibleRef.current = true;
            const sid2 = submissionIdRef.current;
            if (sid2) lockSubmission(sid2, 'window-blur').catch(() => {});
          }
        }
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
    };
  }, [playCheat, stopCheat, hasFloating]);

  const handleReenter = useCallback(async () => {
    // Check floating first
    if (isRestrictedRef.current) {
      try {
        if (await hasFloating()) {
          await triggerFloatingLock('floating-overlay');
          return;
        }
      } catch {}
    }
    // Don't hide warning before pin success — keep visible until verified via isPinned poll
    if (isRestrictedRef.current && canPin) {
      pinInProgressRef.current = true;
      try {
        const ok = await pin();
        if (!ok) {
          showAlert({
            type: 'warning',
            title: language === 'ID' ? 'Pin gagal' : 'Pin failed',
            message: language === 'ID'
              ? 'Gagal pin ulang. Coba lagi atau akan terkunci.'
              : 'Failed to re-pin. Try again or will be locked.',
          });
          playCheat().catch(() => {});
          return;
        }
        // Poll isPinned up to 1s (system dialog Pin this app? needs user tap / lockTaskModeState delay)
        let verified = false;
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 200));
          try {
            const { NativeModules } = require('react-native');
            const n = (NativeModules as any).AppPinning;
            if (n?.isPinned) verified = await n.isPinned();
            else verified = true;
          } catch {
            verified = true;
          }
          if (verified) break;
        }
        if (!verified) {
          showAlert({
            type: 'warning',
            title: language === 'ID' ? 'Pin gagal' : 'Pin failed',
            message: language === 'ID'
              ? 'Gagal pin ulang. Coba lagi atau akan terkunci.'
              : 'Failed to re-pin. Try again or will be locked.',
          });
          playCheat().catch(() => {});
          return;
        }
        // Success: clear warning and stop loop
        if (warningTimerRef.current) clearInterval(warningTimerRef.current);
        warningTimerRef.current = null;
        warningStartRef.current = 0;
        setWarningVisible(false);
        warningVisibleRef.current = false;
        setWarningCountdown(5);
        countdownRef.current = 5;
        await stopCheat().catch(() => {});
      } catch {
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Pin gagal' : 'Pin failed',
          message: language === 'ID' ? 'Gagal pin ulang.' : 'Failed to re-pin.',
        });
        playCheat().catch(() => {});
        return;
      } finally {
        pinInProgressRef.current = false;
      }
    } else {
      // Expo Go / nativeMissing: just dismiss
      if (warningTimerRef.current) clearInterval(warningTimerRef.current);
      warningTimerRef.current = null;
      warningStartRef.current = 0;
      setWarningVisible(false);
      warningVisibleRef.current = false;
      setWarningCountdown(5);
      countdownRef.current = 5;
      await stopCheat().catch(() => {});
    }
  }, [canPin, pin, stopCheat, playCheat, hasFloating, triggerFloatingLock, language]);

  const handleStart = async () => {
    if (!publicForm) return;
    if (showIdentityForm) {
      if (!respondentName.trim()) {
        showAlert({ type: 'warning', title: language === 'ID' ? 'Nama wajib' : 'Name required', message: language === 'ID' ? 'Masukkan nama kamu sebelum memulai.' : 'Please enter your name before starting.' });
        return;
      }
    }
    if (publicForm.require_login) {
      const token = await getToken();
      if (!token) {
        showAlert({ type: 'warning', title: language === 'ID' ? 'Login Diperlukan' : 'Login Required', message: language === 'ID' ? 'Form ini mewajibkan login. Silakan login dulu.' : 'This form requires login. Please login first.' });
        router.replace('/(tabs)/home' as any);
        return;
      }
    }
    // Re-check server gate (already_submitted, not_started, closed, draft, etc) before creating
    const freshCan = await refreshCanStart();
    if (freshCan && !freshCan.can_start) {
      setCanStartInfo(freshCan);
      if (freshCan.reason === 'already_submitted') setAlreadySubmitted(true);
      // Jangan langsung createSubmission jika belum bisa mulai — biarkan UI blocked yang handle (theme + i18n)
      return;
    }

    setStarting(true);
    try {
      const res = await createSubmission(
        publicForm.id,
        showIdentityForm ? respondentName.trim() : undefined,
        showIdentityForm && respondentEmail.trim() ? respondentEmail.trim() : undefined
      );
      if (res.access_token) setSubmissionToken(res.access_token);
      setSubmission(res);
      const qs = res.questions || [];
      setQuestions(qs);
      setSections(res.sections || []);
      setCurrentSectionIdx(0);
      // Init answers from resumed if any
      let rawAnswers = res.answers;
      const subId = res.submission_id || res.id;
      if ((!rawAnswers || rawAnswers.length === 0) && subId) {
        try {
          const detail = await getSubmissionDetail(subId);
          if (detail && detail.answers) {
            rawAnswers = detail.answers;
          }
        } catch {}
      }

      if (rawAnswers && Array.isArray(rawAnswers)) {
        const initAnswers: Record<number, any> = {};
        const initFileAnswers: Record<number, any> = {};
        rawAnswers.forEach((a: any) => {
          const qtype = String(a.question_type || a.type || '').toLowerCase();
          if (qtype === 'short_answer' || qtype === 'essay' || qtype === 'date' || qtype === 'time' || qtype === 'datetime' || qtype === 'password') {
            initAnswers[a.question_id] = a.answer_text || '';
          } else if (qtype === 'file_upload') {
            if (a.answer_file) {
              initAnswers[a.question_id] = a.answer_file;
              const fname = typeof a.answer_file === 'string' ? a.answer_file.split('/').pop() : 'file';
              initFileAnswers[a.question_id] = { url: a.answer_file, filename: fname };
            }
          } else {
            // Option types (multiple_choice, checkbox, dropdown, etc.)
            if (a.answer_text) {
              initAnswers[a.question_id] = {
                ids: a.selected_option_ids || [],
                text: a.answer_text,
              };
            } else {
              initAnswers[a.question_id] = a.selected_option_ids || [];
            }
          }
        });
        setAnswers(initAnswers);
      }
      answeringRef.current = true;
      if (publicForm.type === 'quiz' && publicForm.is_restricted) {
        // Auto-check floating before pin
        try {
          if (await hasFloating()) {
            await triggerFloatingLock('floating-overlay');
            showAlert({
              type: 'warning',
              title: language === 'ID' ? 'Floating terdeteksi' : 'Floating detected',
              message: language === 'ID'
                ? 'Floating app terdeteksi. Tutup semua floating/bubble/PiP sebelum mulai.'
                : 'Floating app detected. Close all floating/bubble/PiP before starting.',
            });
            return;
          }
        } catch {}
        lockVolume().catch(() => {});
        // setSecure(true) disabled for debugging
        if (canPin) {
          const pinned = await pin().catch(() => false);
          if (!pinned) {
            showAlert({
              type: 'warning',
              title: language === 'ID' ? 'Pin gagal' : 'Pin failed',
              message: language === 'ID'
                ? 'Gagal pin app. Tetap pakai mode warning 5 detik jika keluar.'
                : 'Failed to pin app. Using 5s warning fallback.',
            });
          }
        } else if (isExpoGo) {
          showAlert({
            type: 'info',
            title: language === 'ID' ? 'Mode Expo Go' : 'Expo Go mode',
            message: language === 'ID'
              ? 'Pin hanya aktif di Dev Client / APK build. Di Expo Go pakai deteksi background (5 detik).'
              : 'Pinning only works in Dev Client / APK. Expo Go uses background detection (5s).',
          });
        } else if (nativeMissing) {
          showAlert({
            type: 'warning',
            title: 'Native pin tidak terpasang',
            message: 'Dev Client build lama / native tidak ter-link. Rebuild dengan --clear-cache.',
          });
        }
      }
    } catch (e: any) {
      const msg = String(e.message || '');
      if (msg.toLowerCase().includes('already submitted') || msg.includes('409')) {
        setAlreadySubmitted(true);
        setCanStartInfo({ can_start: false, reason: 'already_submitted' });
      } else {
        showAlert({ type: 'error', title: language === 'ID' ? 'Gagal memulai' : 'Failed to start', message: e.message });
      }
    } finally {
      setStarting(false);
    }
  };

  const handleSelectOption = async (questionId: number, optionId: number, isCheckbox: boolean) => {
    const q = questions.find((x) => x.id === questionId);
    if (!q) return;

    const rawType = String(q.type || q.question_type || '').toLowerCase();
    const isCb = isCheckbox || rawType === 'checkbox';

    let next: number[] = [];
    setAnswers((prev) => {
      const cur = prev[questionId];
      const curArr: number[] = Array.isArray(cur)
        ? cur
        : typeof cur === 'number'
        ? [cur]
        : [];
      if (isCb) {
        next = curArr.includes(optionId)
          ? curArr.filter((id) => id !== optionId)
          : [...curArr, optionId];
      } else {
        next = curArr[0] === optionId ? [] : [optionId];
      }
      return { ...prev, [questionId]: next };
    });

    const sid = submissionIdRef.current;
    if (!sid) return;

    // Compute synchronous next so autosave ALWAYS gets accurate option_ids
    const curAns = answers[questionId];
    const curArr: number[] = Array.isArray(curAns)
      ? curAns
      : typeof curAns === 'number'
      ? [curAns]
      : [];
    const computedNext = isCb
      ? curArr.includes(optionId)
        ? curArr.filter((id) => id !== optionId)
        : [...curArr, optionId]
      : curArr[0] === optionId
      ? []
      : [optionId];

    try {
      await autosaveAnswer(sid, { question_id: questionId, option_ids: computedNext });
    } catch {}
  };

  const handleTextChange = async (questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
    const sid = submissionIdRef.current;
    if (!sid) return;
    try {
      await autosaveAnswer(sid, { question_id: questionId, answer_text: text });
    } catch {}
  };

  const handlePickFile = async (questionId: number) => {
    const sid = submissionIdRef.current;
    if (!sid) return;
    setFileUploading((p) => ({ ...p, [questionId]: true }));
    try {
      let uri = '';
      let mime = 'application/octet-stream';
      let name = 'file';

      // Try document picker first (supports documents, pdfs, images, etc.)
      try {
        const DocumentPicker = await import('expo-document-picker');
        const res = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });
        if (res.canceled) {
          setFileUploading((p) => ({ ...p, [questionId]: false }));
          return;
        }
        if (res.assets && res.assets.length > 0) {
          const asset = res.assets[0];
          uri = asset.uri;
          mime = asset.mimeType || 'application/octet-stream';
          name = asset.name || uri.split('/').pop() || 'upload_file';
        }
      } catch {
        // Fallback to ImagePicker
        const ImgPicker = await import('expo-image-picker');
        const res = await ImgPicker.launchImageLibraryAsync({
          mediaTypes: ImgPicker.MediaTypeOptions.All,
          quality: 0.8,
        });
        if (res.canceled || !res.assets || !res.assets.length) {
          setFileUploading((p) => ({ ...p, [questionId]: false }));
          return;
        }
        const asset = res.assets[0];
        uri = asset.uri;
        mime = asset.mimeType || 'image/jpeg';
        name = (asset as any).fileName || uri.split('/').pop() || 'upload_image.jpg';
      }

      if (!uri) {
        setFileUploading((p) => ({ ...p, [questionId]: false }));
        return;
      }

      const uploadRes = await uploadAnswerFile(sid, questionId, uri, mime, name);
      const serverFilePath =
        uploadRes?.answer_file ||
        uploadRes?.file_path ||
        uploadRes?.file_url ||
        uploadRes?.url ||
        uploadRes?.path ||
        uploadRes?.data?.answer_file ||
        uploadRes?.data?.file_path ||
        uploadRes?.data?.url ||
        uri;

      setAnswers((p) => ({ ...p, [questionId]: serverFilePath }));
      await autosaveAnswer(sid, { question_id: questionId, answer_text: serverFilePath }).catch(() => {});
      showAlert({ type: 'success', title: 'File terupload', message: 'File jawaban berhasil diupload.' });
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Upload gagal', message: e.message || 'Gagal mengunggah file' });
    } finally {
      setFileUploading((p) => ({ ...p, [questionId]: false }));
    }
  };

  // Password gate helper — untuk quiz & card: semua password wajib benar
  const checkPasswords = async (qs: any[]): Promise<number[]> => {
    const targets = qs.filter((q) => String(q.type || q.question_type || '').toLowerCase() === 'password');
    if (!targets.length) return [];
    const sid = submissionIdRef.current;
    if (!sid) return targets.map((q: any) => q.id);
    const wrong: number[] = [];
    for (const q of targets) {
      const ans = String(answers[q.id] ?? '');
      if (!ans.trim()) { wrong.push(q.id); continue; }
      try {
        const r: any = await checkPassword(sid, q.id, ans);
        if (!r.valid) wrong.push(q.id);
      } catch { wrong.push(q.id); }
    }
    return wrong;
  };

  // Card: pecah questions per section (mirip web formPages)
  const cardPages = (() => {
    if (isQuizStyle || !questions.length) return [];
    if (!sections.length) return [{ key: 'all', title: null, questions }];
    const bySec: Record<string, any[]> = {};
    const noSec: any[] = [];
    for (const q of questions) {
      if (q.section_id != null && sections.some((s: any) => s.id === q.section_id)) {
        const k = String(q.section_id);
        (bySec[k] ||= []).push(q);
      } else noSec.push(q);
    }
    const pages: any[] = [];
    for (const sec of sections) {
      const qs = bySec[String(sec.id)] || [];
      if (qs.length) pages.push({ key: String(sec.id), title: sec.title, questions: qs });
    }
    if (noSec.length) pages.push({ key: 'no-section', title: null, questions: noSec });
    // fallback jika semua soal tidak terpetakan (mis. section baru)
    if (!pages.length) return [{ key: 'all', title: null, questions }];
    return pages;
  })();

  const currentCardPage = cardPages[currentSectionIdx] || cardPages[0];
  const isLastCardPage = currentSectionIdx >= cardPages.length - 1;

  const handleNextSection = async () => {
    if (!currentCardPage) return;
    // Required validation per section — global for all forms (card design)
    for (const q of currentCardPage.questions) {
      if (q.is_required === false) continue;
      const val = answers[q.id];
      const has =
        q.type === 'file_upload'
          ? !!val
          : Array.isArray(val)
          ? val.length > 0
          : !!val && String(val).trim().length > 0;
      if (!has) {
        const clean = stripHtmlTags(q.question_text || '').slice(0, 60) || `Soal`;
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Soal wajib belum diisi' : 'Required question missing',
          message: language === 'ID'
            ? `"${clean}" di section ini wajib diisi sebelum lanjut.`
            : `"${clean}" in this section is required before proceeding.`,
        });
        return;
      }
    }
    setPwChecking(true);
    const wrong = await checkPasswords(currentCardPage.questions);
    setPwChecking(false);
    if (wrong.length) {
      const errs: Record<number, boolean> = {};
      wrong.forEach((id) => (errs[id] = true));
      setPwWrong((p) => ({ ...p, ...errs }));
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Password salah' : 'Wrong password',
        message: language === 'ID' ? 'Password tidak cocok — tidak bisa lanjut ke section berikutnya.' : 'Wrong password — cannot go to next section.',
      });
      return;
    }
    setPwWrong((p) => {
      const n = { ...p };
      currentCardPage.questions.forEach((q: any) => delete n[q.id]);
      return n;
    });
    if (currentSectionIdx < cardPages.length - 1) setCurrentSectionIdx((i) => i + 1);
  };

  const handlePrevSection = () => {
    if (currentSectionIdx > 0) setCurrentSectionIdx((i) => i - 1);
  };

  // Reset pwWrong when typing password (card)
  const handleCardTextChange = async (questionId: number, text: string) => {
    if (pwWrong[questionId]) setPwWrong((p) => { const n = { ...p }; delete n[questionId]; return n; });
    await handleTextChange(questionId, text);
  };

  const handleAutoSubmit = async () => {
    const sid = submissionIdRef.current;
    if (!sid) return;
    answeringRef.current = false;
    await unpin().catch(() => {});
    await unlockVolume().catch(() => {});
    await stopCheat().catch(() => {});
    try {
      await finalizeSubmission(sid);
    } catch {}
    setFetching(false);
    router.replace({ pathname: '/(tabs)/home' } as any);
  };

  const handleSubmit = async () => {
    const sid = submissionIdRef.current;
    if (!sid) return;
    // Validate required
    for (const q of questions) {
      const isRequired = q.is_required !== false;
      if (!isRequired) continue;
      const val = answers[q.id];
      const has =
        q.type === 'file_upload'
          ? !!val
          : Array.isArray(val)
          ? val.length > 0
          : !!val && String(val).trim().length > 0;
      if (!has) {
        const cleanSubmit = stripHtmlTags(q.question_text || '').slice(0, 40) || 'Soal';
        showAlert({
          type: 'warning',
          title: language === 'ID' ? 'Soal wajib belum diisi' : 'Required missing',
          message: `${language === 'ID' ? 'Soal' : 'Question'} "${cleanSubmit}" ${language === 'ID' ? 'wajib diisi.' : 'is required.'}`,
        });
        // arahkan ke section yang mengandung soal kosong (card)
        if (!isQuizStyle && cardPages.length) {
          const idx = cardPages.findIndex((p: any) => p.questions.some((qq: any) => qq.id === q.id));
          if (idx >= 0 && idx !== currentSectionIdx) setCurrentSectionIdx(idx);
        }
        return;
      }
    }
    // Gate password on submit: semua password required harus valid (baik quiz maupun card)
    setPwChecking(true);
    const wrongAll = await checkPasswords(questions);
    setPwChecking(false);
    if (wrongAll.length) {
      const errs: Record<number, boolean> = {};
      wrongAll.forEach((id) => (errs[id] = true));
      setPwWrong((p) => ({ ...p, ...errs }));
      showAlert({
        type: 'warning',
        title: language === 'ID' ? 'Password salah' : 'Wrong password',
        message: language === 'ID' ? 'Password tidak cocok — periksa kembali sebelum submit.' : 'Wrong password — check before submit.',
      });
      if (!isQuizStyle && cardPages.length) {
        const idx = cardPages.findIndex((p: any) => p.questions.some((qq: any) => wrongAll.includes(qq.id)));
        if (idx >= 0) setCurrentSectionIdx(idx);
      }
      return;
    }
    setPwWrong({});
    setSubmitting(true);
    try {
      // 1. Fail-Safe: Always save submission to local offline queue FIRST
      await enqueuePendingSubmission({
        submission_id: sid,
        form_id: publicForm?.id || 0,
        form_title: publicForm?.title || '',
        short_code: publicForm?.short_code,
        form_type: publicForm?.type,
        answers,
        questions,
      }).catch(() => {});

      // 2. Sync answers to API
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
            await autosaveAnswer(sid, { question_id: q.id, option_ids });
          }
        } else if (rawType !== 'file_upload' && rawType !== 'file') {
          const text = String(val).trim();
          if (text) {
            await autosaveAnswer(sid, { question_id: q.id, answer_text: text });
          }
        }
      });

      await Promise.all(syncPromises);

      // 3. Finalize on API
      const res = await finalizeSubmission(sid);
      answeringRef.current = false;
      await unpin().catch(() => {});
      await unlockVolume().catch(() => {});
      await stopCheat().catch(() => {});

      // 4. Success — dequeue & clear draft
      await dequeuePendingSubmission(sid).catch(() => {});
      await clearLocalAnswerDraft(publicForm?.id || 0, sid).catch(() => {});

      setSubmission((prev: any) => ({ ...prev, result: res }));
      setQuestions([]); // trigger submitted view
    } catch (e: any) {
      answeringRef.current = false;
      await unpin().catch(() => {});
      await unlockVolume().catch(() => {});
      await stopCheat().catch(() => {});

      if (e.message?.includes('waktu') || e.message?.includes('expired')) {
        router.replace({ pathname: '/(tabs)/home' } as any);
      } else {
        // Network error / Offline mode fallback
        showAlert({
          type: 'info',
          title: language === 'ID' ? 'Koneksi Terganggu (Offline)' : 'Network Interrupted (Offline)',
          message: language === 'ID'
            ? 'Koneksi terganggu. Jawaban Anda telah disimpan dengan aman dan akan otomatis terkirim begitu koneksi kembali.'
            : 'Network connection lost. Your response has been saved locally and will auto-sync when online.',
        });

        const offlineResult = {
          submission_id: sid,
          form_title: publicForm?.title,
          type: publicForm?.type,
          is_offline_pending: true,
          submitted_at: new Date().toISOString(),
          questions,
        };
        setSubmission((prev: any) => ({ ...prev, result: offlineResult }));
        setQuestions([]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!publicForm) {
    // Jika resumeId ada dan submission sudah dimuat, jangan anggap Form tidak ditemukan
    // Fallback publicForm minimal sudah di-set di resume effect, tapi jaga-jaga
    if (resumeId && submission) {
      // Biarkan lanjut ke answering/landing, jangan block
    } else {
      return (
        <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
          <StatusBar style="dark" />
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Form tidak ditemukan</Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
            onPress={async () => {
              await unpin().catch(() => {});
              router.replace('/(tabs)/home' as any);
            }}
          >
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
  }

  // Themed blocked screen — for already_submitted use Image 1 design (cyan + check)
  if (alreadySubmitted || (canStartInfo && !canStartInfo.can_start && !canStartInfo.is_preview)) {
    const reason = canStartInfo?.reason;
    // already_submitted gets special themed screen matching web Image 1
    if (alreadySubmitted || reason === 'already_submitted') {
      const gradient = getThemeGradientColors(themeColor);
      return (
        <View style={{ flex: 1 }}>
          <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.alreadyContainer}>
            <StatusBar style="light" />
            <View style={styles.alreadyIconCircle}>
              <Ionicons name="checkmark-circle-outline" size={36} color="#FFF" />
            </View>
            <Text style={styles.alreadyTitle}>You have already submitted this form.</Text>
            <Text style={styles.alreadySub}>You can only submit this form once.</Text>
            <TouchableOpacity
              style={styles.alreadyBack}
              onPress={async () => {
                await unpin().catch(() => {});
                router.replace('/(tabs)/home' as any);
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="arrow-back" size={18} color={themeColor} />
              <Text style={[styles.alreadyBackText, { color: themeColor }]}>{language === 'ID' ? 'Kembali' : 'Back to home'}</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      );
    }
    const isNotStarted = reason === 'not_started';
    const blockedGradient = getThemeGradientColors(themeColor);
    const iconName = isNotStarted ? 'time-outline' as const : 'lock-closed-outline' as const;
    // Web pakai t('landing.notStarted') = "Not yet opened" untuk title & desc not_started
    const blockedTitleMap: any = {
      draft: language === 'ID' ? 'Form belum dipublikasikan.' : 'Form is not published.',
      closed: language === 'ID' ? 'Form sudah ditutup.' : 'Form is closed.',
      not_started: language === 'ID' ? 'Form belum dibuka.' : 'Not yet opened',
    };
    const blockedDescMap: any = {
      draft: language === 'ID' ? 'Form masih draft — belum dipublikasikan.' : 'Form is still draft.',
      closed: language === 'ID' ? 'Form sudah ditutup.' : 'Form is closed.',
      not_started: language === 'ID' ? 'Form belum dibuka.' : 'Not yet opened',
    };
    // Web: Not yet opened pakai "Not yet opened" untuk title & desc sama (Image 1 blue solid)
    const title = blockedTitleMap[reason] || (language === 'ID' ? 'Tidak dapat memulai' : 'Cannot start');
    const desc = blockedDescMap[reason] || title;
    // QR scan flow: landing tetap Start, blocked hanya setelah Start ditekan — jadi di sini kita tampilkan themed blocked
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={blockedGradient} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.blockedContainer}>
          <View style={styles.blockedIconCircle}>
            <Ionicons name={iconName} size={32} color="#FFF" />
          </View>
          <Text style={styles.blockedTitle}>{title}</Text>
          <Text style={styles.blockedDesc}>{desc}</Text>
          <TouchableOpacity
            style={[styles.blockedBackBtn, { backgroundColor: '#FFF' }]}
            onPress={async () => {
              await unpin().catch(() => {});
              router.replace('/(tabs)/home' as any);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={16} color={themeColor} />
            <Text style={[styles.blockedBackText, { color: themeColor }]}>{language === 'ID' ? 'Kembali' : 'Back to home'}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const handleFillAgain = () => {
    setSubmission(null);
    setQuestions([]);
    setAnswers({});
    setAlreadySubmitted(false);
    setStarting(false);
    setSubmitting(false);
    setCurrentSectionIdx(0);
  };

  // Submitted view
  if (submission?.result) {
    return (
      <QuizSubmittedStep
        resultData={submission.result}
        submissionId={submission.submission_id || submission.id}
        publicForm={publicForm}
        onFillAgain={handleFillAgain}
      />
    );
  }

  // Landing step
  if (!submission) {
    return (
      <View style={{ flex: 1 }}>
        <QuizLandingStep publicForm={publicForm} starting={starting} onStart={handleStart} />
        {showIdentityForm && (
          <View style={[styles.identityBar, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.identityLabel, { color: colors.text }]}>{language === 'ID' ? 'Nama (wajib)' : 'Name (required)'}</Text>
            <TextInput
              style={[styles.identityInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder={language === 'ID' ? 'Masukkan nama' : 'Enter name'}
              placeholderTextColor={colors.textMuted}
              value={respondentName}
              onChangeText={setRespondentName}
            />
            <Text style={[styles.identityLabel, { color: colors.text, marginTop: 10 }]}>Email (opsional)</Text>
            <TextInput
              style={[styles.identityInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="email@example.com"
              placeholderTextColor={colors.textMuted}
              value={respondentEmail}
              onChangeText={setRespondentEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}
      </View>
    );
  }

  // Answering
  const formattedTimer = formatTimer(timeLeft);

  return (
    <View style={{ flex: 1, backgroundColor: isQuizStyle ? '#0B0F19' : colors.bg }}>
      <StatusBar style={isQuizStyle ? 'light' : 'dark'} />

      {isQuizStyle ? (
        <QuizStyleAnsweringStep
          publicForm={publicForm}
          questions={questions}
          answers={answers}
          onSelectOption={handleSelectOption}
          onTextChange={handleTextChange}
          onPickFile={handlePickFile}
          fileUploading={fileUploading}
          formattedTimerStr={formattedTimer}
          submitting={submitting}
          onSubmit={handleSubmit}
          onOpenZoom={setZoomQuestion}
          onCloseQuiz={async () => {
            await unpin().catch(() => {});
            await unlockVolume().catch(() => {});
            await stopCheat().catch(() => {});
            router.replace('/(tabs)/home' as any);
          }}
          submissionId={submissionIdRef.current}
        />
      ) : (
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={[styles.formHeader, { borderBottomColor: colors.inputBorder, backgroundColor: colors.cardBg }]}>
            {!publicForm?.is_restricted && (
              <TouchableOpacity
                onPress={async () => {
                  await unpin().catch(() => {});
                  await unlockVolume().catch(() => {});
                  await stopCheat().catch(() => {});
                  router.replace('/(tabs)/home' as any);
                }}
                style={{ padding: 6 }}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            )}
            <Text style={[styles.formHeaderTitle, { color: colors.text }]} numberOfLines={1}>
              {publicForm.title?.replace(/<[^>]*>/g, '') || 'Form'}
            </Text>
            <View style={[styles.timerPill, { backgroundColor: timeLeft !== null && timeLeft < 60000 ? '#EF4444' : colors.inputBg }]}>
              <Ionicons name="timer-outline" size={14} color={timeLeft !== null && timeLeft < 60000 ? '#FFF' : colors.text} />
              <Text style={[styles.timerText, { color: timeLeft !== null && timeLeft < 60000 ? '#FFF' : colors.text }]}>{formattedTimer}</Text>
            </View>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              ref={cardScrollRef}
              contentContainerStyle={[styles.formScroll, { paddingBottom: 220 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
            {currentCardPage && (
              <>
                {currentCardPage.title && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: themeColor }} />
                    <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text, flex: 1 }}>{currentCardPage.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{currentSectionIdx + 1}/{cardPages.length}</Text>
                  </View>
                )}
                {(currentCardPage.questions as any[]).map((q: any) => {
                  const globalIdx = questions.findIndex((qq) => qq.id === q.id);
                  return (
                    <QuizQuestionCard
                      key={q.id}
                      question={q}
                      index={globalIdx >= 0 ? globalIdx : 0}
                      userAnswer={answers[q.id]}
                      isFileUploading={!!fileUploading[q.id]}
                      themeColor={themeColor}
                      hasError={!!pwWrong[q.id]}
                      onSelectOption={handleSelectOption}
                      onTextChange={handleCardTextChange}
                      onPickFile={handlePickFile}
                      onZoomQuestion={setZoomQuestion}
                    />
                  );
                })}
                {pwChecking && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <ActivityIndicator size="small" color={themeColor} />
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Memverifikasi password...</Text>
                  </View>
                )}
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {currentSectionIdx > 0 && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}
                  onPress={handlePrevSection}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.text} />
                  <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Sebelumnya</Text>
                </TouchableOpacity>
              )}
              {!isLastCardPage ? (
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1, backgroundColor: themeColor }, pwChecking && { opacity: 0.6 }]}
                  onPress={handleNextSection}
                  disabled={pwChecking}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>Lanjut</Text>
                  <Ionicons name="chevron-forward" size={16} color="#FFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.submitBtn, { flex: 1, backgroundColor: themeColor }, (submitting || pwChecking) && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting || pwChecking}
                  activeOpacity={0.85}
                >
                  {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>{language === 'ID' ? 'Kirim Jawaban' : 'Submit'}</Text>}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
      )}

      {/* Identity was already handled on landing; no extra UI here */}

      {zoomQuestion && (
        <QuestionZoomModal
          visible={!!zoomQuestion}
          question={zoomQuestion}
          index={questions.findIndex((q) => q.id === zoomQuestion.id)}
          userAnswer={answers[zoomQuestion.id]}
          isFileUploading={!!fileUploading[zoomQuestion.id]}
          themeColor={themeColor}
          onClose={() => setZoomQuestion(null)}
          onSelectOption={handleSelectOption}
          onTextChange={handleTextChange}
          onPickFile={handlePickFile}
        />
      )}

      <RestrictedWarningOverlay
        visible={warningVisible}
        countdown={warningCountdown}
        themeColor={themeColor}
        onReenter={handleReenter}
        isPinned={canPin}
        isExpoGo={isExpoGo}
      />

      <ViolatingLockOverlay
        visible={lockedVisible}
        cheatReason={cheatReason}
        lockedAt={lockedAt || undefined}
        onRefresh={handleCheckLockedStatus}
        refreshing={refreshingLock}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  backBtn: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  backBtnText: { color: '#FFF', fontWeight: '700' },
  alreadyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  alreadyIconCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  alreadyTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 24 },
  alreadySub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, textAlign: 'center', marginTop: 8 },
  alreadyBack: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24 },
  alreadyBackText: { fontWeight: '800', fontSize: 14 },
  blockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  blockedIconCircle: { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  blockedTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  blockedDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  blockedBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24 },
  blockedBackText: { fontWeight: '700', fontSize: 14 },
  identityBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  identityLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  identityInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  formHeaderTitle: { flex: 1, fontWeight: '700', fontSize: 14, textAlign: 'center', marginHorizontal: 10 },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  timerText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] as any },
  formScroll: { padding: 16, paddingBottom: 32 },
  submitBtn: { marginTop: 12, paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1 },
  secondaryBtnText: { fontWeight: '700', fontSize: 15 },
});
