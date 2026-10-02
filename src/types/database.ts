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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_integrations: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          display_name: string | null
          last_error: string | null
          provider: string
          root_folder_id: string | null
          root_folder_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          display_name?: string | null
          last_error?: string | null
          provider: string
          root_folder_id?: string | null
          root_folder_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          display_name?: string | null
          last_error?: string | null
          provider?: string
          root_folder_id?: string | null
          root_folder_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_memberships: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_communications: {
        Row: {
          body: string
          channel: string
          client_id: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          project_id: string | null
          subject: string | null
        }
        Insert: {
          body: string
          channel?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          project_id?: string | null
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          project_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          category: string
          client_id: string
          client_visible: boolean
          created_at: string
          created_by: string | null
          drive_file_id: string | null
          executed_artifact_id: string | null
          fully_executed_at: string | null
          id: string
          name: string
          project_id: string | null
          requires_signature: boolean
          signature_kind: string | null
          state: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          drive_file_id?: string | null
          executed_artifact_id?: string | null
          fully_executed_at?: string | null
          id?: string
          name: string
          project_id?: string | null
          requires_signature?: boolean
          signature_kind?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          client_visible?: boolean
          created_at?: string
          created_by?: string | null
          drive_file_id?: string | null
          executed_artifact_id?: string | null
          fully_executed_at?: string | null
          id?: string
          name?: string
          project_id?: string | null
          requires_signature?: boolean
          signature_kind?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_executed_artifact_id_fkey"
            columns: ["executed_artifact_id"]
            isOneToOne: false
            referencedRelation: "executed_document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_memberships: {
        Row: {
          client_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_memberships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          drive_folder_id: string | null
          id: string
          name: string
          portal_unlocked: boolean
          primary_contact_name: string
          primary_email: string
          source_inquiry_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string | null
          id?: string
          name: string
          portal_unlocked?: boolean
          primary_contact_name: string
          primary_email: string
          source_inquiry_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string | null
          id?: string
          name?: string
          portal_unlocked?: boolean
          primary_contact_name?: string
          primary_email?: string
          source_inquiry_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_source_inquiry_id_fkey"
            columns: ["source_inquiry_id"]
            isOneToOne: true
            referencedRelation: "project_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          summary: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          summary: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          summary?: string
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          content_sha256: string | null
          content_snapshot: string
          created_at: string
          created_by: string | null
          document_id: string
          drive_file_id: string | null
          id: string
          state: string
          version_number: number
        }
        Insert: {
          content_sha256?: string | null
          content_snapshot: string
          created_at?: string
          created_by?: string | null
          document_id: string
          drive_file_id?: string | null
          id?: string
          state?: string
          version_number: number
        }
        Update: {
          content_sha256?: string | null
          content_snapshot?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          drive_file_id?: string | null
          id?: string
          state?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      executed_document_artifacts: {
        Row: {
          byte_size: number
          client_id: string
          document_id: string
          document_version_id: string
          drive_error: string | null
          drive_file_id: string | null
          drive_folder_id: string | null
          drive_sync_status: string
          drive_synced_at: string | null
          final_sha256: string
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json
          project_id: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          byte_size: number
          client_id: string
          document_id: string
          document_version_id: string
          drive_error?: string | null
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_sync_status?: string
          drive_synced_at?: string | null
          final_sha256: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          byte_size?: number
          client_id?: string
          document_id?: string
          document_version_id?: string
          drive_error?: string | null
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_sync_status?: string
          drive_synced_at?: string | null
          final_sha256?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "executed_document_artifacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_document_artifacts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_document_artifacts_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_document_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_memberships: {
        Row: {
          created_at: string
          inquiry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          inquiry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          inquiry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_memberships_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "project_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          inquiry_id: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "project_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_connection_states: {
        Row: {
          created_at: string
          expires_at: string
          provider: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          provider: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          provider?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_inquiries: {
        Row: {
          budget_range: string
          company: string | null
          created_at: string
          details: string
          email: string
          id: string
          involvement: string
          ip_hash: string | null
          metadata: Json
          name: string
          origin: string | null
          project_type: string
          request_id: string
          source: string
          status: string
          timeline: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          budget_range: string
          company?: string | null
          created_at?: string
          details: string
          email: string
          id?: string
          involvement: string
          ip_hash?: string | null
          metadata?: Json
          name: string
          origin?: string | null
          project_type: string
          request_id: string
          source?: string
          status?: string
          timeline: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          budget_range?: string
          company?: string | null
          created_at?: string
          details?: string
          email?: string
          id?: string
          involvement?: string
          ip_hash?: string | null
          metadata?: Json
          name?: string
          origin?: string | null
          project_type?: string
          request_id?: string
          source?: string
          status?: string
          timeline?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      project_milestones: {
        Row: {
          client_visible: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          milestone_key: string
          position: number
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          milestone_key: string
          position?: number
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          milestone_key?: string
          position?: number
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          phase: string
          progress: number
          project_type: string | null
          source_inquiry_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          phase?: string
          progress?: number
          project_type?: string | null
          source_inquiry_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          phase?: string
          progress?: number
          project_type?: string | null
          source_inquiry_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_inquiry_id_fkey"
            columns: ["source_inquiry_id"]
            isOneToOne: true
            referencedRelation: "project_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          document_sha256: string | null
          event_type: string
          id: string
          legal_name: string | null
          metadata: Json
          signature_request_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          document_sha256?: string | null
          event_type: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          signature_request_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          document_sha256?: string | null
          event_type?: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          signature_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_events_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          client_id: string
          consent_text: string
          document_id: string
          document_version_id: string
          id: string
          legal_name: string | null
          project_id: string | null
          requested_at: string
          requested_by: string | null
          sequence: number
          signature_kind: string
          signature_value: string | null
          signed_at: string | null
          signed_content_sha256: string | null
          signer_email: string
          signer_name: string
          signer_side: string
          signer_user_id: string | null
          status: string
          viewed_at: string | null
        }
        Insert: {
          client_id: string
          consent_text: string
          document_id: string
          document_version_id: string
          id?: string
          legal_name?: string | null
          project_id?: string | null
          requested_at?: string
          requested_by?: string | null
          sequence?: number
          signature_kind: string
          signature_value?: string | null
          signed_at?: string | null
          signed_content_sha256?: string | null
          signer_email: string
          signer_name: string
          signer_side: string
          signer_user_id?: string | null
          status?: string
          viewed_at?: string | null
        }
        Update: {
          client_id?: string
          consent_text?: string
          document_id?: string
          document_version_id?: string
          id?: string
          legal_name?: string | null
          project_id?: string | null
          requested_at?: string
          requested_by?: string | null
          sequence?: number
          signature_kind?: string
          signature_value?: string | null
          signed_at?: string | null
          signed_content_sha256?: string | null
          signer_email?: string
          signer_name?: string
          signer_side?: string
          signer_user_id?: string | null
          status?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      configure_google_drive_oauth: {
        Args: { p_client_id: string; p_client_secret: string }
        Returns: undefined
      }
      convert_lead_to_client: {
        Args: { p_inquiry_id: string }
        Returns: string
      }
      countersign_document: {
        Args: { p_document_id: string; p_legal_name: string }
        Returns: undefined
      }
      create_signable_document: {
        Args: {
          p_category: string
          p_client_id: string
          p_content: string
          p_name: string
          p_project_id: string
          p_signature_kind?: string
        }
        Returns: string
      }
      google_drive_oauth_credentials: {
        Args: never
        Returns: {
          client_id: string
          client_secret: string
          refresh_token: string
        }[]
      }
      mark_signature_viewed: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      sign_document: {
        Args: {
          p_consent: boolean
          p_legal_name: string
          p_request_id: string
          p_signature_value: string
        }
        Returns: undefined
      }
      store_google_drive_refresh_token: {
        Args: { p_refresh_token: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "staff" | "client"
      membership_status: "invited" | "active" | "suspended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "admin", "staff", "client"],
      membership_status: ["invited", "active", "suspended"],
    },
  },
} as const
