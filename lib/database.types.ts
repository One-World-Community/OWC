export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      articles: {
        Row: {
          created_at: string | null
          description: string | null
          feed_id: string
          id: string
          image_url: string | null
          published_at: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          feed_id: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          feed_id?: string
          id?: string
          image_url?: string | null
          published_at?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "rss_feeds"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string | null
          id: string
          image_url: string | null
          latitude: number | null
          location: string
          longitude: number | null
          start_time: string
          title: string
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location: string
          longitude?: number | null
          start_time: string
          title: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          start_time?: string
          title?: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
      }
      event_rsvps: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: "attending" | "maybe" | "declined"
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status: "attending" | "maybe" | "declined"
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: "attending" | "maybe" | "declined"
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      // ... other tables remain the same
    }
  }
} 