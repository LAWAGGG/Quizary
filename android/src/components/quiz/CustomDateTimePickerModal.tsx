import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

interface CustomDateTimePickerModalProps {
  visible: boolean;
  mode: 'date' | 'time' | 'datetime';
  initialValue?: string;
  themeColor?: string;
  onConfirm: (formattedValue: string) => void;
  onCancel: () => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const ITEM_HEIGHT = 48;

export const CustomDateTimePickerModal: React.FC<CustomDateTimePickerModalProps> = ({
  visible,
  mode,
  initialValue,
  themeColor,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useAppTheme();
  const activeColor = themeColor || colors.primary || '#06B6D4';

  const [step, setStep] = useState<'date' | 'time'>('date');

  // Date state
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [day, setDay] = useState<number>(new Date().getDate()); // 1-31

  // Time state
  const [hour, setHour] = useState<number>(new Date().getHours()); // 0-23
  const [minute, setMinute] = useState<number>(new Date().getMinutes()); // 0-59

  // ScrollView Refs & Initialization Flag
  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const isInitializedRef = useRef<boolean>(false);

  // Max days in current month/year
  const daysInMonth = new Date(year, month, 0).getDate();
  useEffect(() => {
    if (day > daysInMonth) {
      setDay(daysInMonth);
    }
  }, [month, year, daysInMonth, day]);

  // Generate lists (1970 to 2070)
  const years = Array.from({ length: 101 }, (_, i) => 1970 + i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Initialize values and scroll wheels when modal opens
  useEffect(() => {
    if (!visible) return;
    isInitializedRef.current = false;

    if (mode === 'time') {
      setStep('time');
    } else {
      setStep('date');
    }

    const now = new Date();
    let initYear = now.getFullYear();
    let initMonth = now.getMonth() + 1;
    let initDay = now.getDate();
    let initHour = now.getHours();
    let initMin = now.getMinutes();

    if (initialValue && typeof initialValue === 'string' && initialValue.trim().length > 0) {
      const val = initialValue.trim();
      if (val.includes('T')) {
        const [dPart, tPart] = val.split('T');
        if (dPart) {
          const p = dPart.split('-');
          if (p.length === 3) {
            initYear = parseInt(p[0], 10) || initYear;
            initMonth = parseInt(p[1], 10) || initMonth;
            initDay = parseInt(p[2], 10) || initDay;
          }
        }
        if (tPart) {
          const p = tPart.split(/[:.]/);
          if (p.length >= 2) {
            initHour = parseInt(p[0], 10) ?? initHour;
            initMin = parseInt(p[1], 10) ?? initMin;
          }
        }
      } else if (val.includes('-')) {
        const p = val.split('-');
        if (p.length === 3) {
          initYear = parseInt(p[0], 10) || initYear;
          initMonth = parseInt(p[1], 10) || initMonth;
          initDay = parseInt(p[2], 10) || initDay;
        }
      } else if (val.includes(':')) {
        const p = val.split(/[:.]/);
        if (p.length >= 2) {
          initHour = parseInt(p[0], 10) ?? initHour;
          initMin = parseInt(p[1], 10) ?? initMin;
        }
      }
    }

    setYear(initYear);
    setMonth(initMonth);
    setDay(initDay);
    setHour(initHour);
    setMinute(initMin);

    const timer = setTimeout(() => {
      const targetStep = mode === 'time' ? 'time' : 'date';
      if (targetStep === 'date') {
        monthScrollRef.current?.scrollTo({ y: (initMonth - 1) * ITEM_HEIGHT, animated: false });
        dayScrollRef.current?.scrollTo({ y: (initDay - 1) * ITEM_HEIGHT, animated: false });
        const yIndex = years.indexOf(initYear);
        if (yIndex >= 0) {
          yearScrollRef.current?.scrollTo({ y: yIndex * ITEM_HEIGHT, animated: false });
        }
      } else {
        hourScrollRef.current?.scrollTo({ y: initHour * ITEM_HEIGHT, animated: false });
        minuteScrollRef.current?.scrollTo({ y: initMin * ITEM_HEIGHT, animated: false });
      }

      // Mark initialized after initial scroll position is locked
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }, 120);

    return () => clearTimeout(timer);
  }, [visible, mode, initialValue]);

  // Auto scroll to selected position when switching steps (datetime mode)
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (step === 'date') {
        monthScrollRef.current?.scrollTo({ y: (month - 1) * ITEM_HEIGHT, animated: false });
        dayScrollRef.current?.scrollTo({ y: (day - 1) * ITEM_HEIGHT, animated: false });
        const yIndex = years.indexOf(year);
        if (yIndex >= 0) {
          yearScrollRef.current?.scrollTo({ y: yIndex * ITEM_HEIGHT, animated: false });
        }
      } else {
        hourScrollRef.current?.scrollTo({ y: hour * ITEM_HEIGHT, animated: false });
        minuteScrollRef.current?.scrollTo({ y: minute * ITEM_HEIGHT, animated: false });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [step]);

  const handleNextOrConfirm = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = String(year).padStart(4, '0');
    const mm = pad(month);
    const dd = pad(day);
    const hh = pad(hour);
    const min = pad(minute);

    if (mode === 'datetime' && step === 'date') {
      setStep('time');
      return;
    }

    if (mode === 'date') {
      onConfirm(`${yyyy}-${mm}-${dd}`);
    } else if (mode === 'time') {
      onConfirm(`${hh}:${min}`);
    } else if (mode === 'datetime') {
      onConfirm(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    }
  };

  const handleQuickToday = () => {
    isInitializedRef.current = true;
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setDay(now.getDate());
    setHour(now.getHours());
    setMinute(now.getMinutes());

    if (step === 'date') {
      monthScrollRef.current?.scrollTo({ y: (now.getMonth()) * ITEM_HEIGHT, animated: true });
      dayScrollRef.current?.scrollTo({ y: (now.getDate() - 1) * ITEM_HEIGHT, animated: true });
      const yIndex = years.indexOf(now.getFullYear());
      if (yIndex >= 0) {
        yearScrollRef.current?.scrollTo({ y: yIndex * ITEM_HEIGHT, animated: true });
      }
    } else {
      hourScrollRef.current?.scrollTo({ y: now.getHours() * ITEM_HEIGHT, animated: true });
      minuteScrollRef.current?.scrollTo({ y: now.getMinutes() * ITEM_HEIGHT, animated: true });
    }
  };

  // Scroll End Handler Helper with Instant Pixel Precision (animated: false to avoid jumping)
  const handleScrollEnd = (
    scrollRef: React.RefObject<ScrollView | null>,
    e: NativeSyntheticEvent<NativeScrollEvent>,
    maxLen: number,
    setter: (val: number) => void,
    getValue: (idx: number) => number
  ) => {
    if (!isInitializedRef.current) return;
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(Math.round(y / ITEM_HEIGHT), maxLen - 1));
    const targetY = idx * ITEM_HEIGHT;
    setter(getValue(idx));

    // Instantly lock to targetY without visible jump animation
    if (Math.abs(y - targetY) > 0.5) {
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
    }
  };

  const handleDragEnd = (
    scrollRef: React.RefObject<ScrollView | null>,
    e: NativeSyntheticEvent<NativeScrollEvent>,
    maxLen: number,
    setter: (val: number) => void,
    getValue: (idx: number) => number
  ) => {
    if (!isInitializedRef.current) return;
    const vy = e.nativeEvent.velocity?.y || 0;
    if (Math.abs(vy) < 0.1) {
      handleScrollEnd(scrollRef, e, maxLen, setter, getValue);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={step === 'date' ? 'calendar-outline' : 'time-outline'}
                size={22}
                color={activeColor}
              />
              <Text style={styles.headerTitle}>
                {mode === 'date'
                  ? 'Pilih Tanggal'
                  : mode === 'time'
                  ? 'Pilih Waktu'
                  : step === 'date'
                  ? 'Pilih Tanggal (1/2)'
                  : 'Pilih Waktu (2/2)'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Mode Step Indicators for datetime */}
          {mode === 'datetime' && (
            <View style={styles.stepTabs}>
              <TouchableOpacity
                style={[styles.stepTab, step === 'date' && { backgroundColor: activeColor }]}
                onPress={() => setStep('date')}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={14} color={step === 'date' ? '#FFF' : '#64748B'} />
                <Text style={[styles.stepTabText, step === 'date' && styles.stepTabTextActive]}>
                  Tanggal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepTab, step === 'time' && { backgroundColor: activeColor }]}
                onPress={() => setStep('time')}
                activeOpacity={0.8}
              >
                <Ionicons name="time" size={14} color={step === 'time' ? '#FFF' : '#64748B'} />
                <Text style={[styles.stepTabText, step === 'time' && styles.stepTabTextActive]}>
                  Waktu
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Preview Box */}
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Terpilih:</Text>
            <Text style={[styles.previewValue, { color: activeColor }]}>
              {step === 'date' || mode === 'date'
                ? `${day} ${MONTH_NAMES[month - 1] || ''} ${year}`
                : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
            </Text>
          </View>

          {/* Column Titles Header Row */}
          {step === 'date' ? (
            <View style={styles.columnTitlesRow}>
              <Text style={styles.columnTitle}>BULAN</Text>
              <Text style={styles.columnTitle}>TGL</Text>
              <Text style={styles.columnTitle}>TAHUN</Text>
            </View>
          ) : (
            <View style={styles.columnTitlesRow}>
              <Text style={styles.columnTitle}>JAM</Text>
              <Text style={styles.columnTitle}>MENIT</Text>
            </View>
          )}

          {/* Wheel Selector Body */}
          {step === 'date' ? (
            <View style={styles.pickerContainer}>
              {/* Highlight selection bar */}
              <View
                style={[
                  styles.selectionHighlight,
                  { borderColor: activeColor, backgroundColor: activeColor + '1F' },
                ]}
                pointerEvents="none"
              />

              {/* Month Column */}
              <View style={styles.column}>
                <ScrollView
                  ref={monthScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  nestedScrollEnabled={true}
                  overScrollMode="never"
                  contentContainerStyle={styles.scrollContent}
                  onMomentumScrollEnd={(e) => handleScrollEnd(monthScrollRef, e, 12, setMonth, (i) => i + 1)}
                  onScrollEndDrag={(e) => handleDragEnd(monthScrollRef, e, 12, setMonth, (i) => i + 1)}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {MONTH_NAMES.map((mName, idx) => {
                    const isSelected = month === idx + 1;
                    return (
                      <TouchableOpacity
                        key={mName}
                        style={styles.pickerItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setMonth(idx + 1);
                          monthScrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            isSelected && [styles.pickerTextSelected, { color: activeColor }],
                          ]}
                        >
                          {mName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>

              {/* Day Column */}
              <View style={styles.column}>
                <ScrollView
                  ref={dayScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  nestedScrollEnabled={true}
                  overScrollMode="never"
                  contentContainerStyle={styles.scrollContent}
                  onMomentumScrollEnd={(e) => handleScrollEnd(dayScrollRef, e, days.length, setDay, (i) => days[i])}
                  onScrollEndDrag={(e) => handleDragEnd(dayScrollRef, e, days.length, setDay, (i) => days[i])}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {days.map((dNum) => {
                    const isSelected = day === dNum;
                    return (
                      <TouchableOpacity
                        key={dNum}
                        style={styles.pickerItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setDay(dNum);
                          dayScrollRef.current?.scrollTo({ y: (dNum - 1) * ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            isSelected && [styles.pickerTextSelected, { color: activeColor }],
                          ]}
                        >
                          {String(dNum).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>

              {/* Year Column */}
              <View style={styles.column}>
                <ScrollView
                  ref={yearScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  nestedScrollEnabled={true}
                  overScrollMode="never"
                  contentContainerStyle={styles.scrollContent}
                  onMomentumScrollEnd={(e) => handleScrollEnd(yearScrollRef, e, years.length, setYear, (i) => years[i])}
                  onScrollEndDrag={(e) => handleDragEnd(yearScrollRef, e, years.length, setYear, (i) => years[i])}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {years.map((yNum, idx) => {
                    const isSelected = year === yNum;
                    return (
                      <TouchableOpacity
                        key={yNum}
                        style={styles.pickerItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setYear(yNum);
                          yearScrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            isSelected && [styles.pickerTextSelected, { color: activeColor }],
                          ]}
                        >
                          {yNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>
            </View>
          ) : (
            <View style={styles.pickerContainer}>
              {/* Highlight selection bar */}
              <View
                style={[
                  styles.selectionHighlight,
                  { borderColor: activeColor, backgroundColor: activeColor + '1F' },
                ]}
                pointerEvents="none"
              />

              {/* Hour Column */}
              <View style={styles.column}>
                <ScrollView
                  ref={hourScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  nestedScrollEnabled={true}
                  overScrollMode="never"
                  contentContainerStyle={styles.scrollContent}
                  onMomentumScrollEnd={(e) => handleScrollEnd(hourScrollRef, e, 24, setHour, (i) => hours[i])}
                  onScrollEndDrag={(e) => handleDragEnd(hourScrollRef, e, 24, setHour, (i) => hours[i])}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {hours.map((hNum) => {
                    const isSelected = hour === hNum;
                    return (
                      <TouchableOpacity
                        key={hNum}
                        style={styles.pickerItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setHour(hNum);
                          hourScrollRef.current?.scrollTo({ y: hNum * ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            isSelected && [styles.pickerTextSelected, { color: activeColor }],
                          ]}
                        >
                          {String(hNum).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>

              {/* Minute Column */}
              <View style={styles.column}>
                <ScrollView
                  ref={minuteScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  nestedScrollEnabled={true}
                  overScrollMode="never"
                  contentContainerStyle={styles.scrollContent}
                  onMomentumScrollEnd={(e) => handleScrollEnd(minuteScrollRef, e, 60, setMinute, (i) => minutes[i])}
                  onScrollEndDrag={(e) => handleDragEnd(minuteScrollRef, e, 60, setMinute, (i) => minutes[i])}
                >
                  <View style={{ height: ITEM_HEIGHT }} />
                  {minutes.map((mNum) => {
                    const isSelected = minute === mNum;
                    return (
                      <TouchableOpacity
                        key={mNum}
                        style={styles.pickerItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setMinute(mNum);
                          minuteScrollRef.current?.scrollTo({ y: mNum * ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerText,
                            isSelected && [styles.pickerTextSelected, { color: activeColor }],
                          ]}
                        >
                          {String(mNum).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: ITEM_HEIGHT }} />
                </ScrollView>
              </View>
            </View>
          )}

          {/* Quick Action Button */}
          <View style={styles.quickBar}>
            <TouchableOpacity
              onPress={handleQuickToday}
              style={[
                styles.quickBtn,
                { borderColor: activeColor + '4D', backgroundColor: activeColor + '1A' },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles-outline" size={14} color={activeColor} />
              <Text style={[styles.quickBtnText, { color: activeColor }]}>Sekarang / Hari Ini</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: activeColor }]}
              onPress={handleNextOrConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>
                {mode === 'datetime' && step === 'date' ? 'Lanjut ke Waktu' : 'Simpan'}
              </Text>
              <Ionicons
                name={mode === 'datetime' && step === 'date' ? 'arrow-forward' : 'checkmark'}
                size={16}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  stepTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  stepTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  stepTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  stepTabTextActive: {
    color: '#FFFFFF',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  previewValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  columnTitlesRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  columnTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pickerContainer: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * 3, // Exactly 144px
    position: 'relative',
    marginBottom: 16,
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT, // Exactly at 48px
    left: 0,
    right: 0,
    height: ITEM_HEIGHT, // Exactly 48px
    borderRadius: 12,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
  },
  column: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'stretch',
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  pickerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  pickerTextSelected: {
    fontWeight: '800',
  },
  quickBar: {
    alignItems: 'center',
    marginBottom: 16,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
