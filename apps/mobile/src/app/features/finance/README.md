# Finance Context

**Bounded Context:** Financial Operations & Payment Processing
**Database:** Tenant Database
**API Prefix:** `/api/v1/finance`
**Frontend:** Angular (Tenant Member Experience)

## Purpose

Handles all financial and payment-related operations for tenant members, including:
- View payment history
- Make payments
- View invoices
- Track transactions
- Manage payment methods

## Structure

```
finance/
├── services/
│   └── finance.service.ts       # Payment and transaction operations
├── models/
│   └── finance.models.ts        # TypeScript interfaces
└── components/                  # Phase 3+ UI components
    ├── payment-history/
    ├── make-payment/
    └── invoice-view/
```

## API Endpoints

- `GET /api/v1/finance/payments` - Get payment history
- `POST /api/v1/finance/payments` - Make a payment
- `GET /api/v1/finance/invoices` - List invoices
- `GET /api/v1/finance/invoices/{id}` - Get invoice details
- `GET /api/v1/finance/transactions` - List transactions

## DDD Alignment

This context aligns with the **Finance** bounded context defined in the Laravel backend architecture manifest.

## Security

- PCI DSS compliance for payment processing
- Secure payment gateway integration
- Transaction audit trail
- Member-specific financial data isolation
