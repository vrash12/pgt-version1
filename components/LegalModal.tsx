// components/LegalModal.tsx
import React from 'react';
import {
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type LegalType = 'tos' | 'privacy';

const legalContent: Record<LegalType, { title: string; body: string[] }> = {
  tos: {
    title: 'Terms of Service',
    body: [
      'This app is an educational prototype for testing purposes only.',
      'Do not use the app for real transactions or critical decisions.',
      'Only enter non-sensitive test data.',
      'Access may be changed, suspended, or deleted at any time without notice.',
      'We provide the app “as is,” with no warranties or guarantees.',
      'We are not liable for any loss, damage, or data issues arising from use of this prototype.',
      'You agree not to upload unlawful content or misuse the system.',
      'All logos, names, and materials are for project demonstration only and remain the property of their respective owners.',
      'Contact the project team for any questions or takedown requests.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'This app collects only the information you provide during testing and basic, non-sensitive telemetry.',
      'Data is used solely to demonstrate features and validate the prototype during the capstone evaluation.',
      'No data is sold, shared for marketing, or used beyond testing.',
      'Do not submit real personal, financial, or highly sensitive information.',
      'We apply reasonable safeguards appropriate for a classroom/testing context, without guaranteeing absolute security.',
      'Test data will be purged regularly and deleted at or shortly after the evaluation period (e.g., within 30 days).',
      'You may request deletion of your test data during the evaluation period.',
      'This app is not intended for children under 13.',
      'We may update these terms during the project; using the app for testing means you accept the latest version.',
      'For questions, contact the project team or supervising instructor.',
    ],
  },
};

export default function LegalModal({
  visible,
  type,
  onClose,
}: {
  visible: boolean;
  type: LegalType;
  onClose: () => void;
}) {
  const { title, body } = legalContent[type];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {body.map((line, idx) => (
              <Text key={idx} style={styles.line}>
                • {line}
              </Text>
            ))}
            <Text style={styles.version}>v1.0 — August 12, 2025</Text>
          </ScrollView>

          <TouchableOpacity style={styles.primaryBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>I Understand</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1f2937' },
  close: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  line: { fontSize: 15, lineHeight: 22, color: '#374151' },
  version: { marginTop: 12, fontSize: 12, color: '#6b7280' },
  primaryBtn: {
    margin: 16,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
