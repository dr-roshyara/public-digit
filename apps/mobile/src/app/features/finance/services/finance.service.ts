import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import {
  Payment,
  Invoice,
  Transaction,
  PaymentHistoryItem,
  MakePaymentRequest,
  PaymentResponse,
  PaymentHistoryResponse,
  InvoiceListResponse,
  InvoiceDetailsResponse,
  TransactionHistoryResponse,
  PaymentFilter,
  InvoiceFilter,
  FinancialSummary,
  FinancialSummaryResponse
} from '../models/finance.models';
import { TenantContextService } from '../../../core/services/tenant-context.service';

/**
 * Finance Service
 *
 * Bounded Context: Financial Operations & Payment Processing
 * Database: Tenant Database
 * API Prefix: /api/v1/finance
 *
 * Handles all financial and payment-related operations within the tenant context.
 * All API calls are tenant-scoped using the TenantContextService.
 *
 * Security: PCI DSS compliance for payment processing
 */
@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private http = inject(HttpClient);
  private tenantContext = inject(TenantContextService);

  // Reactive state
  private paymentHistorySubject = new BehaviorSubject<PaymentHistoryItem[]>([]);
  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  private selectedInvoiceSubject = new BehaviorSubject<Invoice | null>(null);
  private financialSummarySubject = new BehaviorSubject<FinancialSummary | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables
  public paymentHistory$ = this.paymentHistorySubject.asObservable();
  public invoices$ = this.invoicesSubject.asObservable();
  public selectedInvoice$ = this.selectedInvoiceSubject.asObservable();
  public financialSummary$ = this.financialSummarySubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  /**
   * Get base URL for finance API calls
   * Uses tenant-scoped URL from TenantContextService
   */
  private get baseUrl(): string {
    return `${this.tenantContext.getTenantApiUrl()}/finance`;
  }

  /**
   * Get payment history with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Observable<PaymentHistoryItem[]>
   */
  getPaymentHistory(filter?: PaymentFilter): Observable<PaymentHistoryItem[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams();
    if (filter) {
      if (filter.status && filter.status.length > 0) {
        params = params.set('status', filter.status.join(','));
      }
      if (filter.payment_method && filter.payment_method.length > 0) {
        params = params.set('payment_method', filter.payment_method.join(','));
      }
      if (filter.date_from) {
        params = params.set('date_from', filter.date_from);
      }
      if (filter.date_to) {
        params = params.set('date_to', filter.date_to);
      }
      if (filter.min_amount !== undefined) {
        params = params.set('min_amount', filter.min_amount.toString());
      }
      if (filter.max_amount !== undefined) {
        params = params.set('max_amount', filter.max_amount.toString());
      }
      if (filter.search_query) {
        params = params.set('search', filter.search_query);
      }
    }

    return this.http.get<PaymentHistoryResponse>(`${this.baseUrl}/payments`, { params }).pipe(
      map(response => response.data.payments),
      tap(payments => {
        this.paymentHistorySubject.next(payments);
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Loaded ${payments.length} payments`);
      }),
      catchError(error => this.handleError('getPaymentHistory', error))
    );
  }

  /**
   * Get invoices with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Observable<Invoice[]>
   */
  getInvoices(filter?: InvoiceFilter): Observable<Invoice[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams();
    if (filter) {
      if (filter.status && filter.status.length > 0) {
        params = params.set('status', filter.status.join(','));
      }
      if (filter.date_from) {
        params = params.set('date_from', filter.date_from);
      }
      if (filter.date_to) {
        params = params.set('date_to', filter.date_to);
      }
      if (filter.overdue_only) {
        params = params.set('overdue_only', 'true');
      }
      if (filter.unpaid_only) {
        params = params.set('unpaid_only', 'true');
      }
      if (filter.search_query) {
        params = params.set('search', filter.search_query);
      }
    }

    return this.http.get<InvoiceListResponse>(`${this.baseUrl}/invoices`, { params }).pipe(
      map(response => response.data.invoices),
      tap(invoices => {
        this.invoicesSubject.next(invoices);
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Loaded ${invoices.length} invoices`);
      }),
      catchError(error => this.handleError('getInvoices', error))
    );
  }

  /**
   * Get invoice details by ID
   *
   * @param invoiceId - Invoice ID
   * @returns Observable<Invoice>
   */
  getInvoiceDetails(invoiceId: number): Observable<Invoice> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<InvoiceDetailsResponse>(`${this.baseUrl}/invoices/${invoiceId}`).pipe(
      map(response => response.data),
      tap(invoice => {
        this.selectedInvoiceSubject.next(invoice);
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Loaded invoice: ${invoice.invoice_number}`);
      }),
      catchError(error => this.handleError('getInvoiceDetails', error))
    );
  }

  /**
   * Make a payment
   *
   * @param paymentRequest - Payment data
   * @returns Observable<PaymentResponse>
   */
  makePayment(paymentRequest: MakePaymentRequest): Observable<PaymentResponse> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    console.log(`[FinanceService] Initiating payment of ${paymentRequest.amount}`);

    return this.http.post<PaymentResponse>(
      `${this.baseUrl}/payments`,
      paymentRequest
    ).pipe(
      tap(response => {
        this.loadingSubject.next(false);
        if (response.success) {
          console.log(`[FinanceService] Payment successful. Reference: ${response.reference_number}`);
          // Refresh payment history and financial summary
          this.getPaymentHistory().subscribe();
          this.getFinancialSummary().subscribe();

          // If payment was for an invoice, refresh invoice details
          if (paymentRequest.invoice_id) {
            this.getInvoiceDetails(paymentRequest.invoice_id).subscribe();
          }
        }
      }),
      catchError(error => this.handleError('makePayment', error))
    );
  }

  /**
   * Get transaction history
   *
   * @param dateFrom - Optional start date
   * @param dateTo - Optional end date
   * @returns Observable<Transaction[]>
   */
  getTransactions(dateFrom?: string, dateTo?: string): Observable<Transaction[]> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let params = new HttpParams();
    if (dateFrom) {
      params = params.set('date_from', dateFrom);
    }
    if (dateTo) {
      params = params.set('date_to', dateTo);
    }

    return this.http.get<TransactionHistoryResponse>(
      `${this.baseUrl}/transactions`,
      { params }
    ).pipe(
      map(response => response.data.transactions),
      tap(transactions => {
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Loaded ${transactions.length} transactions`);
      }),
      catchError(error => this.handleError('getTransactions', error))
    );
  }

  /**
   * Get financial summary
   *
   * @returns Observable<FinancialSummary>
   */
  getFinancialSummary(): Observable<FinancialSummary> {
    // Return cached summary if available
    if (this.financialSummarySubject.value) {
      return new Observable(observer => {
        observer.next(this.financialSummarySubject.value!);
        observer.complete();
      });
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<FinancialSummaryResponse>(`${this.baseUrl}/summary`).pipe(
      map(response => response.data),
      tap(summary => {
        this.financialSummarySubject.next(summary);
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Loaded financial summary`);
      }),
      catchError(error => this.handleError('getFinancialSummary', error))
    );
  }

  /**
   * Download invoice as PDF
   *
   * @param invoiceId - Invoice ID
   * @returns Observable<Blob>
   */
  downloadInvoicePdf(invoiceId: number): Observable<Blob> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get(`${this.baseUrl}/invoices/${invoiceId}/pdf`, {
      responseType: 'blob'
    }).pipe(
      tap(() => {
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Downloaded invoice PDF: ${invoiceId}`);
      }),
      catchError(error => this.handleError('downloadInvoicePdf', error))
    );
  }

  /**
   * Download payment receipt as PDF
   *
   * @param paymentId - Payment ID
   * @returns Observable<Blob>
   */
  downloadPaymentReceipt(paymentId: number): Observable<Blob> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get(`${this.baseUrl}/payments/${paymentId}/receipt`, {
      responseType: 'blob'
    }).pipe(
      tap(() => {
        this.loadingSubject.next(false);
        console.log(`[FinanceService] Downloaded payment receipt: ${paymentId}`);
      }),
      catchError(error => this.handleError('downloadPaymentReceipt', error))
    );
  }

  /**
   * Refresh financial summary from server
   *
   * @returns Observable<FinancialSummary>
   */
  refreshFinancialSummary(): Observable<FinancialSummary> {
    this.financialSummarySubject.next(null);
    return this.getFinancialSummary();
  }

  /**
   * Clear selected invoice
   */
  clearSelectedInvoice(): void {
    this.selectedInvoiceSubject.next(null);
  }

  /**
   * Clear all cached data
   * Useful when switching tenants or logging out
   */
  clearCache(): void {
    this.paymentHistorySubject.next([]);
    this.invoicesSubject.next([]);
    this.selectedInvoiceSubject.next(null);
    this.financialSummarySubject.next(null);
    this.errorSubject.next(null);
    this.loadingSubject.next(false);
  }

  /**
   * Get currently selected invoice (synchronous)
   *
   * @returns Invoice | null
   */
  getSelectedInvoice(): Invoice | null {
    return this.selectedInvoiceSubject.value;
  }

  /**
   * Format currency amount for display
   *
   * @param amount - Amount to format
   * @param currency - Currency code (default: USD)
   * @returns Formatted string
   */
  formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Check if invoice is overdue
   *
   * @param invoice - Invoice to check
   * @returns boolean
   */
  isOverdue(invoice: Invoice): boolean {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return false;
    }

    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    return dueDate < today;
  }

  /**
   * Handle HTTP errors consistently
   *
   * @param operation - Name of the operation that failed
   * @param error - HTTP error response
   * @returns Observable that throws error
   */
  private handleError(operation: string, error: HttpErrorResponse): Observable<never> {
    this.loadingSubject.next(false);

    let errorMessage = 'An unexpected error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Backend returned an unsuccessful response code
      errorMessage = error.error?.message || `Server error: ${error.status}`;

      // Special handling for payment errors
      if (operation === 'makePayment') {
        if (error.status === 402) {
          errorMessage = 'Payment failed. Please check your payment method';
        } else if (error.status === 403) {
          errorMessage = 'You are not authorized to make this payment';
        } else if (error.status === 422) {
          errorMessage = 'Invalid payment data. Please check your information';
        }
      }
    }

    this.errorSubject.next(errorMessage);
    console.error(`[FinanceService] ${operation} failed:`, errorMessage, error);

    return throwError(() => new Error(errorMessage));
  }
}
