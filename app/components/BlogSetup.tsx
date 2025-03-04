import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

interface BlogSetupProps {
  onSuccess: (blogUrl: string) => void;
  onError: (error: string) => void;
  colors: any;
}

export default function BlogSetup({ onSuccess, onError, colors }: BlogSetupProps) {
  const [loading, setLoading] = useState(false);
  const [blogName, setBlogName] = useState('');
  const [blogTitle, setBlogTitle] = useState('');
  const [blogDescription, setBlogDescription] = useState('');

  const setupBlog = async () => {
    if (!blogName.trim()) {
      Alert.alert('Error', 'Please enter a blog name');
      return;
    }

    try {
      setLoading(true);
      
      // Generate a unique name if not provided
      const name = blogName.trim() || `blog-${Date.now()}`;
      
      // Create blog using the handle-github edge function
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'create-blog',
          params: {
            name: name,
            description: blogDescription.trim() || 'My personal blog created with OWC',
            blogTitle: blogTitle.trim() || name
          }
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        // Store the blog URL in user metadata
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { blog_url: data.blog.github_pages_url }
          });
          
          if (updateError) {
            console.error('Error updating user metadata:', updateError);
          }
        } catch (metadataError) {
          console.error('Error updating user metadata:', metadataError);
        }
        
        onSuccess(data.blog.github_pages_url);
        setBlogName('');
        setBlogTitle('');
        setBlogDescription('');
      } else {
        throw new Error('Failed to create blog');
      }
    } catch (error) {
      console.error('Error setting up blog:', error);
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Create Your Blog</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Set up a new Jekyll blog using our template. This will create a new repository 
        in your GitHub account and set up GitHub Pages for hosting.
      </Text>
      
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Blog Name (Repository Name)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="my-awesome-blog"
          placeholderTextColor={colors.textSecondary}
          value={blogName}
          onChangeText={setBlogName}
          editable={!loading}
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Blog Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="My Awesome Blog"
          placeholderTextColor={colors.textSecondary}
          value={blogTitle}
          onChangeText={setBlogTitle}
          editable={!loading}
        />
      </View>
      
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Blog Description</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="A blog about my awesome thoughts and ideas"
          placeholderTextColor={colors.textSecondary}
          value={blogDescription}
          onChangeText={setBlogDescription}
          multiline
          numberOfLines={3}
          editable={!loading}
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
        onPress={setupBlog}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Blog</Text>
        )}
      </TouchableOpacity>
      
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Note: It may take a few minutes for your blog to be fully set up and deployed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
  },
}); 