# AFGTopup — API Integration Starter Kit


Node.js is provided as a reference implementation; the AFGTopup Partner API can be integrated from any backend technology capable of making HTTPS requests and handling JSON. Regardless of language, the same rules apply: keep the API key server-side only, use HTTPS, and generate a unique `external_id` per order.

A reference Node.js client for the AFGTopup Partner API — the API itself works with any backend that can make HTTPS requests.

Send mobile airtime top-ups to supported countries using a secure prepaid API account.

Currently supported countries:

- Afghanistan
- Pakistan
- Algeria
- Morocco
- Nigeria
- Kenya

---

# What's in this kit

| File | Purpose |
|------|---------|
| `afgtopup-client.js` | API client covering all 4 endpoints |
| `example.js` | Complete integration example |
| `.env.example` | Environment variable template |
| `README.md` | Integration documentation |

---

# Quick Start

## 1. Install dependencies

```bash
npm install

```

Node.js 18 or newer is recommended.

---

## 2. Configure your API key

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and add the API key provided by AFGTopup:

```env
AFGTOPUP_API_KEY=your_private_api_key_here
```

Do not put your real API key directly inside JavaScript code.

Do not commit your `.env` file to GitHub.

AFGTopup may rotate your credential before LIVE activation. When that happens, replace only the server-side environment variable; the API integration code and endpoint URLs stay the same.

---

## 3. Test the integration

Before running the example, open:

```text
example.js
```

and replace the example phone number with a phone number you are authorized to use for testing.

Then run:

```bash
node example.js
```

or:

```bash
npm test
```

Before Step 4, check your Partner Portal:

```text
https://afgtopup.com/partners/
```

If the portal shows **SANDBOX**, the top-up is simulated: no real mobile credit is sent and no prepaid balance is deducted.

If the portal shows **LIVE**, Step 4 is a real top-up and can deduct funds from your prepaid AFGTopup balance.

---

# Integration Flow

Build and test this flow in **SANDBOX** first. After AFGTopup enables **LIVE**, the same integration is used for real top-ups.

The recommended integration flow is:

```text
Customer enters phone number
        ↓
Detect mobile operator
        ↓
Get real-time EUR price
        ↓
Complete your own order/payment flow
        ↓
Create and store a unique external_id
        ↓
Send top-up
        ↓
Receive AFGTopup transaction_id
        ↓
LIVE: initial status = processing
SANDBOX: simulated status = success
```

---

# Import the Client

```javascript
const {
  getOperators,
  detectOperator,
  getPrice,
  sendTopup
} = require('./afgtopup-client');
```

---

# API Base URL

```text
https://afgtopup.com/.netlify/functions
```

Authentication is performed using your private API key:

```http
X-API-Key: your_private_api_key
```

The included `afgtopup-client.js` handles this automatically.

---

# Sandbox and Live Environments

AFGTopup supports two Partner API environments:

```text
SANDBOX
LIVE
```

AFGTopup controls the environment on your Partner account.

You use the **same API base URL, endpoint paths and request format** in both environments. You do not need to change your integration code when moving from SANDBOX to LIVE.

For security, AFGTopup issues or rotates the Partner API credential before LIVE activation. Update only the server-side `AFGTOPUP_API_KEY` environment variable with the new credential provided privately by AFGTopup.

Check your current environment in the Partner Portal:

```text
https://afgtopup.com/partners/
```

The portal displays:

```text
SANDBOX  → simulated top-ups only
LIVE     → real top-ups enabled
```

## Sandbox behavior

When your account is in **SANDBOX**:

- API authentication works normally.
- Request validation works normally.
- Operator and country validation still runs.
- Current EUR pricing is still calculated.
- The €50 maximum transaction rule still applies.
- `external_id` and duplicate protection still apply.
- No prepaid balance is deducted.
- No real mobile credit is sent.
- The request is not submitted for live delivery.

Example sandbox response:

```javascript
{
  success: true,
  sandbox: true,
  environment: "sandbox",
  simulated: true,
  transaction_id: "pr_sbx_example_123",
  status: "success",
  message: "Sandbox top-up simulated successfully. No real mobile credit was sent and no balance was deducted.",
  eur_charged: 1.93,
  balance_after: 10.00,
  balance_unchanged: true,
  real_topup_sent: false,
  balance_deducted: false,
  external_id: "sandbox_order_100001"
}
```

A successful sandbox simulation normally returns HTTP `200`.

## Moving to Live

When your integration is ready, contact AFGTopup.

Before LIVE activation, AFGTopup issues or rotates your private Partner API credential. Store the new credential only in your backend environment variable and remove the previous sandbox/test credential from your systems where it is no longer needed.

AFGTopup then switches the Partner account from **SANDBOX** to **LIVE**.

Before sending a real top-up, confirm that your backend is using the newly issued LIVE credential and that the Partner Portal shows the green:

```text
LIVE
```

In LIVE mode:

- The accepted EUR charge is deducted from your prepaid balance.
- The top-up is submitted to the live AFGTopup processing flow.
- Real mobile credit can be sent to the recipient.
- The initial accepted status is normally `processing`.

Example live response:

```javascript
{
  success: true,
  sandbox: false,
  environment: "live",
  transaction_id: "pr_example_123",
  status: "processing",
  message: "Top-up queued successfully.",
  eur_charged: 1.93,
  balance_after: 8.07,
  external_id: "order_100001"
}
```

A successfully accepted live top-up normally returns HTTP `202`.

Recommended onboarding flow:

```text
Receive API account
        ↓
Integrate in SANDBOX
        ↓
Test operator detection + pricing + top-up submission
        ↓
Confirm sandbox response
        ↓
Ask AFGTopup to enable LIVE
        ↓
Receive/rotate LIVE API credential
        ↓
Update backend environment variable
        ↓
Confirm LIVE badge in Partner Portal
        ↓
Run one small controlled real top-up
        ↓
Start normal production usage
```

---

# Available Endpoints

| Function | Method | Endpoint |
|----------|--------|----------|
| List operators | GET | `/partner-operators` |
| Detect operator | GET | `/partner-detect` |
| Get price | GET | `/partner-price` |
| Send top-up | POST | `/partner-topup` |

---

# Step 1 — List Operators

Use this to retrieve supported mobile networks for a country.

```javascript
const operators = await getOperators('AF');

console.log(operators);
```

Example response:

```javascript
[
  {
    operator_id: 1,
    name: "Afghan Wireless Afghanistan",
    country: "AF",
    currency_code: "AFN"
  }
]
```

The returned `operator_id` can be used for pricing and top-up requests.

---

# Step 2 — Detect Operator

AFGTopup can automatically detect the mobile operator from the recipient phone number.

```javascript
const detected = await detectOperator(
  '+93700123456',
  'AF'
);

console.log(detected);
```

Example response:

```javascript
{
  phone: "+93700123456",
  operator_id: 1,
  operator_name: "Afghan Wireless Afghanistan",
  country: "AF",
  currency_code: "AFN"
}
```

Phone numbers should use international E.164 format.

Example:

```text
+93700123456
```

If automatic detection returns HTTP `422`, use:

```javascript
getOperators(country)
```

and allow the user to select their mobile network manually.

---

# Step 3 — Get Real-Time Price

Always request the current price before sending a top-up.

```javascript
const pricing = await getPrice(
  'AF',
  detected.operator_id,
  100
);

console.log(pricing);
```

Example response:

```javascript
{
  local_amount: 100,
  currency: "AFN",
  eur_cost: 1.93,
  operator_id: 1,
  operator_name: "Afghan Wireless Afghanistan",
  country: "AF",
  max_eur: 50
}
```

`eur_cost` is the EUR partner price. In LIVE mode, this is the amount deducted from your prepaid AFGTopup partner balance. In SANDBOX mode, it is calculated for testing but is not deducted.

EUR prices and balance values are returned to 2 decimal places.

Example prices shown in this documentation are illustrative only.

Always use the current `eur_cost` returned by the API.

Do not hardcode example prices into your application.

---

# Step 4 — Send Top-Up

After your own order is ready, submit the top-up:

```javascript
const result = await sendTopup({
  phone: '+93700123456',
  amount: 100,
  country: 'AF',
  operatorId: detected.operator_id,
  externalId: 'order_100001',
  email: null
});

console.log(result);
```

The response depends on your Partner account environment.

Sandbox example:

```javascript
{
  success: true,
  sandbox: true,
  environment: "sandbox",
  simulated: true,
  transaction_id: "pr_sbx_example_123",
  status: "success",
  eur_charged: 1.93,
  balance_after: 10.00,
  balance_unchanged: true,
  real_topup_sent: false,
  balance_deducted: false,
  external_id: "order_100001"
}
```

Live example:

```javascript
{
  success: true,
  sandbox: false,
  environment: "live",
  transaction_id: "pr_example_123",
  status: "processing",
  message: "Top-up queued successfully.",
  eur_charged: 1.93,
  balance_after: 48.07,
  external_id: "order_100001"
}
```

Partner transaction IDs generated by AFGTopup start with:

```text
pr_
```

Sandbox simulation references use:

```text
pr_sbx_
```

Live example:

```text
pr_example_123
```

Store the returned `transaction_id` with your own order records.

---

# external_id — Very Important

`externalId` is required for every top-up.

It should be your own unique internal order/reference ID.

Example:

```javascript
externalId: 'order_100001'
```

Every NEW top-up must use a NEW external ID:

```text
order_100001
order_100002
order_100003
```

Do not reuse an external ID for a different customer order.

---

# Safe Retry Rule

If the same request times out or the connection is interrupted, retry using the SAME external ID.

Correct:

```text
First request:
order_100001

Retry of same order:
order_100001
```

Incorrect:

```text
First request:
order_100001

Retry:
order_100002
```

Changing the external ID can make the retry look like a completely new top-up.

AFGTopup retains duplicate protection for approximately 14 days.

---

# Duplicate Replay

If the same completed `external_id` is safely retried, the API may return the existing transaction.

Example:

```javascript
{
  success: true,
  transaction_id: "pr_example_123",
  status: "processing",
  eur_charged: 1.93,
  balance_after: 48.07,
  external_id: "order_100001",
  _replayed: true
}
```

If:

```javascript
result._replayed === true
```

the API is returning the existing transaction instead of creating a duplicate top-up.

---

# Supported Countries

| Code | Country | Currency |
|------|---------|----------|
| AF | Afghanistan | AFN |
| PK | Pakistan | PKR |
| DZ | Algeria | DZD |
| MA | Morocco | MAD |
| NG | Nigeria | NGN |
| KE | Kenya | KES |

Use two-letter ISO country codes.

Examples:

```text
AF
PK
DZ
MA
NG
KE
```

Available operators should be retrieved dynamically using:

```javascript
getOperators(country)
```

---

# Prepaid Balance

AFGTopup Partner API accounts use a prepaid EUR balance for **LIVE** top-ups.

In LIVE mode, before accepting a top-up, AFGTopup:

```text
Authenticates API key
        ↓
Calculates current partner price
        ↓
Checks available prepaid balance
        ↓
Safely deducts EUR cost
        ↓
Queues top-up for processing
```

In SANDBOX mode, the current EUR price is still calculated, but the prepaid balance is **not deducted** and no real top-up is sent.

If your LIVE balance is insufficient, the API returns HTTP `402`.

Example:

```javascript
{
  error: "Insufficient balance",
  balance_eur: 8.07,
  required_eur: 16.01
}
```

Add additional AFGTopup partner balance before retrying.

---

# Transaction Limit

The current maximum transaction value is:

```text
€50 EUR
```

The API checks the final EUR partner price before accepting the transaction.

---

# Rate Limit

The current default API limit is:

```text
300 requests per minute per API key
```

If the limit is exceeded, the API returns HTTP `429`.

Your application should use retry/backoff when receiving a `429` response.

---

# Error Handling

| HTTP Status | Meaning | Recommended Action |
|-------------|---------|-------------------|
| `400` | Invalid request | Check request fields and formats |
| `401` | Invalid/missing API key | Check `AFGTOPUP_API_KEY` |
| `402` | Insufficient balance | Add prepaid partner balance |
| `403` | Account inactive/suspended | Contact AFGTopup |
| `409` | Same order already processing or held | Do not create a new external ID |
| `422` | Operator detection failed / validation issue | Allow manual operator selection |
| `429` | Rate limit reached | Retry with backoff |
| `503` | Temporary/uncertain processing condition | Follow returned API instructions |

---

# Handling 401

Check that your `.env` contains:

```env
AFGTOPUP_API_KEY=your_private_api_key
```

and that your server has loaded the environment variable.

---

# Handling 402

Your account does not have enough prepaid balance.

Do not repeatedly retry until sufficient balance has been added.

---

# Handling 409

A `409` may indicate that the same `external_id` is already being processed or protected for reconciliation.

Do not generate another external ID for the same order.

Keep the original:

```text
external_id
```

and follow the response returned by the API.

---

# Handling 422

If operator auto-detection fails:

```javascript
const operators = await getOperators(country);
```

Then allow the customer to select the correct mobile network manually.

---

# Handling 429

Use retry/backoff.

Do not continuously retry requests without delay.

---

# Handling 503

A temporary or uncertain response does not automatically mean you should create another transaction.

Never generate a new `external_id` simply because a request timed out or returned a temporary error.

Keep the same order ID and follow any `action` information returned by the API.

---

# Complete Example

```javascript
const {
  detectOperator,
  getPrice,
  sendTopup
} = require('./afgtopup-client');

async function createTopup() {

  const phone = '+93700123456';
  const country = 'AF';
  const amount = 100;

  // 1. Detect operator
  const detected = await detectOperator(phone, country);

  // 2. Get live price
  const pricing = await getPrice(
    country,
    detected.operator_id,
    amount
  );

  console.log('AFGTopup cost:', pricing.eur_cost);

  // 3. Complete your own order/payment logic here

  // 4. Create and STORE this ID with your order
  const externalId = 'order_100001';

  // 5. Send top-up
  const result = await sendTopup({
    phone,
    amount,
    country,
    operatorId: detected.operator_id,
    externalId
  });

  console.log('Environment:', result.environment);
  console.log('Sandbox:', result.sandbox === true);
  console.log('Transaction:', result.transaction_id);
  console.log('Status:', result.status);
  console.log('EUR charged:', result.eur_charged);
  console.log('Balance after:', result.balance_after);
}

createTopup();
```

---

# Security

Your API key must remain private.

Use it only from your backend server.

Never put your real API key in:

```text
Frontend JavaScript
Browser code
Mobile application code
Public GitHub repositories
Screenshots
Public logs
```

Store it in a server-side environment variable:

```javascript
const API_KEY = process.env.AFGTOPUP_API_KEY;
```

Never hardcode a real key such as:

```javascript
const API_KEY = 'your_private_api_key_here';
```

---

# Git Security

Your `.gitignore` should contain:

```gitignore
.env
node_modules/
```

Never commit your actual `.env` file.

If your API key is ever exposed publicly, contact AFGTopup and rotate the key.

---

# Recommended Order Records

For each top-up, store at least:

```text
Your external_id
AFGTopup transaction_id
Recipient phone number
Country
Operator ID
Local top-up amount
EUR charged
Status
Date/time
```

This makes support, retries, and reconciliation easier.

---

# Important Production Rules

1. Keep the API key backend-only.
2. Integrate and test in SANDBOX before requesting LIVE access.
3. Replace the sandbox/test credential with the fresh credential provided by AFGTopup before LIVE use.
4. Confirm the Partner Portal shows `LIVE` before intentionally sending a real top-up.
5. Always call the price endpoint before sending.
6. Use a unique `external_id` for every new top-up.
7. Store the external ID before sending the request.
8. Retry the same order using the same external ID.
9. Store the returned AFGTopup `transaction_id`.
10. Never assume a timeout means the transaction was not accepted.
11. Do not hardcode prices.
12. Handle insufficient balance and rate-limit errors.
13. Keep your prepaid balance funded for LIVE usage.

---

# Initial Transaction Status

In **LIVE** mode, a successful accepted top-up normally returns:

```text
status: processing
```

The request has been accepted and queued for processing.

In **SANDBOX** mode, a successful simulation returns:

```text
status: success
sandbox: true
simulated: true
```

This sandbox status confirms that the simulated API flow succeeded. It does **not** mean real mobile credit was sent.

Do not promise an exact delivery time based only on the initial LIVE API response.

---

# Account & Support

Contact AFGTopup for:

- Prepaid balance top-ups
- API account questions
- API key rotation
- Sandbox / Live environment activation and credential rotation
- Technical integration assistance
- Transaction investigation
- Higher limits when approved

Email:

```text
support@afgtopup.com
```

---

# Final Integration Checklist

Before production use:

- [ ] API key stored only on backend
- [ ] `.env` excluded from Git
- [ ] Partner Portal environment checked
- [ ] `getOperators()` tested
- [ ] `detectOperator()` tested
- [ ] `getPrice()` tested
- [ ] Sandbox top-up tested and response confirms `sandbox: true`
- [ ] Fresh LIVE API credential received privately from AFGTopup
- [ ] Backend environment variable updated with the fresh LIVE credential
- [ ] Previous sandbox/test credential removed where no longer needed
- [ ] AFGTopup has enabled LIVE access
- [ ] Partner Portal shows the green `LIVE` badge
- [ ] One small controlled real top-up tested
- [ ] Unique `external_id` stored for every new order
- [ ] Safe same-ID retry logic implemented
- [ ] AFGTopup `transaction_id` stored
- [ ] HTTP 401 handled
- [ ] HTTP 402 handled
- [ ] HTTP 409 handled
- [ ] HTTP 422 handled
- [ ] HTTP 429 handled
- [ ] HTTP 503 handled
- [ ] API key never exposed publicly

---

© 2026 AFGTopup

AFGTopup Partner API access is subject to your partner account terms.
