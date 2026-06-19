export type UserRole = "employee" | "shift_lead" | "admin";
export type UserStatus = "active" | "inactive";
export type PostType = "announcement" | "discussion" | "instruction";
export type Priority = "normal" | "important" | "critical";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string;
          role: UserRole;
          status: UserStatus;
          department: string | null;
          position: string | null;
          password_plain: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name: string;
          role?: UserRole;
          status?: UserStatus;
          department?: string | null;
          position?: string | null;
          password_plain?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          body: string;
          type: PostType;
          priority: Priority;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          body: string;
          type?: PostType;
          priority?: Priority;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          file_path: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          file_path: string;
          uploaded_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      sync_logs: {
        Row: {
          id: string;
          source: string;
          triggered_by: string | null;
          created_count: number;
          updated_count: number;
          deactivated_count: number;
          skipped_count: number;
          password_updated_count: number;
          error_count: number;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          source?: string;
          triggered_by?: string | null;
          created_count?: number;
          updated_count?: number;
          deactivated_count?: number;
          skipped_count?: number;
          password_updated_count?: number;
          error_count?: number;
          details?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
