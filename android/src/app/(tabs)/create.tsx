import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createForm } from '../../services/api_service';

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'form' | 'quiz'>('form');
  const [requireLogin, setRequireLogin] = useState(false);
  const [submissionLimit, setSubmissionLimit] = useState('Unlimited');
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelectLimit = () => {
    setShowLimitDropdown(!showLimitDropdown);
  };

  const handleCreateForm = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for your form.');
      return;
    }
    if (title.length > 150) {
      Alert.alert('Validation Error', 'Title max 150 characters.');
      return;
    }

    setLoading(true);
    try {
      // Create Form in Backend
      await createForm({
        title: title.trim(),
        description: description.trim(),
        type: type,
        require_login: requireLogin,
        submission_limit: submissionLimit === 'Unlimited' ? 'unlimited' : 'once',
      });

      Alert.alert('Form Created 🎉', 'Your new form has been created successfully! You can add questions to it later.', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setDescription('');
            setType('form');
            setRequireLogin(false);
            setSubmissionLimit('Unlimited');
            router.push('/(tabs)/library');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error Creating Form', err.message || 'Failed to create form.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Page Header */}
      <TouchableOpacity
        style={styles.backBtnRow}
        onPress={() => router.push('/(tabs)/library')}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={16} color="#64748B" />
        <Text style={styles.backBtnText}>Back to forms</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>NEW FORM</Text>
        <Text style={styles.title}>Create a new form</Text>
        <Text style={styles.subtitle}>Start with the basics — you can add questions next.</Text>
      </View>

      {/* Basic Info Card */}
      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Weekly Pop Quiz"
          placeholderTextColor="#94A3B8"
          value={title}
          onChangeText={setTitle}
          maxLength={150}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What is this form about?"
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Type</Text>
        <View style={styles.typeCardsRow}>
          {/* Form Option Card */}
          <TouchableOpacity
            style={[styles.typeCard, type === 'form' && styles.typeCardSelected]}
            onPress={() => setType('form')}
            activeOpacity={0.8}
          >
            <Text style={[styles.typeTitle, type === 'form' && styles.typeTitleSelected]}>Form</Text>
            <Text style={styles.typeSub}>Collect responses</Text>
          </TouchableOpacity>

          {/* Quiz Option Card */}
          <TouchableOpacity
            style={[styles.typeCard, type === 'quiz' && styles.typeCardSelected]}
            onPress={() => setType('quiz')}
            activeOpacity={0.8}
          >
            <Text style={[styles.typeTitle, type === 'quiz' && styles.typeTitleSelected]}>Quiz</Text>
            <Text style={styles.typeSub}>Auto-grade answers</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Card */}
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.switchLabel}>Require login</Text>
            <Text style={styles.switchSub}>Respondents must sign in first.</Text>
          </View>
          <Switch value={requireLogin} onValueChange={setRequireLogin} trackColor={{ false: '#E2E8F0', true: '#6366F1' }} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.switchLabel}>Submission limit</Text>
          <TouchableOpacity style={styles.selectBox} onPress={handleSelectLimit} activeOpacity={0.7}>
            <Text style={styles.selectText}>{submissionLimit}</Text>
            <Ionicons name={showLimitDropdown ? "chevron-up-outline" : "chevron-down-outline"} size={16} color="#64748B" />
          </TouchableOpacity>
          {showLimitDropdown && (
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setSubmissionLimit('Unlimited'); setShowLimitDropdown(false); }}
              >
                <Text style={[styles.dropdownText, submissionLimit === 'Unlimited' && styles.dropdownTextActive]}>Unlimited</Text>
                {submissionLimit === 'Unlimited' && <Ionicons name="checkmark" size={16} color="#6366F1" />}
              </TouchableOpacity>
              <View style={styles.dropdownDivider} />
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setSubmissionLimit('Once per person'); setShowLimitDropdown(false); }}
              >
                <Text style={[styles.dropdownText, submissionLimit === 'Once per person' && styles.dropdownTextActive]}>Once per person</Text>
                {submissionLimit === 'Once per person' && <Ionicons name="checkmark" size={16} color="#6366F1" />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons Footer */}
      <View style={styles.actionFooterRow}>
        <TouchableOpacity
          style={[styles.btnCreateForm, loading && styles.btnDisabled]}
          onPress={handleCreateForm}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnCreateFormText}>Create Form</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnCancel} onPress={() => router.push('/(tabs)/library')}>
          <Text style={styles.btnCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  backBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backBtnText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  header: { marginBottom: 20 },
  eyebrow: { color: '#6366F1', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  title: { color: '#0F172A', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#64748B', fontSize: 14 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  label: { color: '#0F172A', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', color: '#0F172A', padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  typeCardsRow: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  typeCardSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  typeTitle: { color: '#0F172A', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  typeTitleSelected: { color: '#6366F1' },
  typeSub: { color: '#64748B', fontSize: 12 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  switchLabel: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  switchSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    padding: 12, borderRadius: 10, marginTop: 8,
  },
  selectText: { color: '#0F172A', fontSize: 14, fontWeight: '500' },
  dropdownContainer: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, marginTop: 6, paddingVertical: 4, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14 },
  dropdownDivider: { height: 1, backgroundColor: '#F1F5F9' },
  dropdownText: { color: '#0F172A', fontSize: 14 },
  dropdownTextActive: { color: '#6366F1', fontWeight: 'bold' },
  actionFooterRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCreateForm: {
    flex: 1, backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', elevation: 2,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnCreateFormText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  btnCancel: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  btnCancelText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
});
