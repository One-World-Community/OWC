import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/supabase';

export default function EditProfileScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({
    id: session!.user.id,
    username: '',
    full_name: '',
    avatar_url: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLoading(true);
        setError(null);

        const file = {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'profile-picture.jpg',
        };

        // Upload to Supabase Storage
        const fileExt = 'jpg';
        const filePath = `${session!.user.id}/profile.${fileExt}`;

        if (Platform.OS === 'web') {
          // For web, we need to fetch the file first
          const response = await fetch(file.uri);
          const blob = await response.blob();
          
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) throw uploadError;
        } else {
          // For native platforms
          const response = await fetch(file.uri);
          const blob = await response.blob();

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, blob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) throw uploadError;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        setProfile(prev => ({
          ...prev,
          avatar_url: publicUrl,
        }));
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: session!.user.id,
          username: profile.username?.trim(),
          full_name: profile.full_name?.trim(),
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      router.back();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={styles.avatarContainer}
        onPress={pickImage}
        disabled={loading}>
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={[styles.avatar, loading && styles.avatarLoading]}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="camera" size={32} color={colors.textSecondary} />
          </View>
        )}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Tap to change profile picture
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Full Name
          </Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text
            }]}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textSecondary}
            value={profile.full_name || ''}
            onChangeText={text => setProfile(prev => ({ ...prev, full_name: text }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Username
          </Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text
            }]}
            placeholder="Choose a username"
            placeholderTextColor={colors.textSecondary}
            value={profile.username || ''}
            onChangeText={text => setProfile(prev => ({ ...prev, username: text }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.error + '10' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            loading && { opacity: 0.7 }
          ]}
          onPress={handleSave}
          disabled={loading}>
          <Text style={[styles.saveButtonText, { color: colors.card }]}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginTop: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarLoading: {
    opacity: 0.7,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  hint: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  form: {
    marginTop: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 8,
    flex: 1,
  },
  saveButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});