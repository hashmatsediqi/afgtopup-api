// =============================================================================
// AFGTopup API Client
// =============================================================================
// This file handles all communication with the AFGTopup top-up API.
// It covers all 4 endpoints: operators, detect, price, and send top-up.
//
// SETUP:
//   1. npm install node-fetch dotenv
//   2. Copy .env.example to .env and fill in your API key
//   3. Import this client into your own code (see example.js)
//
// REQUIREMENTS:
//   - Node.js v18+ (has built-in fetch) OR install node-fetch for older versions
//   - Your AFGTopup API key (provided by your account manager)
// =============================================================================

require('dotenv').config();

// -----------------------------------------------------------------------------
// CONFIG
// Change BASE_URL if you are given a custom endpoint by your account manager.
// -----------------------------------------------------------------------------
const BASE_URL = 'https://afgtopup.com/.netlify/functions';
const API_KEY  = process.env.AFGTOPUP_API_KEY;

if (!API_KEY) {
  throw new Error(
    '[AFGTopup] Missing AFGTOPUP_API_KEY environment variable. ' +
    'Copy .env.example to .env and add your key.'
  );
}

// -----------------------------------------------------------------------------
// HELPER: makes authenticated GET requests to the API
// -----------------------------------------------------------------------------
async function apiGet(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);

  // Append query parameters to the URL
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY   // ← your secret key goes here, never hardcode it
    }
  });

  const data = await response.json();

  // If the API returned an error, throw it so the caller can handle it
  if (!response.ok) {
    const error = new Error(data.error || 'API request failed');
    error.status  = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

// -----------------------------------------------------------------------------
// HELPER: makes authenticated POST requests to the API
// -----------------------------------------------------------------------------
async function apiPost(endpoint, body = {}) {
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'X-API-Key':    API_KEY,        // ← your secret key
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'API request failed');
    error.status  = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

// =============================================================================
// ENDPOINT 1: List Operators
// =============================================================================
// Returns all supported mobile networks for a given country.
// Call this to show a dropdown of networks to your customer.
//
// @param {string} country - Two-letter country code e.g. "AF", "PK", "NG"
// @returns {Array}  List of operators with operator_id, name, currency_code
//
// Example response:
// [
//   { operator_id: 1, name: "Afghan Wireless", country: "AF", currency_code: "AFN" },
//   { operator_id: 4, name: "Roshan",          country: "AF", currency_code: "AFN" }
// ]
// =============================================================================
async function getOperators(country) {
  return apiGet('partner-operators', { country });
}

// =============================================================================
// ENDPOINT 2: Detect Operator
// =============================================================================
// Automatically detects the mobile network from a phone number.
// Call this after your customer types their phone number — no manual selection needed.
//
// @param {string} phone   - Phone in international format e.g. "+93700600153"
// @param {string} country - Two-letter country code e.g. "AF"
// @returns {Object} Detected operator with operator_id and operator_name
//
// Example response:
// { phone: "+93700600153", operator_id: 1, operator_name: "Afghan Wireless", country: "AF" }
//
// NOTE: If detection fails (422 error), fall back to showing the operator dropdown
//       and let the customer select manually.
// =============================================================================
async function detectOperator(phone, country) {
  return apiGet('partner-detect', { phone, country });
}

// =============================================================================
// ENDPOINT 3: Get Price
// =============================================================================
// Returns the EUR cost for a top-up before sending.
// ALWAYS call this before sending — use it to show the price to your customer
// and to verify the amount is within the €50 limit.
//
// @param {string} country     - Two-letter country code
// @param {number} operatorId  - Operator ID from getOperators() or detectOperator()
// @param {number} amount      - Top-up amount in local currency (e.g. 100 for 100 AFN)
// @returns {Object} Pricing details including eur_cost
//
// Example response:
// { local_amount: 100, currency: "AFN", eur_cost: 2.0623, operator_id: 1, max_eur: 50 }
//
// TIP: eur_cost is what gets deducted from your balance.
//      You can charge your customer more and keep the difference as your margin.
// =============================================================================
async function getPrice(country, operatorId, amount) {
  return apiGet('partner-price', {
    country,
    operator_id: operatorId,
    amount
  });
}

// =============================================================================
// ENDPOINT 4: Send Top-Up
// =============================================================================
// Sends the actual top-up to the recipient. This deducts EUR from your balance
// and queues the delivery. Only call this AFTER your customer has paid you.
//
// @param {Object} options
// @param {string} options.phone        - Recipient phone in international format "+93700600153"
// @param {number} options.amount       - Top-up amount in local currency
// @param {string} options.country      - Two-letter country code
// @param {number} options.operatorId   - Operator ID
// @param {string} options.externalId   - YOUR internal order ID (prevents duplicate top-ups on retry)
// @param {string} [options.email]      - Optional: customer email for delivery confirmation
// @returns {Object} Transaction result with transaction_id and balance_after
//
// Example response:
// {
//   success: true,
//   transaction_id: "pt_a1b2c3d4_e5f6a7b8c9d0e1f2",
//   status: "processing",
//   eur_charged: 2.0623,
//   balance_after: 47.9377
// }
//
// IMPORTANT:
//   - Response is 202 Accepted — delivery is async, credit arrives within ~60 seconds
//   - Always pass externalId (your order ID) to prevent double top-ups on retry
//   - Never call this from the browser — server-side only
// =============================================================================
async function sendTopup({ phone, amount, country, operatorId, externalId, email }) {

  // Validate required fields before even hitting the API
  if (!phone)      throw new Error('phone is required');
  if (!amount)     throw new Error('amount is required');
  if (!country)    throw new Error('country is required');
  if (!operatorId) throw new Error('operatorId is required');
  if (!externalId) throw new Error('externalId is required — use your internal order ID');

  return apiPost('partner-topup', {
    phone,
    amount,
    country,
    operator_id:    operatorId,
    external_id:    externalId,   // your order ID — prevents duplicate top-ups
    customer_email: email || null // optional — sends delivery confirmation to customer
  });
}

// Export all functions for use in your own code
module.exports = {
  getOperators,
  detectOperator,
  getPrice,
  sendTopup
};
