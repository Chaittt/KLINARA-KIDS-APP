import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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
import { Button, Card, H2, H3, Input, Muted } from '../../src/ui';
import { colors, radii, spacing } from '../../src/theme';

type Announcement = {
  id: string;
  title: string;
  description: string;
  photos_base64: string[];
  uploader_name?: string;
  created_at: string;
};

export default function PrincipalAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Announcement[]>('/announcements');
      setItems(r);
    } catch {}
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.5,
      base64: true,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setPhotos((p) => [...p, `data:image/jpeg;base64,${r.assets[0].base64}`]);
    }
  }

  async function submit() {
    if (!title.trim() || !desc.trim()) {
      return Alert.alert('Required', 'Title and description are required');
    }
    setSaving(true);
    try {
      await api('/announcements', {
        method: 'POST',
        body: { title: title.trim(), description: desc.trim(), photos_base64: photos },
      });
      setShowNew(false);
      setTitle('');
      setDesc('');
      setPhotos([]);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function del(a: Announcement) {
    Alert.alert('Delete?', a.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/announcements/${a.id}`, { method: 'DELETE' });
            await load();
          } catch {}
        },
      },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.head}>
        <View>
          <H2>Announcements</H2>
          <Muted>Share today's activities with parents</Muted>
        </View>
        <TouchableOpacity testID="new-ann" style={styles.addBtn} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={22} color={colors.inverse} />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {items.length === 0 ? (
          <Card>
            <Muted style={{ textAlign: 'center' }}>No announcements yet. Tap "+ New".</Muted>
          </Card>
        ) : (
          items.map((a) => (
            <Card key={a.id} style={{ marginBottom: spacing.md }} testID={`ann-${a.id}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.annTitle}>{a.title}</Text>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>
                    {a.uploader_name} · {new Date(a.created_at).toLocaleString()}
                  </Muted>
                </View>
                <TouchableOpacity onPress={() => del(a)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
              <Text style={styles.annDesc}>{a.description}</Text>
              {a.photos_base64.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                  {a.photos_base64.map((p, i) => (
                    <Image key={i} source={{ uri: p }} style={styles.photo} />
                  ))}
                </ScrollView>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={showNew} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <Card>
              <H3>New Announcement</H3>
              <Input testID="ann-title" label="Title" value={title} onChangeText={setTitle} placeholder="Today's activities" containerStyle={{ marginTop: spacing.md }} />
              <Input
                testID="ann-desc"
                label="Description"
                value={desc}
                onChangeText={setDesc}
                placeholder="What happened today..."
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: 'top' } as any}
              />
              <Text style={styles.label}>Photos ({photos.length})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {photos.map((p, i) => (
                  <View key={i} style={styles.photoWrap}>
                    <Image source={{ uri: p }} style={styles.photoSm} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => setPhotos(photos.filter((_, j) => j !== i))}>
                      <Ionicons name="close" size={14} color={colors.inverse} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity testID="add-photo" style={styles.addPhoto} onPress={pickPhoto}>
                  <Ionicons name="add" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Button testID="post-ann" title="Post" onPress={submit} loading={saving} style={{ marginTop: spacing.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setShowNew(false)} style={{ marginTop: 8 }} />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill, gap: 4,
  },
  addBtnText: { color: colors.inverse, fontWeight: '700', fontSize: 14 },
  annTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  annDesc: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20 },
  photo: { width: 200, height: 140, borderRadius: radii.md, marginRight: 8 },
  photoSm: { width: 70, height: 70, borderRadius: radii.md },
  photoWrap: { position: 'relative' },
  removeBtn: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  addPhoto: {
    width: 70, height: 70, borderRadius: radii.md, borderWidth: 2, borderColor: colors.primary,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 8, marginBottom: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
});
