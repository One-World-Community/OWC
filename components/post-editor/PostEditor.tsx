import React from 'react';
import { EdgeInsets } from 'react-native-safe-area-context';

// Common interface for both native and web implementations
export interface PostEditorProps {
  // Content management
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  
  // UI related props
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    primary: string;
    error: string;
    card: string;
    border: string;
  };
  
  // Functionality
  onSubmit: () => void;
  onCancel: () => void;
  
  // Image handling
  onAddImage?: (imageUrl: string) => void;
  
  // Platform-specific props
  insets?: EdgeInsets; // Only needed on native
}

// Export a default component for dynamic importing
export default function PostEditor(props: PostEditorProps) {
  // This is just a placeholder for dynamic platform imports
  // The actual implementation is in .web.tsx and .native.tsx files
  return null;
}
