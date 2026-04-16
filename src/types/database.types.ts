export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blip_tags: {
        Row: {
          blip_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          blip_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          blip_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blip_tags_blip_id_fkey"
            columns: ["blip_id"]
            isOneToOne: false
            referencedRelation: "blips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blip_tags_blip_id_fkey"
            columns: ["blip_id"]
            isOneToOne: false
            referencedRelation: "view_blips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blip_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blips: {
        Row: {
          allow_comments: boolean
          blip_type: string
          content: string | null
          created_at: string | null
          id: string
          moderation_status: string | null
          parent_id: string | null
          published: boolean | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allow_comments?: boolean
          blip_type?: string
          content?: string | null
          created_at?: string | null
          id: string
          moderation_status?: string | null
          parent_id?: string | null
          published?: boolean | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allow_comments?: boolean
          blip_type?: string
          content?: string | null
          created_at?: string | null
          id?: string
          moderation_status?: string | null
          parent_id?: string | null
          published?: boolean | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blips_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blips_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "view_blips"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          blip_id: string
          created_at: string
          emoji: string
          id: string
          user_profile_id: string
        }
        Insert: {
          blip_id: string
          created_at?: string
          emoji: string
          id?: string
          user_profile_id: string
        }
        Update: {
          blip_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_blip_id_fkey"
            columns: ["blip_id"]
            isOneToOne: false
            referencedRelation: "blips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_blip_id_fkey"
            columns: ["blip_id"]
            isOneToOne: false
            referencedRelation: "view_blips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "view_user"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "reactions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      "victors-work": {
        Row: {
          chapter: string | null
          id: number
          inserted_at: string | null
          passage: string
        }
        Insert: {
          chapter?: string | null
          id?: number
          inserted_at?: string | null
          passage: string
        }
        Update: {
          chapter?: string | null
          id?: number
          inserted_at?: string | null
          passage?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          avatar_seed: string
          avatar_version: number
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_seed?: string
          avatar_version?: number
          created_at?: string
          display_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_seed?: string
          avatar_version?: number
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_system: {
        Row: {
          created_at: string
          failed_login_attempts: number
          notes: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          trusted: boolean
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string
          failed_login_attempts?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          trusted?: boolean
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          created_at?: string
          failed_login_attempts?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          trusted?: boolean
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_system_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_system_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "view_user"
            referencedColumns: ["profile_id"]
          },
        ]
      }
    }
    Views: {
      view_blips: {
        Row: {
          allow_comments: boolean | null
          blip_type: string | null
          comments: Json | null
          content: string | null
          created_at: string | null
          id: string | null
          moderation_status: string | null
          my_reaction_count: number | null
          parent_id: string | null
          published: boolean | null
          reactions: Json | null
          reactions_count: number | null
          tags: Json | null
          title: string | null
          updated_at: string | null
          updates: Json | null
          updates_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blips_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blips_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "view_blips"
            referencedColumns: ["id"]
          },
        ]
      }
      view_public_user: {
        Row: {
          avatar_seed: string | null
          avatar_version: number | null
          display_name: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["visitor_status"] | null
          user_id: string | null
        }
        Relationships: []
      }
      view_reactions_public: {
        Row: {
          blip_id: string | null
          created_at: string | null
          display_name: string | null
          emoji: string | null
          id: string | null
          user_id: string | null
          user_profile_id: string | null
        }
        Relationships: []
      }
      view_user: {
        Row: {
          avatar_seed: string | null
          avatar_version: number | null
          display_name: string | null
          failed_login_attempts: number | null
          notes: string | null
          profile_created_at: string | null
          profile_id: string | null
          profile_updated_at: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          role_created_at: string | null
          role_updated_at: string | null
          status: Database["public"]["Enums"]["visitor_status"] | null
          system_created_at: string | null
          system_updated_at: string | null
          trusted: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_sessions: { Args: { retention?: string }; Returns: number }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_superuser: { Args: never; Returns: boolean }
      record_failed_visitor_login_attempt: {
        Args: { max_attempts?: number; target_email: string }
        Returns: Json
      }
      revoke_current_session: { Args: never; Returns: undefined }
      session_is_valid: { Args: { max_age?: string }; Returns: boolean }
      start_session: { Args: { ttl?: string }; Returns: undefined }
      sync_visitor_state: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "superuser" | "admin" | "visitor"
      visitor_status: "pending" | "active" | "locked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["superuser", "admin", "visitor"],
      visitor_status: ["pending", "active", "locked"],
    },
  },
} as const

