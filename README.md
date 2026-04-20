# AFGTopup — API Integration Starter Kit
Plug-and-play Node.js integration for the AFGTopup mobile top-up API.
Send airtime top-ups to Afghanistan, Pakistan, Algeria, Morocco, Nigeria, and Kenya.

---

## What's in this kit

| File | Purpose |
|------|---------|
| `afgtopup-client.js` | The API client — all 4 endpoints, ready to import |
| `example.js` | Full working demo — run this to test your key |
| `.env.example` | Environment variable template |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set your API key
```bash
cp .env.example .env
```
Open `.env` and replace `your_api_key_here` with the key provided by your account manager.

### 3. Test your key
```bash
node example.js
```
If everything is working you will see all 4 steps complete successfully.

---

## Integration Guide

### Import the client
```javascript
const {
  getOperators,
  detectOperator,
  getPrice,
  sendTopup
} = require('./afgtopup-client');
```

### Step 1 — List operators
```javascript
const operators = await getOperators('AF');
// Returns array of { operator_id, name, currency_code, ... }
```

### Step 2 — Detect operator from phone number
```javascript
const detected = await detectOperator('+93700123456', 'AF');
// Returns { operator_id, operator_name, ... }
// Falls back to 422 if detection fails — show manual dropdown instead
```

### Step 3 — Get price
```javascript
const pricing = await getPrice('AF', operatorId, 100);
// Returns { eur_cost: 2.0623, local_amount: 100, currency: 'AFN', ... }
// Show eur_cost to your customer. Add your markup on top.
```

### Step 4 — Send top-up (after customer pays you)
```javascript
const result = await sendTopup({
  phone:      '+93700123456',
  amount:     100,
  country:    'AF',
  operatorId: 1,
  externalId: 'your_internal_order_id',  // required — prevents duplicate top-ups
  email:      'customer@example.com'     // optional — sends delivery confirmation
});
// Returns { transaction_id, status: 'processing', eur_charged, balance_after }
```

---

## Supported Countries

| Code | Country | Currency | Min Amount |
|------|---------|----------|------------|
| AF | 🇦🇫 Afghanistan | AFN | 10 AFN |
| PK | 🇵🇰 Pakistan | PKR | 50 PKR |
| DZ | 🇩🇿 Algeria | DZD | 50 DZD |
| MA | 🇲🇦 Morocco | MAD | 5 MAD |
| NG | 🇳🇬 Nigeria | NGN | 100 NGN |
| KE | 🇰🇪 Kenya | KES | 10 KES |

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad input | Check required fields and formats |
| 401 | Invalid API key | Check your `.env` file |
| 402 | Insufficient balance | Contact your account manager to top up |
| 403 | Account suspended | Contact support |
| 422 | Operator not detected | Show manual operator dropdown |
| 429 | Rate limit (60/min) | Add retry with backoff |
| 500/503 | Server error | Retry after a few seconds |

---

## Security Rules

- **Never put your API key in frontend code, mobile apps, or Git.**
- All API calls must come from your **backend server only.**
- Always pass `externalId` (your order ID) to prevent duplicate top-ups on retry.
- Delivery is asynchronous — credit arrives within ~60 seconds of the top-up call.

---

## How it works

```
Your customer pays you
       ↓
Your server calls /partner-topup with X-API-Key
       ↓
AFGTopup verifies key + checks your balance
       ↓
Top-up queued → delivered to phone within ~60 seconds
       ↓
EUR cost deducted from your prepaid balance
```

---

## Account & Support

Contact us to top up your balance, rotate your API key, or request higher limits.

**Email:** support@afgtopup.com
