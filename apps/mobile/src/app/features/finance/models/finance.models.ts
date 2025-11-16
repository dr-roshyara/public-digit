/**
 * Finance Context - Domain Models
 *
 * Bounded Context: Financial Operations & Payment Processing
 * Database: Tenant Database
 * API Prefix: /api/v1/finance
 *
 * These models represent the financial domain within the tenant context.
 */

/**
 * Payment Status
 *
 * Represents the lifecycle states of a payment
 */
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

/**
 * Payment Method
 *
 * Available payment methods
 */
export type PaymentMethod = 'credit_card' | 'debit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'cash' | 'check';

/**
 * Transaction Type
 *
 * Types of financial transactions
 */
export type TransactionType = 'payment' | 'refund' | 'fee' | 'adjustment' | 'credit';

/**
 * Invoice Status
 *
 * Represents the status of an invoice
 */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

/**
 * Payment
 *
 * Represents a payment transaction
 */
export interface Payment {
  id: number;
  tenant_id: number;
  member_id: number;

  // Payment Information
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;

  // Description and References
  description: string;
  reference_number: string;
  invoice_id?: number;
  invoice_number?: string;

  // Payment Gateway Details
  gateway_transaction_id?: string;
  gateway_response?: any;

  // Timestamps
  payment_date: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;

  // Related Entities
  invoice?: Invoice;
  member_name?: string;
}

/**
 * Invoice
 *
 * Represents an invoice for payment
 */
export interface Invoice {
  id: number;
  tenant_id: number;
  member_id: number;

  // Invoice Information
  invoice_number: string;
  title: string;
  description?: string;
  status: InvoiceStatus;

  // Financial Details
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;

  // Dates
  issue_date: string;
  due_date: string;
  paid_date?: string;

  // Line Items
  line_items: InvoiceLineItem[];

  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;

  // Related Entities
  member_name?: string;
  payments?: Payment[];
}

/**
 * Invoice Line Item
 *
 * Individual line item within an invoice
 */
export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate?: number;
  tax_amount?: number;
}

/**
 * Transaction
 *
 * Represents a financial transaction
 */
export interface Transaction {
  id: number;
  tenant_id: number;
  member_id: number;

  // Transaction Information
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  reference_number: string;

  // Related Entities
  payment_id?: number;
  invoice_id?: number;

  // Balance Impact
  balance_before: number;
  balance_after: number;

  // Timestamps
  transaction_date: string;
  created_at: string;

  // Metadata
  created_by?: number;
  notes?: string;
}

/**
 * Payment History Item
 *
 * Lightweight payment information for list views
 */
export interface PaymentHistoryItem {
  id: number;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  description: string;
  reference_number: string;
  payment_date: string;
  invoice_number?: string;
}

/**
 * Make Payment Request
 *
 * Data structure for initiating a payment
 */
export interface MakePaymentRequest {
  amount: number;
  payment_method: PaymentMethod;
  description?: string;
  invoice_id?: number;

  // Payment Gateway Details (if using online payment)
  payment_token?: string;
  card_last_four?: string;
  billing_address?: BillingAddress;

  // Additional Data
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Billing Address
 *
 * Address information for payment processing
 */
export interface BillingAddress {
  line_1: string;
  line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

/**
 * Payment Response
 *
 * Response after initiating a payment
 */
export interface PaymentResponse {
  success: boolean;
  message: string;
  payment_id: number;
  reference_number: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  requires_additional_action?: boolean;
  next_action?: {
    type: string;
    redirect_url?: string;
    confirmation_required?: boolean;
  };
}

/**
 * Payment History Response
 *
 * Response for payment history listing
 */
export interface PaymentHistoryResponse {
  success: boolean;
  message?: string;
  data: {
    payments: PaymentHistoryItem[];
    total_count: number;
    total_amount: number;
    currency: string;
  };
}

/**
 * Invoice List Response
 *
 * Response for invoice listing
 */
export interface InvoiceListResponse {
  success: boolean;
  message?: string;
  data: {
    invoices: Invoice[];
    total_count: number;
    total_outstanding: number;
    currency: string;
  };
}

/**
 * Invoice Details Response
 *
 * Response for invoice details
 */
export interface InvoiceDetailsResponse {
  success: boolean;
  message?: string;
  data: Invoice;
}

/**
 * Transaction History Response
 *
 * Response for transaction history listing
 */
export interface TransactionHistoryResponse {
  success: boolean;
  message?: string;
  data: {
    transactions: Transaction[];
    total_count: number;
    current_balance: number;
    currency: string;
  };
}

/**
 * Payment Filter
 *
 * Filter options for payment listings
 */
export interface PaymentFilter {
  status?: PaymentStatus[];
  payment_method?: PaymentMethod[];
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  search_query?: string;
}

/**
 * Invoice Filter
 *
 * Filter options for invoice listings
 */
export interface InvoiceFilter {
  status?: InvoiceStatus[];
  date_from?: string;
  date_to?: string;
  overdue_only?: boolean;
  unpaid_only?: boolean;
  search_query?: string;
}

/**
 * Financial Summary
 *
 * Summary of member's financial information
 */
export interface FinancialSummary {
  current_balance: number;
  total_paid: number;
  total_outstanding: number;
  total_invoices: number;
  total_payments: number;
  currency: string;

  // Recent Activity
  recent_payments: PaymentHistoryItem[];
  recent_invoices: Invoice[];

  // Stats
  payment_history_months: number;
  average_payment_amount: number;
  largest_payment_amount: number;
}

/**
 * Financial Summary Response
 *
 * Response for financial summary
 */
export interface FinancialSummaryResponse {
  success: boolean;
  message?: string;
  data: FinancialSummary;
}
