import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PostEditor from '../../components/post-editor/PostEditor';

// This is a placeholder function - replace with actual implementation
const savePostToGitHub = async (title: string, content: string): Promise<boolean> => {
  // Here you would implement the logic to save the post to GitHub
  // For example, create a new file in the _posts directory with proper Jekyll frontmatter
  // For now, we'll just return true to simulate success
  console.log('Saving post to GitHub:', { title, content });
  return true;
};

export default function PostEditorModal() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const handleCancel = () => {
    router.back();
  };
  
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please add a title for your post.');
      return;
    }
    
    if (!content.trim()) {
      Alert.alert('Missing Content', 'Please add some content to your post.');
      return;
    }
    
    try {
      // Add Jekyll frontmatter to content
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const slug = title.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '-');
      const fileName = `${date}-${slug}.md`;
      
      // Create Jekyll frontmatter
      const frontmatter = `---
layout: post
title: "${title}"
date: ${date}
categories: blog
---

`;
      
      const fullContent = frontmatter + content;
      
      // Save to GitHub
      const success = await savePostToGitHub(title, fullContent);
      
      if (success) {
        Alert.alert(
          'Post Created',
          'Your post has been successfully saved and will be published to your GitHub Pages blog.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        throw new Error('Failed to save post');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'There was an error saving your post. Please try again.'
      );
      console.error('Error saving post:', error);
    }
  };
  
  const handleAddImage = (imageUrl: string) => {
    // If you need to handle image uploads differently, implement here
    console.log('Image added:', imageUrl);
  };
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <PostEditor
          title={title}
          content={content}
          onTitleChange={setTitle}
          onContentChange={setContent}
          colors={colors}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onAddImage={handleAddImage}
          insets={insets}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 