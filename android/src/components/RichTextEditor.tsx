import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'What is this form about?',
  minHeight = 200,
  compact = false,
}: RichTextEditorProps) {
  const { colors, isDark } = useAppTheme();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [activeFormats, setActiveFormats] = useState<Record<string, any>>({});

  const lastHtmlRef = useRef(value);
  const initialValueRef = useRef(value);
  const debounceTimerRef = useRef<any>(null);

  // Sync external value ONLY when it changes outside of user typing
  useEffect(() => {
    if (isReady && value !== lastHtmlRef.current) {
      lastHtmlRef.current = value;
      const jsonVal = JSON.stringify(value || '');
      const script = `
        if (window.quill) {
          var current = window.quill.root.innerHTML;
          if (current !== ${jsonVal}) {
            window.quill.clipboard.dangerouslyPasteHTML(${jsonVal});
          }
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(script);
    }
  }, [value, isReady]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced parent notification to prevent React Native re-render flickering while typing fast
  const debouncedOnChange = useCallback(
    (html: string) => {
      lastHtmlRef.current = html;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange(html);
      }, 250);
    },
    [onChange]
  );

  // Execute Quill formatting command & immediately receive updated state
  const execFormat = useCallback(
    (format: string, val: any = true) => {
      if (!isReady) return;
      const jsonVal = JSON.stringify(val);
      const script = `
        if (window.applyFormat) {
          window.applyFormat('${format}', ${jsonVal});
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(script);
    },
    [isReady]
  );

  const handleOpenLinkModal = () => {
    if (!isReady) return;
    const currentLink = typeof activeFormats.link === 'string' ? activeFormats.link : '';
    setLinkUrl(currentLink);
    setLinkText('');

    // Fetch selection text from WebView
    const script = `
      if (window.quill) {
        var range = window.quill.getSelection(true);
        var selectedText = range && range.length > 0 ? window.quill.getText(range.index, range.length) : '';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'selected_text',
            text: selectedText
          }));
        }
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
    setShowLinkModal(true);
  };

  const handleSaveLink = () => {
    let url = linkUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
      url = 'https://' + url;
    }

    const script = `
      if (window.applyLink) {
        window.applyLink(${JSON.stringify(linkText.trim())}, ${JSON.stringify(url)});
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
    setShowLinkModal(false);
  };

  const handleRemoveLink = () => {
    execFormat('link', false);
    setShowLinkModal(false);
  };

  const setHeaderFormat = (level: number | false) => {
    execFormat('header', level);
    setShowHeadingMenu(false);
  };

  const getHeadingLabel = () => {
    if (activeFormats.header === 2) return 'Heading 2';
    if (activeFormats.header === 3) return 'Heading 3';
    if (activeFormats.header === 1) return 'Heading 1';
    return 'Normal';
  };

  const cardBg = colors.cardBg;
  const textColor = colors.text;
  const borderColor = colors.inputBorder;
  const toolbarBg = isDark ? '#1E293B' : '#F8FAFC';
  const toolbarBorder = colors.borderTop;

  // Theme-aware active button colors
  const activeBg = isDark ? '#312E81' : '#EEF2FF';
  const activeBorder = isDark ? '#4338CA' : '#C7D2FE';
  const activeText = isDark ? '#818CF8' : '#4F46E5';

  // Memoized Quill HTML engine
  const source = useMemo(() => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            height: 100%;
            width: 100%;
            background-color: ${cardBg};
            color: ${textColor};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
          }
          .ql-container.ql-snow {
            border: none !important;
            height: 100%;
            font-size: 15px;
          }
          .ql-editor {
            padding: 12px;
            color: ${textColor};
            min-height: 100%;
          }
          .ql-editor.ql-blank::before {
            color: ${colors.textMuted};
            font-style: normal;
            left: 12px;
          }
          a {
            color: #6C5CE7 !important;
            text-decoration: underline !important;
          }
          blockquote {
            border-left: 4px solid #6C5CE7;
            padding-left: 10px;
            color: ${textColor};
            opacity: 0.9;
            margin: 4px 0;
          }
          pre.ql-syntax {
            background-color: ${isDark ? '#0F172A' : '#F1F5F9'};
            color: ${isDark ? '#E2E8F0' : '#0F172A'};
            padding: 8px 12px;
            border-radius: 8px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div id="editor"></div>
        <script>
          var quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: ${JSON.stringify(placeholder)},
            modules: {
              toolbar: false
            }
          });
          window.quill = quill;

          var initVal = ${JSON.stringify(initialValueRef.current || '')};
          if (initVal) {
            quill.clipboard.dangerouslyPasteHTML(initVal);
          }

          function getFormats() {
            var range = quill.getSelection(false);
            if (range) {
              return quill.getFormat(range) || {};
            }
            return quill.getFormat(0, 0) || {};
          }

          function sendHtml() {
            var html = quill.root.innerHTML;
            if (html === '<p><br></p>') html = '';
            var formats = getFormats();
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'html',
                html: html,
                formats: formats
              }));
            }
          }

          // Format toggle executor
          window.applyFormat = function(format, value) {
            if (!quill) return;
            var range = quill.getSelection(true);
            if (!range) {
              quill.focus();
              range = quill.getSelection(true);
            }
            if (range) {
              if (format === 'clean') {
                quill.removeFormat(range.index, range.length || 1);
              } else {
                var current = quill.getFormat(range)[format];
                if (current && (current === value || value === true)) {
                  quill.format(format, false);
                } else {
                  quill.format(format, value);
                }
              }
              var html = quill.root.innerHTML;
              if (html === '<p><br></p>') html = '';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'format_toggle',
                  html: html,
                  formats: getFormats()
                }));
              }
            }
          };

          // Link inserter / format
          window.applyLink = function(text, url) {
            if (!quill) return;
            var range = quill.getSelection(true);
            if (range && range.length > 0) {
              if (!url) {
                quill.format('link', false);
              } else {
                quill.format('link', url);
              }
            } else if (url) {
              var insertText = text || url;
              var idx = range ? range.index : quill.getLength() - 1;
              quill.insertText(idx, insertText, 'link', url);
              quill.setSelection(idx + insertText.length, 0);
            }
            sendHtml();
          };

          quill.on('text-change', sendHtml);

          quill.on('selection-change', function(range) {
            if (range && window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'formats',
                formats: quill.getFormat(range)
              }));
            }
          });

          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ready',
              formats: getFormats()
            }));
          }
        </script>
      </body>
      </html>
    `;
    return { html };
  }, [isDark, placeholder, cardBg, textColor, colors.textMuted]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setIsReady(true);
        if (data.formats) setActiveFormats(data.formats);
      } else if (data.type === 'html') {
        debouncedOnChange(data.html);
        if (data.formats) setActiveFormats(data.formats);
      } else if (data.type === 'format_toggle') {
        lastHtmlRef.current = data.html;
        onChange(data.html);
        if (data.formats) setActiveFormats(data.formats);
      } else if (data.type === 'formats') {
        if (data.formats) setActiveFormats(data.formats);
      } else if (data.type === 'selected_text') {
        if (data.text) setLinkText(data.text);
      }
    } catch (e) {
      console.log('WebView message error:', e);
    }
  };

  const isBold = !!activeFormats.bold;
  const isItalic = !!activeFormats.italic;
  const isUnderline = !!activeFormats.underline;
  const isStrike = !!activeFormats.strike;
  const isBullet = activeFormats.list === 'bullet';
  const isOrdered = activeFormats.list === 'ordered';
  const isBlockquote = !!activeFormats.blockquote;
  const isCodeBlock = !!activeFormats['code-block'];
  const isLink = !!activeFormats.link;

  return (
    <View style={[styles.container, { borderColor, backgroundColor: cardBg }]}>
      {/* ── Web-Identical Native Toolbar ── */}
      <View style={[styles.toolbar, { borderBottomColor: toolbarBorder, backgroundColor: toolbarBg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
          {!compact && (
            <TouchableOpacity
              style={[
                styles.toolBtn,
                styles.headingSelectBtn,
                { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
              ]}
              onPress={() => setShowHeadingMenu(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.headingSelectText, { color: colors.text }]}>{getHeadingLabel()}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.text} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}

          {/* Bold */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              isBold && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
            ]}
            onPress={() => execFormat('bold')}
          >
            <Text style={[styles.toolCharText, { color: isBold ? activeText : colors.text }]}>B</Text>
          </TouchableOpacity>

          {/* Italic */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              isItalic && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
            ]}
            onPress={() => execFormat('italic')}
          >
            <Text style={[styles.toolCharText, { fontStyle: 'italic', color: isItalic ? activeText : colors.text }]}>I</Text>
          </TouchableOpacity>

          {/* Underline */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              isUnderline && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
            ]}
            onPress={() => execFormat('underline')}
          >
            <Text style={[styles.toolCharText, { textDecorationLine: 'underline', color: isUnderline ? activeText : colors.text }]}>U</Text>
          </TouchableOpacity>

          {/* Strike */}
          <TouchableOpacity
            style={[
              styles.toolBtn,
              isStrike && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
            ]}
            onPress={() => execFormat('strike')}
          >
            <Text style={[styles.toolCharText, { textDecorationLine: 'line-through', color: isStrike ? activeText : colors.text }]}>S</Text>
          </TouchableOpacity>

          {!compact && (
            <>
              <View style={[styles.divider, { backgroundColor: toolbarBorder }]} />

              {/* Bullet list */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  isBullet && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
                ]}
                onPress={() => execFormat('list', 'bullet')}
              >
                <Ionicons name="list-outline" size={16} color={isBullet ? activeText : colors.text} />
              </TouchableOpacity>

              {/* Numbered list */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  isOrdered && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
                ]}
                onPress={() => execFormat('list', 'ordered')}
              >
                <Ionicons name="list-sharp" size={16} color={isOrdered ? activeText : colors.text} />
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: toolbarBorder }]} />

              {/* Blockquote */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  isBlockquote && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
                ]}
                onPress={() => execFormat('blockquote')}
              >
                <Ionicons name="chatbox-ellipses-outline" size={15} color={isBlockquote ? activeText : colors.text} />
              </TouchableOpacity>

              {/* Code block */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  isCodeBlock && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
                ]}
                onPress={() => execFormat('code-block')}
              >
                <Ionicons name="code-slash-outline" size={16} color={isCodeBlock ? activeText : colors.text} />
              </TouchableOpacity>

              {/* Link */}
              <TouchableOpacity
                style={[
                  styles.toolBtn,
                  isLink && { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1 },
                ]}
                onPress={handleOpenLinkModal}
              >
                <Ionicons name="link-outline" size={16} color={isLink ? activeText : colors.text} />
              </TouchableOpacity>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: toolbarBorder }]} />

          {/* Clear formatting */}
          <TouchableOpacity style={styles.toolBtn} onPress={() => execFormat('clean')}>
            <Text style={[styles.clearBtnText, { color: colors.textSub }]}>Tx</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Editor Canvas ── */}
      <View style={{ height: minHeight }}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={source}
          onMessage={handleMessage}
          scrollEnabled={true}
          style={{ backgroundColor: cardBg }}
          hideKeyboardAccessoryView={false}
          keyboardDisplayRequiresUserAction={false}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          androidLayerType="hardware"
        />
      </View>

      {/* ── Heading Dropdown Modal ── */}
      <Modal
        visible={showHeadingMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeadingMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeadingMenu(false)}
        >
          <View
            style={[
              styles.dropdownCard,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: colors.inputBorder },
            ]}
          >
            <TouchableOpacity
              style={[styles.dropdownItem, activeFormats.header === 2 && styles.dropdownItemActive]}
              onPress={() => setHeaderFormat(2)}
            >
              <Text style={[styles.dropdownItemText, { color: colors.text, fontSize: 18, fontWeight: 'bold' }]}>
                Heading 2
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dropdownItem, activeFormats.header === 3 && styles.dropdownItemActive]}
              onPress={() => setHeaderFormat(3)}
            >
              <Text style={[styles.dropdownItemText, { color: colors.text, fontSize: 16, fontWeight: 'bold' }]}>
                Heading 3
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dropdownItem, (!activeFormats.header || activeFormats.header === false) && styles.dropdownItemActive]}
              onPress={() => setHeaderFormat(false)}
            >
              <Text style={[styles.dropdownItemText, { color: colors.text, fontSize: 14 }]}>
                Normal
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Insert/Edit Link Modal ── */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLinkModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.linkModalCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: colors.inputBorder }]}>
            <Text style={[styles.linkModalTitle, { color: colors.text }]}>
              {isLink ? 'Edit Link' : 'Insert Link'}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Link URL</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', color: colors.text, borderColor: colors.inputBorder }]}
              placeholder="https://example.com"
              placeholderTextColor={colors.textMuted}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Display Text (optional)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', color: colors.text, borderColor: colors.inputBorder }]}
              placeholder="Text to display"
              placeholderTextColor={colors.textMuted}
              value={linkText}
              onChangeText={setLinkText}
            />

            <View style={styles.modalActions}>
              {isLink && (
                <TouchableOpacity style={[styles.modalBtn, styles.removeBtn]} onPress={handleRemoveLink}>
                  <Text style={styles.removeBtnText}>Remove Link</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowLinkModal(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveLink}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toolbar: {
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  headingSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginRight: 4,
  },
  headingSelectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolCharText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    height: 18,
    marginHorizontal: 4,
  },

  // Dropdown Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownCard: {
    width: 220,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  dropdownItemText: {},

  // Link Modal
  linkModalCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  cancelBtn: {},
  cancelBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#6C5CE7',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  removeBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginRight: 'auto',
  },
  removeBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
});
