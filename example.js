// =============================================================================
// AFGTopup — Complete Integration Example
// =============================================================================
// This file demonstrates the full top-up flow from start to finish.
// Copy and adapt this into your own order processing logic.
//
// Run this file directly to test your API key:
//   node example.js
// =============================================================================

const {
  getOperators,
  detectOperator,
  getPrice,
  sendTopup
} = require('./afgtopup-client');

// -----------------------------------------------------------------------------
// EXAMPLE: Full top-up flow
// In your real app, these values come from your customer's input + your order ID
// -----------------------------------------------------------------------------
async function runExample() {

  const customerPhone = '+93700123456'; // customer's phone number
  const country       = 'AF';           // two-letter country code
  const topupAmount   = 100;            // amount in local currency (100 AFN)
  const myOrderId     = 'order_' + Date.now(); // your internal order ID

  console.log('=== AFGTopup Integration Test ===\n');

  // ---------------------------------------------------------------------------
  // STEP 1: List available operators for this country
  // Use this to populate a dropdown if the customer wants to select manually
  // ---------------------------------------------------------------------------
  console.log('STEP 1: Fetching operators for', country);
  try {
    const operators = await getOperators(country);
    console.log('✅ Operators available:');
    operators.forEach(op => {
      console.log(`   [${op.operator_id}] ${op.name} (${op.currency_code})`);
    });
  } catch (err) {
    console.error('❌ Failed to get operators:', err.message);
    return;
  }

  console.log('');

  // ---------------------------------------------------------------------------
  // STEP 2: Auto-detect the operator from the phone number
  // This is the preferred method — no need for customer to select manually
  // ---------------------------------------------------------------------------
  console.log('STEP 2: Detecting operator for', customerPhone);
  let operatorId;
  try {
    const detected = await detectOperator(customerPhone, country);
    operatorId = detected.operator_id;
    console.log(`✅ Detected: ${detected.operator_name} (ID: ${operatorId})`);
  } catch (err) {
    if (err.status === 422) {
      // Detection failed — fall back to manual selection
      console.warn('⚠️  Could not auto-detect. Ask customer to select network manually.');
      operatorId = 1; // fallback example — in real code, get this from customer input
    } else {
      console.error('❌ Detection error:', err.message);
      return;
    }
  }

  console.log('');

  // ---------------------------------------------------------------------------
  // STEP 3: Get the EUR price before charging the customer
  // Show this to your customer BEFORE they pay
  // ---------------------------------------------------------------------------
  console.log(`STEP 3: Getting price for ${topupAmount} AFN`);
  let eurCost;
  try {
    const pricing = await getPrice(country, operatorId, topupAmount);
    eurCost = pricing.eur_cost;
    console.log(`✅ Price: ${topupAmount} ${pricing.currency} = €${eurCost} EUR`);
    console.log(`   (Your max per transaction: €${pricing.max_eur})`);

    // In your real app: show this price to customer, collect their payment,
    // then proceed to Step 4 only after payment is confirmed
    console.log('   → In your app: show this price to customer, wait for payment');
  } catch (err) {
    console.error('❌ Pricing error:', err.message);
    return;
  }

  console.log('');

  // ---------------------------------------------------------------------------
  // STEP 4: Send the top-up (only after customer has paid YOU)
  // ---------------------------------------------------------------------------
  console.log('STEP 4: Sending top-up...');
  try {
    const result = await sendTopup({
      phone:      customerPhone,
      amount:     topupAmount,
      country:    country,
      operatorId: operatorId,
      externalId: myOrderId,    // your order ID — prevents duplicate top-ups
      email:      null          // optional: 'customer@email.com' for confirmation
    });

    console.log('✅ Top-up queued successfully!');
    console.log(`   Transaction ID:  ${result.transaction_id}`);
    console.log(`   EUR charged:     €${result.eur_charged}`);
    console.log(`   Balance after:   €${result.balance_after}`);
    console.log(`   Status:          ${result.status}`);
    console.log('   Credit will arrive on the phone within ~60 seconds.');

  } catch (err) {
    // Handle specific error codes
    if (err.status === 402) {
      console.error('❌ Insufficient balance. Top up your AFGTopup account.');
      console.error(`   Balance: €${err.details.balance_eur} | Required: €${err.details.required_eur}`);
    } else if (err.status === 401) {
      console.error('❌ Invalid API key. Check your AFGTOPUP_API_KEY in .env');
    } else if (err.status === 429) {
      console.error('❌ Rate limit hit. Max 60 requests/minute. Slow down.');
    } else {
      console.error('❌ Top-up failed:', err.message, err.details || '');
    }
  }
}

// Run the example
runExample();
