import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/api';
import { Button, Card, H2, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Student = { id: string; name: string; class_name: string };

export default function TeacherUpload() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api<Student[]>('/students');
        setStudents(s);
      } catch {}
    })();
  }, []);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
      base64: true,
    });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      const b64 = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setPhoto(b64);
    }
  }

  async function submit() {
    if (!selectedId) return Alert.alert('Select a student');
    if (!description.trim()) return Alert.alert('Add a description');
    setLoading(true);
    try {
      await api('/activities', {
        method: 'POST',
        body: {
          student_id: selectedId,
          description: description.trim(),
          photo_base64: photo,
        },
      });
      Alert.alert('Posted!', 'Activity uploaded successfully.');
      setDescription('');
      setPhoto(null);
      setSelectedId(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <H2>Upload Activity</H2>
          <Muted style={{ marginBottom: spacing.md }}>Share a moment with parents</Muted>

          <Text style={styles.label}>Select Student</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {students.map((s) => {
              const active = selectedId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  testID={`pick-${s.id}`}
                  onPress={() => setSelectedId(s.id)}
                  style={[
                    styles.studentChip,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.studentChipText, active && { color: colors.inverse }]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: spacing.md }}>
            <TouchableOpacity testID="pick-photo" onPress={pickImage} style={styles.photoBox}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photoPreview} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="image" size={32} color={colors.textMuted} />
                  <Muted style={{ marginTop: 8 }}>Tap to add photo (optional)</Muted>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <Input
            testID="desc-input"
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholder="Today, Aarav loved finger painting..."
            style={{ minHeight: 100, textAlignVertical: 'top' } as any}
            containerStyle={{ marginTop: spacing.md }}
          />

          <Button
            testID="post-activity"
            title="Post Activity"
            onPress={submit}
            loading={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  studentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  studentChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  photoBox: {
    height: 180,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
});
