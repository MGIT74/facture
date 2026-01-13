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
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          legal_name: string | null
          registration_number: string | null
          vat_number: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string
          email: string | null
          phone: string | null
          website: string | null
          logo_url: string | null
          default_currency: string
          invoice_prefix: string
          next_invoice_number: number
          quote_prefix: string
          next_quote_number: number
          default_tax_rate: number
          payment_terms_days: number
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          legal_name?: string | null
          registration_number?: string | null
          vat_number?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          email?: string | null
          phone?: string | null
          website?: string | null
          logo_url?: string | null
          default_currency?: string
          invoice_prefix?: string
          next_invoice_number?: number
          quote_prefix?: string
          next_quote_number?: number
          default_tax_rate?: number
          payment_terms_days?: number
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          legal_name?: string | null
          registration_number?: string | null
          vat_number?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string
          email?: string | null
          phone?: string | null
          website?: string | null
          logo_url?: string | null
          default_currency?: string
          invoice_prefix?: string
          next_invoice_number?: number
          quote_prefix?: string
          next_quote_number?: number
          default_tax_rate?: number
          payment_terms_days?: number
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          vat_number: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          vat_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          country?: string | null
          vat_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          unit_price: number
          tax_rate: number
          unit: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          unit_price: number
          tax_rate?: number
          unit?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          unit_price?: number
          tax_rate?: number
          unit?: string
          created_at?: string
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          company_id: string
          client_id: string
          number: string
          status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
          currency_code: string
          exchange_rate: number
          issue_date: string
          expiry_date: string | null
          subtotal: number
          tax_total: number
          discount_total: number
          total: number
          notes: string | null
          terms: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          number: string
          status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
          currency_code?: string
          exchange_rate?: number
          issue_date: string
          expiry_date?: string | null
          subtotal?: number
          tax_total?: number
          discount_total?: number
          total?: number
          notes?: string | null
          terms?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string
          number?: string
          status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
          currency_code?: string
          exchange_rate?: number
          issue_date?: string
          expiry_date?: string | null
          subtotal?: number
          tax_total?: number
          discount_total?: number
          total?: number
          notes?: string | null
          terms?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quote_lines: {
        Row: {
          id: string
          quote_id: string
          item_id: string | null
          description: string
          quantity: number
          unit_price: number
          discount_rate: number
          tax_rate: number
          line_total: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          item_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          discount_rate?: number
          tax_rate?: number
          line_total: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          item_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          discount_rate?: number
          tax_rate?: number
          line_total?: number
          sort_order?: number
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          client_id: string
          quote_id: string | null
          number: string
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          currency_code: string
          exchange_rate: number
          issue_date: string
          due_date: string
          paid_date: string | null
          subtotal: number
          tax_total: number
          discount_total: number
          total: number
          amount_paid: number
          balance_due: number
          notes: string | null
          terms: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          quote_id?: string | null
          number: string
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          currency_code?: string
          exchange_rate?: number
          issue_date: string
          due_date: string
          paid_date?: string | null
          subtotal?: number
          tax_total?: number
          discount_total?: number
          total?: number
          amount_paid?: number
          balance_due?: number
          notes?: string | null
          terms?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string
          quote_id?: string | null
          number?: string
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          currency_code?: string
          exchange_rate?: number
          issue_date?: string
          due_date?: string
          paid_date?: string | null
          subtotal?: number
          tax_total?: number
          discount_total?: number
          total?: number
          amount_paid?: number
          balance_due?: number
          notes?: string | null
          terms?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          item_id: string | null
          description: string
          quantity: number
          unit_price: number
          discount_rate: number
          tax_rate: number
          line_total: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          item_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          discount_rate?: number
          tax_rate?: number
          line_total: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          item_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          discount_rate?: number
          tax_rate?: number
          line_total?: number
          sort_order?: number
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          company_id: string
          invoice_id: string
          amount: number
          payment_date: string
          payment_method: 'bank_transfer' | 'cash' | 'check' | 'card' | 'other'
          reference: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          invoice_id: string
          amount: number
          payment_date: string
          payment_method: 'bank_transfer' | 'cash' | 'check' | 'card' | 'other'
          reference?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          invoice_id?: string
          amount?: number
          payment_date?: string
          payment_method?: 'bank_transfer' | 'cash' | 'check' | 'card' | 'other'
          reference?: string | null
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
