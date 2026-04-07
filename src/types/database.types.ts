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
          visitor_id: string
        }
        Insert: {
          blip_id: string
          created_at?: string
          emoji: string
          id?: string
          visitor_id: string
        }
        Update: {
          blip_id?: string
          created_at?: string
          emoji?: string
          id?: string
          visitor_id?: string
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
            foreignKeyName: "reactions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "view_user"
            referencedColumns: ["visitor_id"]
          },
          {
            foreignKeyName: "reactions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
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
      visitors: {
        Row: {
          created_at: string
          display_name: string
          failed_login_attempts: number
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          failed_login_attempts?: number
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          failed_login_attempts?: number
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      view_blips: {
        Row: {
          blip_type: string | null
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
      view_user: {
        Row: {
          role: Database["public"]["Enums"]["app_role"] | null
          role_created_at: string | null
          role_updated_at: string | null
          user_id: string | null
          visitor_created_at: string | null
          visitor_display_name: string | null
          visitor_failed_login_attempts: number | null
          visitor_id: string | null
          visitor_notes: string | null
          visitor_status: Database["public"]["Enums"]["visitor_status"] | null
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
      update_profile: {
        Args: { next_display_name: string }
        Returns: undefined
      }
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

