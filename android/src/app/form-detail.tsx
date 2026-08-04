import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Switch, RefreshControl, Share, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  getFormDetail, updateForm, deleteForm, publishForm,
  getQuestions, createQuestion, updateQuestion,
  deleteQuestion as apiDeleteQuestion,
  getFormResults, getFormAnalytics,
  uploadBanner, deleteBanner, importDocx,
  BASE_URL,
} from '../services/api_service';

type TabType = 'settings' | 'questions' | 'results' | 'analytics';
type QType = 'multiple_choice' | 'checkbox' | 'short_answer' | 'essay';
interface Opt { id?: number; option_text: string; is_correct: boolean; }
interface QDraft {
  question_text: string; type: QType;
  points: number; is_scored: boolean; is_required: boolean; options: Opt[];
}
const Q_TYPES: QType[] = ['multiple_choice', 'checkbox', 'short_answer', 'essay'];
const Q_LABELS: Record<QType, string> = {
  multiple_choice: 'Multiple Choice', checkbox: 'Checkbox',
  short_answer: 'Short Answer', essay: 'Essay',
};

// ── QuestionForm ──────────────────────────────────────────────────────────────
function QuestionForm({ initial, onSave, onCancel, saving, isQuiz }: {
  initial?: QDraft; onSave: (d: QDraft) => void;
  onCancel: () => void; saving: boolean; isQuiz: boolean;
}) {
  const [qType, setQType] = useState<QType>(initial?.type ?? 'multiple_choice');
  const [questionText, setQuestionText] = useState(initial?.question_text ?? '');
  const [points, setPoints] = useState(String(initial?.points ?? 1));
  const [isScored, setIsScored] = useState(initial?.is_scored ?? true);
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? true);
  const [options, setOptions] = useState<Opt[]>(
    initial?.options?.length
      ? initial.options.map(o => ({ ...o }))
      : [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }]
  );
  const needsOptions = qType === 'multiple_choice' || qType === 'checkbox';

  const changeType = (t: QType) => {
    setQType(t);
    if (t === 'short_answer' || t === 'essay') setOptions([]);
    else if (!options.length)
      setOptions([{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }]);
  };

  const setOptField = (i: number, field: keyof Opt, value: any) => {
    setOptions(prev => prev.map((o, idx) => {
      if (field === 'is_correct' && value && qType === 'multiple_choice' && idx !== i)
        return { ...o, is_correct: false };
      return idx === i ? { ...o, [field]: value } : o;
    }));
  };

  const submit = () => {
    if (!questionText.trim()) { Alert.alert('Required', 'Question text cannot be empty.'); return; }
    if (needsOptions && options.filter(o => o.option_text.trim()).length === 0) {
      Alert.alert('Required', 'Add at least one answer option.'); return;
    }
    onSave({
      question_text: questionText.trim(), type: qType,
      points: isScored ? (parseInt(points) || 1) : 0,
      is_scored: isScored, is_required: isRequired,
      options: needsOptions
        ? options.filter(o => o.option_text.trim()).map(o => ({ ...o, option_text: o.option_text.trim() }))
        : [],
    });
  };

  return (
    <View style={qf.wrap}>
      <Text style={qf.label}>Question Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Q_TYPES.map(t => (
            <TouchableOpacity key={t} style={[qf.typePill, qType === t && qf.typePillOn]} onPress={() => changeType(t)}>
              <Text style={[qf.typePillTxt, qType === t && qf.typePillTxtOn]}>{Q_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={qf.label}>Question</Text>
      <TextInput style={[qf.input, { height: 80, textAlignVertical: 'top' }]}
        value={questionText} onChangeText={setQuestionText}
        placeholder="Enter question text..." placeholderTextColor="#94A3B8" multiline />

      <View style={qf.metaRow}>
        {isQuiz && (
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={qf.label}>Points</Text>
            <TextInput style={qf.input} value={points} onChangeText={setPoints}
              keyboardType="number-pad" editable={isScored} placeholderTextColor="#94A3B8" />
          </View>
        )}
        <View style={{ gap: 8 }}>
          {isQuiz && (
            <View style={qf.toggleRow}>
              <Text style={qf.toggleLbl}>Count pts</Text>
              <Switch value={isScored} onValueChange={v => { setIsScored(v); if (!v) setPoints('0'); }}
                trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
            </View>
          )}
          <View style={qf.toggleRow}>
            <Text style={qf.toggleLbl}>Required</Text>
            <Switch value={isRequired} onValueChange={setIsRequired}
              trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
          </View>
        </View>
      </View>

      {needsOptions && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={qf.label}>
              Answer options
              <Text style={{ color: '#94A3B8', fontWeight: '400', fontSize: 11 }}>
                {'  '}{qType === 'multiple_choice' ? 'pick one correct' : 'mark all correct'}
              </Text>
            </Text>
            <TouchableOpacity onPress={() => setOptions(p => [...p, { option_text: '', is_correct: false }])}>
              <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '600' }}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {options.map((opt, i) => (
            <View key={i} style={qf.optRow}>
              <TouchableOpacity
                style={[qf.bubble, opt.is_correct && qf.bubbleOn]}
                onPress={() => setOptField(i, 'is_correct', !opt.is_correct)}>
                {opt.is_correct
                  ? <Ionicons name="checkmark" size={12} color="#FFF" />
                  : <Text style={qf.bubbleLbl}>{String.fromCharCode(65 + i)}</Text>}
              </TouchableOpacity>
              <TextInput style={[qf.input, { flex: 1 }]}
                value={opt.option_text} onChangeText={v => setOptField(i, 'option_text', v)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`} placeholderTextColor="#94A3B8" />
              <TouchableOpacity
                style={[qf.correctBtn, opt.is_correct && qf.correctBtnOn]}
                onPress={() => setOptField(i, 'is_correct', !opt.is_correct)}>
                <Text style={[qf.correctBtnTxt, opt.is_correct && qf.correctBtnTxtOn]}>
                  {opt.is_correct ? 'Correct' : 'Correct?'}
                </Text>
              </TouchableOpacity>
              {options.length > 1 && (
                <TouchableOpacity onPress={() => setOptions(p => p.filter((_, idx) => idx !== i))} style={qf.removeBtn}>
                  <Ionicons name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={qf.actions}>
        <TouchableOpacity style={[qf.saveBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={qf.saveBtnTxt}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={qf.cancelBtn} onPress={onCancel}>
          <Text style={qf.cancelBtnTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FormDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  // form state
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // settings fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formType, setFormType] = useState<'form' | 'quiz'>('form');
  const [status, setStatus] = useState<'draft' | 'published' | 'closed'>('draft');
  const [isPublic, setIsPublic] = useState(true);
  const [requireLogin, setRequireLogin] = useState(false);
  const [submissionLimit, setSubmissionLimit] = useState('unlimited');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('');
  const [themeColor, setThemeColor] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [showLimitDrop, setShowLimitDrop] = useState(false);
  const [showStatusDrop, setShowStatusDrop] = useState(false);

  // questions state
  const [questions, setQuestions] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQ, setEditingQ] = useState<any>(null);
  const [qSaving, setQSaving] = useState(false);
  const [importingDocx, setImportingDocx] = useState(false);

  // results state
  const [results, setResults] = useState<any[]>([]);
  const [resultsMeta, setResultsMeta] = useState<any>(null);

  // analytics state
  const [analytics, setAnalytics] = useState<any>(null);

  const populateForm = (f: any) => {
    setForm(f);
    setTitle(f.title || '');
    setDescription(f.description || '');
    setFormType(f.type || 'form');
    setStatus(f.status || 'draft');
    setIsPublic(f.is_public !== false);
    setRequireLogin(f.require_login === true);
    setSubmissionLimit(f.submission_limit || 'unlimited');
    setShuffleQuestions(f.shuffle_questions === true);
    setShuffleOptions(f.shuffle_options === true);
    setTimerMinutes(f.timer_seconds ? String(Math.round(f.timer_seconds / 60)) : '');
    setThemeColor(f.theme_color || '');
    setStartsAt(f.starts_at || '');
    setEndsAt(f.ends_at || '');
    setThankYouMessage(f.thank_you_message || '');
  };

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const [fRes, qRes, rRes, aRes] = await Promise.all([
        getFormDetail(id),
        getQuestions(id).catch(() => null),
        getFormResults(id).catch(() => null),
        getFormAnalytics(id).catch(() => null),
      ]);
      populateForm(fRes.data ?? fRes);
      setQuestions(Array.isArray(qRes) ? qRes : (qRes?.data?.data ?? qRes?.data ?? []));
      const rData = Array.isArray(rRes) ? rRes : (rRes?.data ?? []);
      setResults(rData);
      setResultsMeta(rRes?.meta ?? null);
      setAnalytics(aRes?.data ?? aRes);
    } catch (err: any) {
      console.log('form-detail loadAll error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Settings actions ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Title cannot be empty.'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(), description: description.trim() || null,
        type: formType, status,
        is_public: isPublic, require_login: requireLogin,
        submission_limit: submissionLimit,
        shuffle_questions: shuffleQuestions, shuffle_options: shuffleOptions,
        timer_seconds: timerMinutes ? parseInt(timerMinutes) * 60 : null,
        theme_color: themeColor || null,
        starts_at: startsAt || null, ends_at: endsAt || null,
        thank_you_message: thankYouMessage || null,
      };
      const res = await updateForm(id, payload);
      populateForm(res.data ?? res);
      Alert.alert('Saved ✓', 'Form settings updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Form', 'All questions and responses will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteForm(id); router.replace('/(tabs)/library'); }
        catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete.'); }
      }},
    ]);
  };

  const handleShareLink = async () => {
    const url = `${BASE_URL.replace('/api', '')}/q/${form?.short_code ?? id}`;
    await Share.share({ message: `"${form?.title}": ${url}`, url });
  };

  const handlePickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.length) return;
    try {
      const asset = result.assets[0];
      const res = await uploadBanner(id, asset.uri, asset.mimeType ?? 'image/jpeg');
      setForm((p: any) => ({ ...p, banner_path: res.banner_path }));
      Alert.alert('Banner uploaded ✓');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleRemoveBanner = () => {
    Alert.alert('Remove banner?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteBanner(id); setForm((p: any) => ({ ...p, banner_path: null })); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  // ── Questions actions ───────────────────────────────────────────────────────
  const handleSaveQuestion = async (draft: QDraft) => {
    setQSaving(true);
    try {
      if (editingQ) {
        const res = await updateQuestion(editingQ.id, draft);
        setQuestions(p => p.map(q => q.id === editingQ.id ? (res.data ?? res) : q));
      } else {
        const res = await createQuestion(id, draft);
        setQuestions(p => [...p, res.data ?? res]);
      }
      setShowAddForm(false);
      setEditingQ(null);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to save question.'); }
    finally { setQSaving(false); }
  };

  const handleDeleteQ = (q: any) => {
    Alert.alert('Delete question?', `"${q.question_text?.slice(0, 60)}"`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiDeleteQuestion(q.id); setQuestions(p => p.filter(x => x.id !== q.id)); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleImportDocx = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      if (result.canceled || !result.assets?.length) return;
      setImportingDocx(true);
      const res = await importDocx(id, result.assets[0].uri);
      Alert.alert('Imported ✓', res.message || `${res.imported_count ?? 0} question(s) imported.`);
      const qRes = await getQuestions(id).catch(() => null);
      setQuestions(Array.isArray(qRes) ? qRes : (qRes?.data?.data ?? qRes?.data ?? []));
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to import DOCX.'); }
    finally { setImportingDocx(false); }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={s.loadingTxt}>Loading workspace...</Text>
      </View>
    );
  }

  const publicLink = `${BASE_URL.replace('/api', '')}/q/${form?.short_code ?? id}`;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#6366F1" />}
      keyboardShouldPersistTaps="handled">

      {/* Back */}
      <TouchableOpacity style={s.backRow} onPress={() => router.replace('/(tabs)/library')}>
        <Ionicons name="arrow-back" size={16} color="#64748B" />
        <Text style={s.backTxt}>Back to forms</Text>
      </TouchableOpacity>

      {/* Page header */}
      <View style={s.pageHeader}>
        <Text style={s.eyebrow}>
          {activeTab === 'settings' ? 'FORM WORKSPACE'
            : activeTab === 'questions' ? 'FORM BUILDER'
            : activeTab === 'results' ? 'RESPONSES' : 'INSIGHTS'}
        </Text>
        <Text style={s.pageTitle}>{form?.title ?? 'Form Workspace'}</Text>
        <View style={s.badgeRow}>
          <View style={[s.statusBadge,
            form?.status === 'published' ? s.badgePublished
            : form?.status === 'closed' ? s.badgeClosed : s.badgeDraft]}>
            <Text style={[s.statusTxt,
              form?.status === 'published' ? s.txtPublished
              : form?.status === 'closed' ? s.txtClosed : s.txtDraft]}>
              {form?.status === 'published' ? 'Published'
                : form?.status === 'closed' ? 'Closed' : 'Draft'}
            </Text>
          </View>
          <View style={s.typeBadge}>
            <Text style={s.typeTxt}>{form?.type === 'quiz' ? 'Quiz' : 'Form'}</Text>
          </View>
        </View>
      </View>

      {/* Tab pills */}
      <View style={s.tabBar}>
        {([['settings','settings-outline'],['questions','help-circle-outline'],
           ['results','document-text-outline'],['analytics','bar-chart-outline']] as const).map(([tab, icon]) => (
          <TouchableOpacity key={tab} style={[s.tabPill, activeTab === tab && s.tabPillOn]}
            onPress={() => setActiveTab(tab as TabType)}>
            <Ionicons name={icon as any} size={13} color={activeTab === tab ? '#6366F1' : '#64748B'} />
            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtOn]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════ TAB: SETTINGS ══════════════ */}
      {activeTab === 'settings' && (
        <View style={s.tabContent}>

          {/* Share */}
          <View style={s.card}>
            <View style={s.cardHead}><Ionicons name="share-social-outline" size={16} color="#6366F1" /><Text style={s.cardTitle}>Share</Text></View>
            <Text style={s.fieldLbl}>Public Link</Text>
            <View style={s.linkBox}><Text style={s.linkTxt} numberOfLines={1}>{publicLink}</Text></View>
            <View style={s.rowBtns}>
              <TouchableOpacity style={s.btnSecondary} onPress={handleShareLink}>
                <Ionicons name="copy-outline" size={14} color="#0F172A" />
                <Text style={s.btnSecondaryTxt}>Share Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnDanger} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={s.btnDangerTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Banner */}
          <View style={s.card}>
            <View style={s.cardHead}><Ionicons name="image-outline" size={16} color="#6366F1" /><Text style={s.cardTitle}>Banner</Text></View>
            {form?.banner_path ? (
              <View>
                <Image source={{ uri: form.banner_path }} style={s.bannerImg} resizeMode="cover" />
                <View style={s.rowBtns}>
                  <TouchableOpacity style={[s.btnSecondary, { flex: 1 }]} onPress={handlePickBanner}>
                    <Ionicons name="cloud-upload-outline" size={14} color="#0F172A" />
                    <Text style={s.btnSecondaryTxt}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnDanger, { flex: 1 }]} onPress={handleRemoveBanner}>
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    <Text style={s.btnDangerTxt}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.bannerEmpty} onPress={handlePickBanner}>
                <Ionicons name="image-outline" size={28} color="#94A3B8" />
                <Text style={s.bannerEmptyTxt}>Upload a banner</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Basic Information */}
          <View style={s.card}>
            <View style={s.cardHead}><Ionicons name="information-circle-outline" size={16} color="#6366F1" /><Text style={s.cardTitle}>Basic Information</Text></View>
            <Text style={s.fieldLbl}>Title</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Form title..." placeholderTextColor="#94A3B8" />
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Description</Text>
            <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              value={description} onChangeText={setDescription}
              placeholder="What is this form about?" placeholderTextColor="#94A3B8" multiline />
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Type</Text>
            <View style={s.typeRow}>
              {(['form','quiz'] as const).map(t => (
                <TouchableOpacity key={t} style={[s.typeCard, formType === t && s.typeCardOn]} onPress={() => setFormType(t)}>
                  <Text style={[s.typeCardTitle, formType === t && { color: '#6366F1' }]}>{t === 'form' ? 'Form' : 'Quiz'}</Text>
                  <Text style={s.typeCardSub}>{t === 'form' ? 'Collect responses' : 'Auto-grade answers'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Status</Text>
            <TouchableOpacity style={s.selectBox} onPress={() => setShowStatusDrop(v => !v)}>
              <Text style={s.selectTxt}>{status === 'published' ? 'Published' : status === 'closed' ? 'Closed' : 'Draft'}</Text>
              <Ionicons name={showStatusDrop ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color="#64748B" />
            </TouchableOpacity>
            {showStatusDrop && (
              <View style={s.dropdown}>
                {(['draft','published','closed'] as const).map(st => (
                  <TouchableOpacity key={st} style={s.dropItem} onPress={() => { setStatus(st); setShowStatusDrop(false); }}>
                    <Text style={[s.dropTxt, status === st && { color: '#6366F1', fontWeight: 'bold' }]}>
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </Text>
                    {status === st && <Ionicons name="checkmark" size={15} color="#6366F1" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Submission limit</Text>
            <TouchableOpacity style={s.selectBox} onPress={() => setShowLimitDrop(v => !v)}>
              <Text style={s.selectTxt}>{submissionLimit === 'unlimited' ? 'Unlimited' : 'Once per person'}</Text>
              <Ionicons name={showLimitDrop ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color="#64748B" />
            </TouchableOpacity>
            {showLimitDrop && (
              <View style={s.dropdown}>
                {[['unlimited','Unlimited'],['once','Once per person']].map(([val,lbl]) => (
                  <TouchableOpacity key={val} style={s.dropItem} onPress={() => { setSubmissionLimit(val); setShowLimitDrop(false); }}>
                    <Text style={[s.dropTxt, submissionLimit === val && { color: '#6366F1', fontWeight: 'bold' }]}>{lbl}</Text>
                    {submissionLimit === val && <Ionicons name="checkmark" size={15} color="#6366F1" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Access */}
          <View style={s.card}>
            <View style={s.cardHead}><Ionicons name="lock-closed-outline" size={16} color="#6366F1" /><Text style={s.cardTitle}>Access</Text></View>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLbl}>Public form</Text>
                <Text style={s.switchSub}>Anyone with the link can answer.</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
            </View>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLbl}>Require login</Text>
                <Text style={s.switchSub}>Respondents must sign in first.</Text>
              </View>
              <Switch value={requireLogin} onValueChange={setRequireLogin} trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
            </View>
          </View>

          {/* Behavior */}
          <View style={s.card}>
            <View style={s.cardHead}><Ionicons name="options-outline" size={16} color="#6366F1" /><Text style={s.cardTitle}>Behavior</Text></View>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLbl}>Shuffle questions</Text>
                <Text style={s.switchSub}>Randomize the order for each respondent.</Text>
              </View>
              <Switch value={shuffleQuestions} onValueChange={setShuffleQuestions} trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
            </View>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLbl}>Shuffle options</Text>
                <Text style={s.switchSub}>Randomize answer order for each respondent.</Text>
              </View>
              <Switch value={shuffleOptions} onValueChange={setShuffleOptions} trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
            </View>
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Time limit (minutes)</Text>
            <TextInput style={s.input} value={timerMinutes} onChangeText={setTimerMinutes}
              placeholder="e.g. 10 — leave empty for no limit" placeholderTextColor="#94A3B8"
              keyboardType="number-pad" />
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Theme color (hex)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {themeColor ? (
                <View style={[s.colorSwatch, { backgroundColor: themeColor }]} />
              ) : (
                <View style={[s.colorSwatch, { backgroundColor: '#6C5CE7' }]} />
              )}
              <TextInput style={[s.input, { flex: 1 }]} value={themeColor} onChangeText={setThemeColor}
                placeholder="#6C5CE7" placeholderTextColor="#94A3B8" autoCapitalize="none" />
            </View>
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Opens at</Text>
            <TextInput style={s.input} value={startsAt} onChangeText={setStartsAt}
              placeholder="dd-mm-yyyy hh:mm:ss" placeholderTextColor="#94A3B8" />
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Closes at</Text>
            <TextInput style={s.input} value={endsAt} onChangeText={setEndsAt}
              placeholder="dd-mm-yyyy hh:mm:ss" placeholderTextColor="#94A3B8" />
            <Text style={[s.fieldLbl, { marginTop: 12 }]}>Thank you message</Text>
            <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              value={thankYouMessage} onChangeText={setThankYouMessage}
              placeholder="Thank you for filling out this form" placeholderTextColor="#94A3B8" multiline />
          </View>

          {/* Save button */}
          <TouchableOpacity style={[s.btnPrimary, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnPrimaryTxt}>Save Settings</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════════ TAB: QUESTIONS ══════════════ */}
      {activeTab === 'questions' && (
        <View style={s.tabContent}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.sectionTitle}>Questions ({questions.length})</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.btnOutline} onPress={handleImportDocx} disabled={importingDocx}>
                {importingDocx
                  ? <ActivityIndicator size="small" color="#6366F1" />
                  : <><Ionicons name="cloud-upload-outline" size={14} color="#6366F1" /><Text style={s.btnOutlineTxt}>Import DOCX</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimarySmall}
                onPress={() => { setEditingQ(null); setShowAddForm(true); }}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={s.btnPrimarySmallTxt}>Add Question</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Inline Add Form */}
          {showAddForm && !editingQ && (
            <View style={s.card}>
              <Text style={[s.cardTitle, { marginBottom: 12 }]}>Add New Question</Text>
              <QuestionForm isQuiz={formType === 'quiz'} saving={qSaving}
                onSave={handleSaveQuestion} onCancel={() => setShowAddForm(false)} />
            </View>
          )}

          {/* Empty state */}
          {questions.length === 0 && !showAddForm && (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}><Ionicons name="help-circle-outline" size={32} color="#94A3B8" /></View>
              <Text style={s.emptyTitle}>No questions yet</Text>
              <Text style={s.emptySub}>Add your first question, or import one from a DOCX file.</Text>
              <TouchableOpacity style={s.btnPrimarySmall} onPress={() => { setEditingQ(null); setShowAddForm(true); }}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={s.btnPrimarySmallTxt}>Add Question</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Question cards */}
          {questions.map((q, idx) => (
            <View key={q.id ?? idx}>
              <View style={s.qCard}>
                <View style={s.qCardHead}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={s.qNumBubble}><Text style={s.qNumTxt}>{idx + 1}</Text></View>
                    <View style={s.qTypeBadge}><Text style={s.qTypeTxt}>{Q_LABELS[q.type as QType] ?? q.type}</Text></View>
                    {formType === 'quiz' && q.is_scored && q.points > 0 && (
                      <Text style={s.qPtsTxt}>{q.points} pts</Text>
                    )}
                    {formType === 'quiz' && !q.is_scored && (
                      <Text style={s.qPtsTxt}>Not scored</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity style={s.qActionBtn}
                      onPress={() => { setEditingQ(q); setShowAddForm(true); }}>
                      <Text style={s.qEditTxt}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.qActionBtn} onPress={() => handleDeleteQ(q)}>
                      <Text style={s.qDeleteTxt}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={s.qText}>{q.question_text ?? 'Untitled'}</Text>
                {q.options?.length > 0 && (
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {q.options.map((opt: any, oi: number) => (
                      <View key={opt.id ?? oi} style={s.optRow}>
                        {q.type === 'checkbox'
                          ? <View style={[s.optCheck, opt.is_correct && s.optCheckOn]}>
                              {opt.is_correct && <Ionicons name="checkmark" size={11} color="#FFF" />}
                            </View>
                          : <View style={[s.optBubble, opt.is_correct && s.optBubbleOn]}>
                              {opt.is_correct
                                ? <Ionicons name="checkmark" size={11} color="#FFF" />
                                : <Text style={s.optBubbleLbl}>{String.fromCharCode(65 + oi)}</Text>}
                            </View>}
                        <Text style={[s.optTxt, opt.is_correct && { color: '#10B981', fontWeight: '600' }]}>
                          {opt.option_text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              {/* Inline Edit Form */}
              {showAddForm && editingQ?.id === q.id && (
                <View style={[s.card, { marginTop: 8 }]}>
                  <Text style={[s.cardTitle, { marginBottom: 12 }]}>Edit Question {idx + 1}</Text>
                  <QuestionForm isQuiz={formType === 'quiz'} saving={qSaving}
                    initial={{ question_text: q.question_text, type: q.type, points: q.points,
                      is_scored: q.is_scored !== false, is_required: q.is_required,
                      options: q.options?.map((o: any) => ({ id: o.id, option_text: o.option_text, is_correct: o.is_correct })) ?? [] }}
                    onSave={handleSaveQuestion}
                    onCancel={() => { setShowAddForm(false); setEditingQ(null); }} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ══════════════ TAB: RESULTS ══════════════ */}
      {activeTab === 'results' && (
        <View style={s.tabContent}>
          <Text style={s.sectionTitle}>Submissions ({resultsMeta?.total ?? results.length})</Text>
          {results.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}><Ionicons name="document-text-outline" size={32} color="#94A3B8" /></View>
              <Text style={s.emptyTitle}>No submissions yet</Text>
              <Text style={s.emptySub}>Share your form link to start receiving responses.</Text>
            </View>
          ) : results.map((r: any, i: number) => (
            <View key={r.submission_id ?? r.id ?? i} style={s.resultCard}>
              <View style={s.resultHead}>
                <Text style={s.resultName}>{r.respondent_name ?? 'Anonymous'}</Text>
                <Text style={s.resultDate}>
                  {r.submitted_at ? new Date(r.submitted_at.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$2-$1')).toLocaleDateString() : '—'}
                </Text>
              </View>
              {r.respondent_email ? <Text style={s.resultEmail}>{r.respondent_email}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {r.score !== undefined && r.score !== null && (
                  <View style={s.scoreBadge}>
                    <Text style={s.scoreTxt}>Score: {r.score} / {r.max_score ?? '—'}</Text>
                  </View>
                )}
                {r.answer_summary ? (
                  <Text style={s.answerSummary} numberOfLines={2}>{r.answer_summary}</Text>
                ) : null}
                <View style={[s.statusBadge,
                  r.status === 'submitted' ? s.badgePublished
                  : r.status === 'auto_submitted' ? s.badgeClosed : s.badgeDraft]}>
                  <Text style={[s.statusTxt,
                    r.status === 'submitted' ? s.txtPublished
                    : r.status === 'auto_submitted' ? s.txtClosed : s.txtDraft]}>
                    {r.status ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ══════════════ TAB: ANALYTICS ══════════════ */}
      {activeTab === 'analytics' && (
        <View style={s.tabContent}>
          {form?.type === 'quiz' ? (
            <>
              <View style={s.statGrid}>
                {[
                  { label: 'Participants', value: analytics?.total_participants ?? 0 },
                  { label: 'Avg Score', value: analytics?.average_score != null ? Number(analytics.average_score).toFixed(1) : '—' },
                  { label: 'Highest', value: analytics?.highest_score ?? '—' },
                  { label: 'Lowest', value: analytics?.lowest_score ?? '—' },
                ].map((item, i) => (
                  <View key={i} style={s.statCard}>
                    <Text style={s.statLbl}>{item.label}</Text>
                    <Text style={s.statVal}>{item.value}</Text>
                  </View>
                ))}
              </View>
              <View style={s.card}>
                <Text style={s.cardTitle}>Correct vs Wrong</Text>
                {analytics?.correct_rate != null ? (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[s.rateBar, { flex: analytics.correct_rate, backgroundColor: '#10B981' }]} />
                      <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '700' }}>
                        {(analytics.correct_rate * 100).toFixed(0)}% correct
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[s.rateBar, { flex: analytics.wrong_rate, backgroundColor: '#EF4444' }]} />
                      <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>
                        {(analytics.wrong_rate * 100).toFixed(0)}% wrong
                      </Text>
                    </View>
                  </View>
                ) : <Text style={s.emptySub}>No data yet</Text>}
              </View>
              <View style={s.card}>
                <Text style={s.cardTitle}>Per Question Stats</Text>
                {analytics?.per_question_stats?.length ? analytics.per_question_stats.map((qs: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <Text style={{ color: '#0F172A', fontSize: 13 }} numberOfLines={2}>Q{i + 1}</Text>
                    <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '600' }}>✓ {qs.correct_count}</Text>
                    <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>✗ {qs.wrong_count}</Text>
                  </View>
                )) : <Text style={s.emptySub}>No data yet</Text>}
              </View>
            </>
          ) : (
            <>
              <View style={s.statGrid}>
                {[
                  { label: 'Participants', value: analytics?.total_participants ?? 0 },
                  { label: 'Total Answers', value: analytics?.total_answers ?? 0 },
                  { label: 'Completion', value: analytics?.completion_rate != null ? `${(analytics.completion_rate * 100).toFixed(0)}%` : '—' },
                  { label: 'Avg Answers', value: analytics?.avg_answers != null ? Number(analytics.avg_answers).toFixed(1) : '—' },
                ].map((item, i) => (
                  <View key={i} style={s.statCard}>
                    <Text style={s.statLbl}>{item.label}</Text>
                    <Text style={s.statVal}>{item.value}</Text>
                  </View>
                ))}
              </View>
              {analytics?.question_stats?.map((qs: any, i: number) => (
                <View key={i} style={s.card}>
                  <Text style={s.cardTitle} numberOfLines={2}>{qs.question_text}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                    {qs.answered} answered · {qs.skipped} skipped
                  </Text>
                  {qs.most_selected ? (
                    <Text style={{ color: '#6366F1', fontSize: 13, fontWeight: '600', marginTop: 6 }}>
                      Most selected: {qs.most_selected} ({qs.most_selected_pct}%)
                    </Text>
                  ) : null}
                  {qs.option_breakdown?.map((ob: any, oi: number) => (
                    <View key={oi} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
                        <View style={{ width: `${ob.pct}%`, height: '100%', backgroundColor: '#6366F1', borderRadius: 3 }} />
                      </View>
                      <Text style={{ width: 80, fontSize: 11, color: '#64748B' }} numberOfLines={1}>{ob.option_text}</Text>
                      <Text style={{ fontSize: 11, color: '#0F172A', fontWeight: '600', width: 36, textAlign: 'right' }}>{ob.pct}%</Text>
                    </View>
                  ))}
                  {qs.sample_answers?.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Sample answers:</Text>
                      {qs.sample_answers.slice(0, 3).map((a: string, ai: number) => (
                        <Text key={ai} style={{ fontSize: 13, color: '#0F172A', paddingLeft: 8 }}>· {a}</Text>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              {!analytics?.question_stats?.length && (
                <View style={s.emptyCard}>
                  <Text style={s.emptyTitle}>No analytics yet</Text>
                  <Text style={s.emptySub}>Data will appear once respondents submit.</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', gap: 8 },
  loadingTxt: { color: '#64748B', fontSize: 14 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backTxt: { color: '#64748B', fontSize: 14, fontWeight: '500' },

  pageHeader: { marginBottom: 16 },
  eyebrow: { color: '#6366F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  pageTitle: { color: '#0F172A', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePublished: { backgroundColor: '#ECFDF5' },
  badgeDraft: { backgroundColor: '#FEF3C7' },
  badgeClosed: { backgroundColor: '#F1F5F9' },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  txtPublished: { color: '#10B981' },
  txtDraft: { color: '#D97706' },
  txtClosed: { color: '#64748B' },
  typeBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  typeTxt: { color: '#3B82F6', fontSize: 11, fontWeight: '700' },

  tabBar: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12, marginBottom: 20 },
  tabPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 8, borderRadius: 8 },
  tabPillOn: { backgroundColor: '#FFFFFF', elevation: 1 },
  tabTxt: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  tabTxtOn: { color: '#6366F1', fontWeight: 'bold' },

  tabContent: { gap: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { color: '#0F172A', fontSize: 15, fontWeight: 'bold' },
  fieldLbl: { color: '#0F172A', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#FFFFFF', color: '#0F172A', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14 },
  linkBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  linkTxt: { color: '#6366F1', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  rowBtns: { flexDirection: 'row', gap: 10 },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  btnSecondaryTxt: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  btnDanger: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  btnDangerTxt: { color: '#EF4444', fontWeight: '600', fontSize: 13 },
  btnPrimary: { backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  btnPrimarySmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6366F1', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  btnPrimarySmallTxt: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#6366F1', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnOutlineTxt: { color: '#6366F1', fontWeight: '600', fontSize: 13 },

  bannerImg: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },
  bannerEmpty: { height: 120, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bannerEmptyTxt: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  colorSwatch: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },

  typeRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  typeCard: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  typeCardOn: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  typeCardTitle: { color: '#0F172A', fontSize: 14, fontWeight: 'bold' },
  typeCardSub: { color: '#64748B', fontSize: 11, marginTop: 2 },

  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 8, marginTop: 6 },
  selectTxt: { color: '#0F172A', fontSize: 14 },
  dropdown: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginTop: 4, overflow: 'hidden', elevation: 2 },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dropTxt: { color: '#0F172A', fontSize: 14 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  switchLbl: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  switchSub: { color: '#64748B', fontSize: 12, marginTop: 1 },

  sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: 'bold' },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  emptyIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 16 },

  qCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  qCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qNumBubble: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  qNumTxt: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  qTypeBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  qTypeTxt: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  qPtsTxt: { color: '#94A3B8', fontSize: 12 },
  qActionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  qEditTxt: { color: '#6366F1', fontSize: 12, fontWeight: '600' },
  qDeleteTxt: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  qText: { color: '#0F172A', fontSize: 15, fontWeight: '600' },

  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 6 },
  optBubble: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  optBubbleOn: { borderColor: '#10B981', backgroundColor: '#10B981' },
  optBubbleLbl: { color: '#64748B', fontSize: 10, fontWeight: 'bold' },
  optCheck: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  optCheckOn: { borderColor: '#10B981', backgroundColor: '#10B981' },
  optTxt: { color: '#0F172A', fontSize: 13, flex: 1 },

  resultCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  resultName: { color: '#0F172A', fontSize: 15, fontWeight: 'bold' },
  resultDate: { color: '#94A3B8', fontSize: 12 },
  resultEmail: { color: '#64748B', fontSize: 13 },
  scoreBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  scoreTxt: { color: '#10B981', fontSize: 12, fontWeight: 'bold' },
  answerSummary: { color: '#64748B', fontSize: 12, flex: 1 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
  statLbl: { color: '#64748B', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statVal: { color: '#0F172A', fontSize: 24, fontWeight: 'bold' },
  rateBar: { height: 8, borderRadius: 4, minWidth: 4 },
});

// ── QuestionForm styles ───────────────────────────────────────────────────────
const qf = StyleSheet.create({
  wrap: { gap: 12 },
  label: { color: '#0F172A', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#FFF', color: '#0F172A', padding: 11, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14 },
  typePill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  typePillOn: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  typePillTxt: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  typePillTxtOn: { color: '#6366F1' },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  togglesCol: { gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLbl: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  smallInput: { width: 80 },
  optionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optionsHint: { color: '#94A3B8', fontSize: 11, fontWeight: '400' },
  addOptionBtn: { color: '#6366F1', fontSize: 13, fontWeight: '600' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bubble: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  bubbleOn: { borderColor: '#10B981', backgroundColor: '#10B981' },
  bubbleLbl: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },
  correctBtn: { backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  correctBtnOn: { backgroundColor: '#ECFDF5' },
  correctBtnTxt: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  correctBtnTxtOn: { color: '#10B981' },
  removeBtn: { padding: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveBtn: { flex: 1, backgroundColor: '#6366F1', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  cancelBtn: { backgroundColor: '#F1F5F9', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtnTxt: { color: '#64748B', fontWeight: '600', fontSize: 14 },
});
