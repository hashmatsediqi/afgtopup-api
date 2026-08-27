// =============================================================================
// AFGTopup — Complete Partner API Integration Example
// =============================================================================
// This file demonstrates the full mobile top-up flow from start to finish.
//
// Flow:
//   1. List operators
//   2. Auto-detect operator
//   3. Get real-time EUR price
//   4. Send top-up
//   5. Check transaction status
//
// Run directly:
//   node example.js
//
// IMPORTANT:
//   - Keep your API key server-side only.
//   - Never expose it in frontend/browser/mobile code.
//   - Use a unique external_id for every NEW top-up.
//   - If retrying the SAME order, reuse the SAME external_id.
// =============================================================================

const {
  getOperators,
  detectOperator,
  getPrice,
  sendTopup,
  checkTransactionStatus
} = require('./afgtopup-client');


// -----------------------------------------------------------------------------
// HELPER: wait before polling status again
// -----------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// -----------------------------------------------------------------------------
// EXAMPLE CONFIG
// In a real application these values come from your customer/order system.
// -----------------------------------------------------------------------------

async function runExample() {

  const customerPhone = '+93700123456';
  const country       = 'AF';
  const topupAmount   = 100;

  // IMPORTANT:
  // Generate this ONCE when your own order is created and store it.
  //
  // Do NOT generate a new external ID every time you retry the same order.
  const myOrderId = `order_${Date.now()}`;

  console.log('======================================');
  console.log('      AFGTopup Integration Test');
  console.log('======================================\n');


  // ===========================================================================
  // STEP 1: List Operators
  // ===========================================================================
  //
  // Use this endpoint when you want to display the available networks
  // for the selected country.
  //
  // ===========================================================================

  console.log(`STEP 1: Fetching operators for ${country}...`);

  let operators;

  try {
    operators = await getOperators(country);

    console.log('✅ Operators available:');

    operators.forEach(op => {
      console.log(
        `   [${op.operator_id}] ${op.name} (${op.currency_code || ''})`
      );
    });

  } catch (err) {
    console.error('❌ Failed to get operators:', err.message);

    if (err.details) {
      console.error('   Details:', err.details);
    }

    return;
  }

  console.log('');


  // ===========================================================================
  // STEP 2: Detect Operator
  // ===========================================================================
  //
  // Recommended:
  // Automatically detect the operator from the customer's phone number.
  //
  // If detection fails with HTTP 422, allow the customer to choose manually.
  //
  // ===========================================================================

  console.log(`STEP 2: Detecting operator for ${customerPhone}...`);

  let operatorId;

  try {

    const detected = await detectOperator(customerPhone, country);

    operatorId = detected.operator_id;

    console.log(
      `✅ Detected: ${detected.operator_name} (ID: ${operatorId})`
    );

  } catch (err) {

    if (err.status === 422) {

      console.warn(
        '⚠️ Could not auto-detect the network.'
      );

      console.warn(
        '   In production, ask the customer to select their operator manually.'
      );

      // DEMO ONLY.
      // Never assume operator ID 1 in production.
      if (operators.length === 0) {
        console.error('❌ No operators available.');
        return;
      }

      operatorId = operators[0].operator_id;

      console.warn(
        `   Demo fallback selected: ${operators[0].name} (ID: ${operatorId})`
      );

    } else {

      console.error('❌ Detection error:', err.message);

      if (err.details) {
        console.error('   Details:', err.details);
      }

      return;
    }
  }

  console.log('');


  // ===========================================================================
  // STEP 3: Get Real-Time Price
  // ===========================================================================
  //
  // Always get the latest price before sending the top-up.
  //
  // eur_cost = the exact amount AFGTopup will deduct from your prepaid
  // partner balance if the top-up is submitted at that price.
  //
  // Pricing is returned in EUR to 2 decimal places.
  //
  // ===========================================================================

  console.log(
    `STEP 3: Getting price for ${topupAmount} local currency units...`
  );

  let eurCost;

  try {

    const pricing = await getPrice(
      country,
      operatorId,
      topupAmount
    );

    eurCost = pricing.eur_cost;

    console.log(
      `✅ AFGTopup cost: ${topupAmount} ${pricing.currency} = €${eurCost}`
    );

    console.log(
      `   Operator: ${pricing.operator_name || operatorId}`
    );

    console.log(
      `   Maximum transaction value: €${pricing.max_eur}`
    );

    console.log(
      '   → In production, complete your own customer/order flow before Step 4.'
    );

  } catch (err) {

    console.error('❌ Pricing error:', err.message);

    if (err.details) {
      console.error('   Details:', err.details);
    }

    return;
  }

  console.log('');


  // ===========================================================================
  // STEP 4: Send Top-Up
  // ===========================================================================
  //
  // Only submit the top-up once your own order is ready.
  //
  // The request returns status "processing".
  // Delivery is handled asynchronously.
  //
  // ===========================================================================

  console.log('STEP 4: Sending top-up...');

  try {

    const result = await sendTopup({
      phone:      customerPhone,
      amount:     topupAmount,
      country,
      operatorId,

      // REQUIRED:
      // Your own unique order/reference ID.
      externalId: myOrderId,

      // Optional customer email
      email: null
    });


    console.log('✅ Top-up accepted successfully!');

    console.log(
      `   Transaction ID: ${result.transaction_id}`
    );

    console.log(
      `   External ID:    ${result.external_id}`
    );

    console.log(
      `   EUR charged:    €${result.eur_charged}`
    );

    console.log(
      `   Balance after:  €${result.balance_after}`
    );

    console.log(
      `   Status:         ${result.status}`
    );


    // If this was a safe replay of a previous completed request
    if (result._replayed === true) {
      console.log(
        '   ℹ️ This was a replay of an existing external_id — no duplicate top-up was created.'
      );
    }


    if (result.balance_warning) {
      console.warn(
        `   ⚠️ ${result.balance_warning}`
      );
    }


    console.log('');

    if (result.sandbox === true) {
      console.log(
        'Sandbox simulation completed. No real mobile credit was sent and no balance was deducted.'
      );
    } else {
      console.log(
        'The LIVE transaction has been accepted and is being processed.'
      );
    }


    // =========================================================================
    // STEP 5: Check Transaction Status
    // =========================================================================
    //
    // SANDBOX:
    //   Check by external_id. A completed simulation should return final:true.
    //
    // LIVE:
    //   Poll by transaction_id until final:true.
    //
    // IMPORTANT:
    //   processing + final:false = keep pending and check again
    //   success    + final:true  = final success
    //   failed     + final:true  = final failure
    //
    // This status check is READ-ONLY. It does not send another top-up.
    // =========================================================================

    console.log('');
    console.log('STEP 5: Checking transaction status...');

    try {

      if (result.sandbox === true) {

        const statusResult = await checkTransactionStatus({
          externalId: result.external_id || myOrderId
        });

        console.log(
          `✅ Sandbox status: ${statusResult.status} (final: ${statusResult.final})`
        );

        console.log(
          `   Real top-up sent: ${statusResult.real_topup_sent === true}`
        );

        console.log(
          `   Balance deducted: ${statusResult.balance_deducted === true}`
        );

      } else {

        // Demo polling policy:
        // check up to 6 times, waiting 10 seconds between non-final responses.
        // In production, use your own background job/queue and retry/backoff policy.
        const maxChecks = 6;
        const waitMs = 10000;

        let finalStatus = null;

        for (let attempt = 1; attempt <= maxChecks; attempt += 1) {

          if (attempt > 1) {
            await sleep(waitMs);
          }

          const statusResult = await checkTransactionStatus({
            transactionId: result.transaction_id
          });

          console.log(
            `   Status check ${attempt}/${maxChecks}: ${statusResult.status} (final: ${statusResult.final})`
          );

          if (statusResult.final === true) {
            finalStatus = statusResult;
            break;
          }
        }

        if (finalStatus) {

          if (finalStatus.status === 'success') {
            console.log('✅ Final status: SUCCESS');
          } else if (finalStatus.status === 'failed') {
            console.log('❌ Final status: FAILED');
          } else {
            console.log(
              `ℹ️ Final response received: ${finalStatus.status}`
            );
          }

        } else {
          console.log(
            '⏳ Transaction is still processing. Keep it pending and poll again later.'
          );
        }
      }

    } catch (statusErr) {

      console.error('');
      console.error(
        '⚠️ Could not read transaction status:',
        statusErr.message
      );

      if (statusErr.status === 404) {
        console.error(
          '   Verify that the transaction reference belongs to this Partner API account.'
        );
      }

      if (statusErr.status === 429) {
        console.error(
          '   Rate limit reached. Retry the status check with backoff.'
        );
      }

      if (statusErr.status === 503) {
        console.error(
          '   Status is temporarily unavailable. Keep the order pending and retry later.'
        );
      }

      if (statusErr.details) {
        console.error(
          '   Details:',
          statusErr.details
        );
      }

      console.error(
        '   Do not create a new external_id just because a status lookup failed.'
      );
    }


  } catch (err) {

    console.error('');


    // -------------------------------------------------------------------------
    // 401 — API key problem
    // -------------------------------------------------------------------------

    if (err.status === 401) {

      console.error(
        '❌ Invalid API key.'
      );

      console.error(
        '   Check AFGTOPUP_API_KEY in your .env file.'
      );


    // -------------------------------------------------------------------------
    // 402 — Prepaid balance too low
    // -------------------------------------------------------------------------

    } else if (err.status === 402) {

      console.error(
        '❌ Insufficient AFGTopup partner balance.'
      );

      if (err.details) {

        console.error(
          `   Balance:  €${err.details.balance_eur}`
        );

        console.error(
          `   Required: €${err.details.required_eur}`
        );

        if (err.details.action) {
          console.error(
            `   Action: ${err.details.action}`
          );
        }
      }


    // -------------------------------------------------------------------------
    // 409 — Same external_id is already being processed / reconciliation
    // -------------------------------------------------------------------------

    } else if (err.status === 409) {

      console.error(
        '⚠️ This external_id is already being processed or held for review.'
      );

      console.error(
        '   Do NOT create a new external_id for the same customer order.'
      );

      if (err.details?.action) {
        console.error(
          `   Action: ${err.details.action}`
        );
      }

      if (err.details?.transaction_id) {
        console.error(
          `   Transaction ID: ${err.details.transaction_id}`
        );
      }


    // -------------------------------------------------------------------------
    // 429 — Rate limit
    // -------------------------------------------------------------------------

    } else if (err.status === 429) {

      console.error(
        '❌ Rate limit reached. Maximum 300 API requests per minute per API key.'
      );

      console.error(
        '   Retry with backoff.'
      );

      if (err.details?.retry_after_seconds) {
        console.error(
          `   Retry after: ${err.details.retry_after_seconds} seconds`
        );
      }


    // -------------------------------------------------------------------------
    // 503 — Temporary / uncertain server condition
    // -------------------------------------------------------------------------

    } else if (err.status === 503) {

      console.error(
        '⚠️ AFGTopup temporarily could not complete the request.'
      );

      if (err.details?.action) {
        console.error(
          `   Action: ${err.details.action}`
        );
      }

      if (err.details?.transaction_id) {
        console.error(
          `   Transaction ID: ${err.details.transaction_id}`
        );
      }

      console.error(
        '   IMPORTANT: Follow the API action message. Never create a new external_id just because a request failed or timed out.'
      );


    // -------------------------------------------------------------------------
    // Other error
    // -------------------------------------------------------------------------

    } else {

      console.error(
        '❌ Top-up request failed:',
        err.message
      );

      if (err.details) {
        console.error(
          '   Details:',
          err.details
        );
      }
    }
  }
}


// =============================================================================
// RUN EXAMPLE
// =============================================================================

runExample().catch(err => {
  console.error('Unexpected error:', err);
  process.exitCode = 1;
});
