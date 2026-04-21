export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
        }
        Relationships: []
      }
      committee_tasks: {
        Row: {
          assigned_to: string | null
          committee_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          committee_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          committee_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_tasks_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          budget_allocated: number
          budget_spent: number
          created_at: string
          description: string | null
          head_user_id: string | null
          id: string
          max_budget: number
          max_members: number
          min_budget: number
          name: string
          type: Database["public"]["Enums"]["committee_type"]
          updated_at: string
        }
        Insert: {
          budget_allocated?: number
          budget_spent?: number
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          max_budget?: number
          max_members?: number
          min_budget?: number
          name: string
          type: Database["public"]["Enums"]["committee_type"]
          updated_at?: string
        }
        Update: {
          budget_allocated?: number
          budget_spent?: number
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          max_budget?: number
          max_members?: number
          min_budget?: number
          name?: string
          type?: Database["public"]["Enums"]["committee_type"]
          updated_at?: string
        }
        Relationships: []
      }
      delegates: {
        Row: {
          created_at: string
          family_branch: string
          full_name: string
          id: string
          notes: string | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          family_branch: string
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          family_branch?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      groom_audit_log: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          groom_id: string
          id: string
          note: string | null
          to_status: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          groom_id: string
          id?: string
          note?: string | null
          to_status?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          groom_id?: string
          id?: string
          note?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groom_audit_log_groom_id_fkey"
            columns: ["groom_id"]
            isOneToOne: false
            referencedRelation: "grooms"
            referencedColumns: ["id"]
          },
        ]
      }
      groom_documents: {
        Row: {
          created_at: string
          doc_name: string
          doc_url: string
          groom_id: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_name: string
          doc_url: string
          groom_id: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_name?: string
          doc_url?: string
          groom_id?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groom_documents_groom_id_fkey"
            columns: ["groom_id"]
            isOneToOne: false
            referencedRelation: "grooms"
            referencedColumns: ["id"]
          },
        ]
      }
      grooms: {
        Row: {
          bride_name: string | null
          cards_men: number
          cards_printed: boolean
          cards_women: number
          contribution_paid: boolean
          created_at: string
          created_by: string | null
          deficit_share: number
          external_participation: boolean
          external_participation_details: string | null
          extra_cards_men: number
          extra_cards_women: number
          extra_sheep: number
          family_branch: string
          full_name: string
          groom_contribution: number
          id: string
          national_id: string | null
          national_id_url: string | null
          notes: string | null
          phone: string
          photo_url: string | null
          request_details: string | null
          request_type: string | null
          requirements_checklist: Json
          special_requests: string | null
          status: Database["public"]["Enums"]["groom_status"]
          updated_at: string
          vip_guests: string | null
          wedding_date: string | null
        }
        Insert: {
          bride_name?: string | null
          cards_men?: number
          cards_printed?: boolean
          cards_women?: number
          contribution_paid?: boolean
          created_at?: string
          created_by?: string | null
          deficit_share?: number
          external_participation?: boolean
          external_participation_details?: string | null
          extra_cards_men?: number
          extra_cards_women?: number
          extra_sheep?: number
          family_branch: string
          full_name: string
          groom_contribution?: number
          id?: string
          national_id?: string | null
          national_id_url?: string | null
          notes?: string | null
          phone: string
          photo_url?: string | null
          request_details?: string | null
          request_type?: string | null
          requirements_checklist?: Json
          special_requests?: string | null
          status?: Database["public"]["Enums"]["groom_status"]
          updated_at?: string
          vip_guests?: string | null
          wedding_date?: string | null
        }
        Update: {
          bride_name?: string | null
          cards_men?: number
          cards_printed?: boolean
          cards_women?: number
          contribution_paid?: boolean
          created_at?: string
          created_by?: string | null
          deficit_share?: number
          external_participation?: boolean
          external_participation_details?: string | null
          extra_cards_men?: number
          extra_cards_women?: number
          extra_sheep?: number
          family_branch?: string
          full_name?: string
          groom_contribution?: number
          id?: string
          national_id?: string | null
          national_id_url?: string | null
          notes?: string | null
          phone?: string
          photo_url?: string | null
          request_details?: string | null
          request_type?: string | null
          requirements_checklist?: Json
          special_requests?: string | null
          status?: Database["public"]["Enums"]["groom_status"]
          updated_at?: string
          vip_guests?: string | null
          wedding_date?: string | null
        }
        Relationships: []
      }
      historical_shareholders: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          family_branch: string
          full_name: string
          hijri_year: number
          id: string
          notes: string | null
          source_file_url: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          family_branch: string
          full_name: string
          hijri_year: number
          id?: string
          notes?: string | null
          source_file_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          family_branch?: string
          full_name?: string
          hijri_year?: number
          id?: string
          notes?: string | null
          source_file_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      idea_votes: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_votes_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          admin_response: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["idea_status"]
          title: string
          updated_at: string
          user_id: string
          votes_count: number
        }
        Insert: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title: string
          updated_at?: string
          user_id: string
          votes_count?: number
        }
        Update: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title?: string
          updated_at?: string
          user_id?: string
          votes_count?: number
        }
        Relationships: []
      }
      membership_requests: {
        Row: {
          assigned_committee_id: string | null
          assigned_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          family_branch: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string
          requested_committee_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_committee_id?: string | null
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          family_branch?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          requested_committee_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_committee_id?: string | null
          assigned_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          family_branch?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          requested_committee_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_requests_assigned_committee_id_fkey"
            columns: ["assigned_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_requests_requested_committee_id_fkey"
            columns: ["requested_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          committee_id: string
          created_at: string
          description: string | null
          id: string
          invoice_url: string | null
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          committee_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          committee_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          family_branch: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          family_branch?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          family_branch?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          archive_year: number | null
          committee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_archived: boolean
          report_year: number
          title: string
        }
        Insert: {
          archive_year?: number | null
          committee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_archived?: boolean
          report_year?: number
          title: string
        }
        Update: {
          archive_year?: number | null
          committee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_archived?: boolean
          report_year?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          delegate_id: string
          full_name: string
          id: string
          national_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delegate_id: string
          full_name: string
          id?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delegate_id?: string
          full_name?: string
          id?: string
          national_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          collected_at: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          delegate_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          subscriber_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          collected_at?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delegate_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscriber_id: string
          updated_at?: string
          year?: number
        }
        Update: {
          amount?: number
          collected_at?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          delegate_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          subscriber_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "delegates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "committee_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          committee_id: string
          created_at: string
          created_by: string | null
          display_order: number
          email: string | null
          full_name: string
          id: string
          is_head: boolean
          phone: string | null
          role_title: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          committee_id: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          email?: string | null
          full_name: string
          id?: string
          is_head?: boolean
          phone?: string | null
          role_title?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          committee_id?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          email?: string | null
          full_name?: string
          id?: string
          is_head?: boolean
          phone?: string | null
          role_title?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          committee_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_committee_fk"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_committee: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_committee_head: {
        Args: { _committee_id: string; _user_id: string }
        Returns: boolean
      }
      is_committee_member: {
        Args: { _committee_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      user_id_for_team_member: { Args: { _member_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "committee" | "delegate" | "quality"
      committee_type:
        | "finance"
        | "media"
        | "quality"
        | "programs"
        | "dinner"
        | "logistics"
        | "reception"
        | "design"
        | "procurement"
        | "women"
        | "supreme"
      groom_status:
        | "new"
        | "under_review"
        | "approved"
        | "rejected"
        | "completed"
      idea_status:
        | "new"
        | "under_review"
        | "approved"
        | "implemented"
        | "archived"
      payment_request_status: "pending" | "approved" | "rejected" | "paid"
      subscription_status: "pending" | "confirmed" | "rejected"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "completed"
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
  public: {
    Enums: {
      app_role: ["admin", "committee", "delegate", "quality"],
      committee_type: [
        "finance",
        "media",
        "quality",
        "programs",
        "dinner",
        "logistics",
        "reception",
        "design",
        "procurement",
        "women",
        "supreme",
      ],
      groom_status: [
        "new",
        "under_review",
        "approved",
        "rejected",
        "completed",
      ],
      idea_status: [
        "new",
        "under_review",
        "approved",
        "implemented",
        "archived",
      ],
      payment_request_status: ["pending", "approved", "rejected", "paid"],
      subscription_status: ["pending", "confirmed", "rejected"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "completed"],
    },
  },
} as const
