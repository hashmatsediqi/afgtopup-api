// =============================================================================
// AFGTopup API Client
// =============================================================================
// This file handles communication with the AFGTopup Partner Top-Up API.
//
// Endpoints covered:
//   1. List operators
//   2. Detect operator
//   3. Get real-time price
//   4. Send top-up
//   5. Check transaction status
//
// SETUP:
//   1. Use Node.js v18+
//   2. Run: npm install dotenv
//   3. Copy .env.example to .env
//   4. Add your AFGTopup API key to .env
//   5. Import this client into your server-side application
//
// SECURITY:
//   - Keep your API key private.
//   - Never expose the API key in browser/frontend JavaScript.
//   - Never include the API key in a public GitHub repository.
//   - Store the API key as a server environment variable.
// =============================================================================

require('dotenv').config();


// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

const BASE_URL = 'https://afgtopup.com/.netlify/functions';
const API_KEY  = process.env.AFGTOPUP_API_KEY;

if (!API_KEY) {
  throw new Error(
    '[AFGTopup] Missing AFGTOPUP_API_KEY environment variable. ' +
    'Copy .env.example to .env and add your API key.'
  );
}


// -----------------------------------------------------------------------------
// HELPER: authenticated GET request
// -----------------------------------------------------------------------------

async function apiGet(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY
    }
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      error: `Invalid response from AFGTopup API (HTTP ${response.status})`
    };
  }

  if (!response.ok) {
    const error = new Error(data.error || 'AFGTopup API request failed');
    error.status  = response.status;
    error.details = data;
    throw error;
  }

  return data;
}


// -----------------------------------------------------------------------------
// HELPER: authenticated POST request
// -----------------------------------------------------------------------------

async function apiPost(endpoint, body = {}) {
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      error: `Invalid response from AFGTopup API (HTTP ${response.status})`
    };
  }

  if (!response.ok) {
    const error = new Error(data.error || 'AFGTopup API request failed');
    error.status  = response.status;
    error.details = data;
    throw error;
  }

  return data;
}


// =============================================================================
// ENDPOINT 1: List Operators
// =============================================================================
//
// Returns supported mobile networks for a country.
//
// Use this when you want to show the available networks to your customer.
//
// @param {string} country
// Two-letter ISO country code.
//
// Examples:
//   "AF" = Afghanistan
//   "PK" = Pakistan
//   "DZ" = Algeria
//   "MA" = Morocco
//   "NG" = Nigeria
//   "KE" = Kenya
//
// @returns {Array}
//
// Example response:
//
// [
//   {
//     operator_id: 1,
//     name: "Afghan Wireless Afghanistan",
//     country: "AF",
//     currency_code: "AFN"
//   },
//   {
//     operator_id: 4,
//     name: "Roshan Afghanistan",
//     country: "AF",
//     currency_code: "AFN"
//   }
// ]
//
// =============================================================================

async function getOperators(country) {
  if (!country) {
    throw new Error('country is required');
  }

  return apiGet('partner-operators', {
    country: country.toUpperCase()
  });
}


// =============================================================================
// ENDPOINT 2: Detect Operator
// =============================================================================
//
// Automatically detects the recipient's mobile network.
//
// Recommended flow:
//   1. Customer enters phone number
//   2. Call detectOperator()
//   3. Use returned operator_id for getPrice() and sendTopup()
//
// @param {string} phone
// International E.164 phone number.
//
// Example:
//   "+93700600153"
//
// @param {string} country
// Two-letter ISO country code.
//
// @returns {Object}
//
// Example response:
//
// {
//   phone: "+93700600153",
//   operator_id: 1,
//   operator_name: "Afghan Wireless Afghanistan",
//   country: "AF",
//   currency_code: "AFN"
// }
//
// NOTE:
// If auto-detection returns HTTP 422, you can fall back to getOperators()
// and allow the customer to select the network manually.
//
// =============================================================================

async function detectOperator(phone, country) {
  if (!phone) {
    throw new Error('phone is required');
  }

  if (!country) {
    throw new Error('country is required');
  }

  return apiGet('partner-detect', {
    phone,
    country: country.toUpperCase()
  });
}


// =============================================================================
// ENDPOINT 3: Get Price
// =============================================================================
//
// Returns the real-time EUR cost for a top-up.
//
// ALWAYS call this before sendTopup().
//
// The value returned in:
//
//     eur_cost
//
// is the exact EUR price that will be deducted from your prepaid partner
// balance if the top-up is submitted at that price.
//
// Public EUR prices are returned to 2 decimal places.
//
// @param {string} country
// Two-letter ISO country code.
//
// @param {number} operatorId
// Operator ID returned by getOperators() or detectOperator().
//
// @param {number} amount
// Top-up amount in the recipient country's local currency.
//
// Example:
//   amount = 100 means 100 AFN for Afghanistan.
//
// @returns {Object}
//
// Example response:
//
// {
//   local_amount: 100,
//   currency: "AFN",
//   eur_cost: 1.93,
//   operator_id: 1,
//   operator_name: "Afghan Wireless Afghanistan",
//   country: "AF",
//   max_eur: 50
// }
//
// IMPORTANT:
// The example above is illustrative.
// Always use the live eur_cost returned by the API as the final price.
//
// =============================================================================

async function getPrice(country, operatorId, amount) {
  if (!country) {
    throw new Error('country is required');
  }

  if (!operatorId) {
    throw new Error('operatorId is required');
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error('amount must be greater than 0');
  }

  return apiGet('partner-price', {
    country: country.toUpperCase(),
    operator_id: operatorId,
    amount
  });
}


// =============================================================================
// ENDPOINT 4: Send Top-Up
// =============================================================================
//
// Sends the actual top-up.
//
// This endpoint:
//
//   - verifies the API key
//   - recalculates the current partner price
//   - checks the prepaid balance
//   - safely deducts the exact EUR amount
//   - prevents duplicate orders
//   - queues the top-up for processing
//
// Only call sendTopup() AFTER your own customer/order is ready to be processed.
//
// -----------------------------------------------------------------------------
// PARAMETERS
// -----------------------------------------------------------------------------
//
// @param {Object} options
//
// @param {string} options.phone
// Recipient phone number in international E.164 format.
//
// Example:
//   "+93700600153"
//
// @param {number} options.amount
// Amount in local currency.
//
// Example:
//   100 = 100 AFN
//
// @param {string} options.country
// Two-letter ISO country code.
//
// Example:
//   "AF"
//
// @param {number} options.operatorId
// Operator ID from getOperators() or detectOperator().
//
// @param {string} options.externalId
// REQUIRED.
//
// This must be YOUR unique order/reference ID.
//
// Example:
//   "order_100001"
//
// IMPORTANT:
//   - Use a different externalId for every new top-up.
//   - Never reuse an externalId for a different transaction.
//   - If a network request is uncertain, retry using the SAME externalId.
//   - Do NOT generate a new externalId just because a request timed out.
//   - Duplicate protection is retained for 14 days.
//
// @param {string} [options.email]
// Optional customer email.
//
// -----------------------------------------------------------------------------
// EXAMPLE RESPONSE
// -----------------------------------------------------------------------------
//
// {
//   success: true,
//   transaction_id: "pr_159e14b7-8dcf-45ba-b30b-451f2966f581",
//   status: "processing",
//   message: "Top-up queued successfully.",
//   eur_charged: 1.93,
//   balance_after: 48.07,
//   external_id: "order_100001"
// }
//
// NOTE:
// Partner transaction references generated by AFGTopup begin with:
//
//     pr_
//
// -----------------------------------------------------------------------------
// IDEMPOTENCY / SAFE RETRY
// -----------------------------------------------------------------------------
//
// If you retry the SAME completed external_id, the API can return the original
// transaction instead of creating another top-up.
//
// Example replay:
//
// {
//   success: true,
//   transaction_id: "pr_159e14b7-8dcf-45ba-b30b-451f2966f581",
//   status: "processing",
//   eur_charged: 1.93,
//   balance_after: 48.07,
//   external_id: "order_100001",
//   _replayed: true
// }
//
// Never send a second order using the same externalId.
//
// -----------------------------------------------------------------------------
// IMPORTANT
// -----------------------------------------------------------------------------
//
// - Top-up submission returns status "processing" because delivery is asynchronous.
// - Do not expose this function directly to a browser/frontend.
// - Keep the API key server-side.
// - Maximum transaction value is currently €50 after partner pricing.
// - Always obtain the current price before submitting.
//
// =============================================================================

async function sendTopup({
  phone,
  amount,
  country,
  operatorId,
  externalId,
  email
}) {

  // ---------------------------------------------------------------------------
  // Validate required parameters locally before calling the API
  // ---------------------------------------------------------------------------

  if (!phone) {
    throw new Error('phone is required');
  }

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error(
      'phone must be in international E.164 format, e.g. +93700600153'
    );
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error('amount must be greater than 0');
  }

  if (!country) {
    throw new Error('country is required');
  }

  if (!operatorId) {
    throw new Error('operatorId is required');
  }

  if (!externalId || typeof externalId !== 'string') {
    throw new Error(
      'externalId is required — use your unique internal order ID'
    );
  }

  if (externalId.length > 128) {
    throw new Error('externalId must be 128 characters or fewer');
  }


  // ---------------------------------------------------------------------------
  // Submit top-up
  // ---------------------------------------------------------------------------

  return apiPost('partner-topup', {
    phone,
    amount: Number(amount),
    country: country.toUpperCase(),
    operator_id: Number(operatorId),
    external_id: externalId,
    customer_email: email || null
  });
}


// =============================================================================
// ENDPOINT 5: Check Transaction Status
// =============================================================================
//
// Reads the current status of a Partner API top-up.
//
// LIVE:
//   You can query by AFGTopup transaction_id OR by your external_id.
//
// SANDBOX:
//   Query by external_id.
//
// IMPORTANT:
//   - "processing" + final:false means keep the order pending and check again.
//   - "success" + final:true means the transaction is final and successful.
//   - "failed" + final:true means the transaction is final and failed.
//   - This is a READ-ONLY request. It does not send a top-up or deduct balance.
//
// @param {Object} options
// @param {string} [options.transactionId]
// AFGTopup transaction reference returned by sendTopup(), e.g. "pr_...".
//
// @param {string} [options.externalId]
// Your own order/reference ID used when the top-up was submitted.
//
// Example LIVE response:
//
// {
//   success: true,
//   sandbox: false,
//   environment: "live",
//   transaction_id: "pr_example_123",
//   external_id: "order_100001",
//   status: "processing",
//   final: false
// }
//
// Example SANDBOX response:
//
// {
//   success: true,
//   sandbox: true,
//   environment: "sandbox",
//   simulated: true,
//   transaction_id: "pr_sbx_example_123",
//   external_id: "sandbox_order_100001",
//   status: "success",
//   final: true,
//   real_topup_sent: false,
//   balance_deducted: false
// }
//
// =============================================================================

async function checkTransactionStatus({
  transactionId,
  externalId
} = {}) {

  if (!transactionId && !externalId) {
    throw new Error(
      'transactionId or externalId is required'
    );
  }

  if (
    transactionId &&
    !/^pr_[A-Za-z0-9_-]{8,120}$/.test(String(transactionId))
  ) {
    throw new Error('transactionId format is invalid');
  }

  if (
    externalId &&
    (typeof externalId !== 'string' ||
      externalId.length < 1 ||
      externalId.length > 128)
  ) {
    throw new Error('externalId must be 1–128 characters');
  }

  return apiGet('partner-api-status', {
    transaction_id: transactionId || undefined,
    external_id: externalId || undefined
  });
}


// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getOperators,
  detectOperator,
  getPrice,
  sendTopup,
  checkTransactionStatus
};
