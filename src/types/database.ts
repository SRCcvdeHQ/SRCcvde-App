export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: {
      app_memberships: {
        Row: { created_at:string; role:'owner'|'admin'|'staff'|'client'; status:'invited'|'active'|'suspended'; updated_at:string; user_id:string }
        Insert: { created_at?:string; role?:'owner'|'admin'|'staff'|'client'; status?:'invited'|'active'|'suspended'; updated_at?:string; user_id:string }
        Update: { created_at?:string; role?:'owner'|'admin'|'staff'|'client'; status?:'invited'|'active'|'suspended'; updated_at?:string; user_id?:string }
        Relationships: []
      }
      profiles: {
        Row: { avatar_url:string|null; created_at:string; email:string|null; full_name:string|null; id:string; updated_at:string }
        Insert: { avatar_url?:string|null; created_at?:string; email?:string|null; full_name?:string|null; id:string; updated_at?:string }
        Update: { avatar_url?:string|null; created_at?:string; email?:string|null; full_name?:string|null; id?:string; updated_at?:string }
        Relationships: []
      }
      project_inquiries: {
        Row: { budget_range:string; company:string|null; created_at:string; details:string; email:string; id:string; involvement:string; ip_hash:string|null; metadata:Json; name:string; origin:string|null; project_type:string; request_id:string; source:string; status:string; timeline:string; updated_at:string; user_agent:string|null }
        Insert: { budget_range:string; company?:string|null; created_at?:string; details:string; email:string; id?:string; involvement:string; ip_hash?:string|null; metadata?:Json; name:string; origin?:string|null; project_type:string; request_id:string; source?:string; status?:string; timeline:string; updated_at?:string; user_agent?:string|null }
        Update: Partial<Database['public']['Tables']['project_inquiries']['Insert']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { is_src_staff: { Args: never; Returns:boolean } }
    Enums: { app_role:'owner'|'admin'|'staff'|'client'; membership_status:'invited'|'active'|'suspended' }
    CompositeTypes: { [_ in never]: never }
  }
}
