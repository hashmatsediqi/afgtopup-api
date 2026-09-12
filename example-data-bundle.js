// =============================================================================
// AFGTopup — Data Bundle API Integration Example
// =============================================================================
//
// Data bundles currently support Afghanistan numbers.
//
// Flow:
//   1. Customer enters phone number
//   2. Fetch available bundles (operator is detected automatically)
//   3. Show bundle names, validity and EUR partner price
//   4. Complete your own order/payment flow
//   5. Create and store one unique external_id
//   6. Send the selected data bundle
//   7. Poll status until final:true
//
// IMPORTANT:
//   - Keep the API key server-side only.
//   - Use a new external_id for every NEW order.
//   - Retry the SAME order using the SAME external_id.
//   - Never create a new external_id just because status is processing.
// =============================================================================

const {
  getDataBundles,
  sendDataBundle,
  checkDataBundleStatus
} = require('./afgtopup-client');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDataBundleExample() {
  // Replace this with a number you are authorized to use for testing.
  const customerPhone = '+93700123456';

  console.log('======================================');
  console.log('      AFGTopup Data Bundle Test');
  console.log('======================================\n');

  // ---------------------------------------------------------------------------
  // STEP 1: Get bundles
  // ---------------------------------------------------------------------------
  const catalogue = await getDataBundles(customerPhone);

  console.log(`Operator: ${catalogue.operator.name}`);
  console.log('Available bundles:');

  catalogue.bundles.forEach(bundle => {
    console.log(
      `  [${bundle.bundle_id}] ${bundle.name} — ${bundle.validity} — €${bundle.eur_cost}`
    );
  });

  if (!catalogue.bundles.length) {
    console.log('No data bundles are currently available for this number.');
    return;
  }

  // DEMO SELECTION ONLY.
  // In your application, let the customer choose one of the returned bundles.
  const selectedBundle = catalogue.bundles.reduce((best, bundle) =>
    Number(bundle.eur_cost) < Number(best.eur_cost) ? bundle : best
  );

  console.log('');
  console.log('Selected bundle:');
  console.log(`  Bundle ID: ${selectedBundle.bundle_id}`);
  console.log(`  Name:      ${selectedBundle.name}`);
  console.log(`  Price:     €${selectedBundle.eur_cost}`);

  // Safety: this example does not submit by default.
  // Set AFGTOPUP_RUN_DATA_EXAMPLE=true only when you intentionally want to
  // submit the selected bundle. Your Partner Portal decides SANDBOX vs LIVE.
  if (process.env.AFGTOPUP_RUN_DATA_EXAMPLE !== 'true') {
    console.log('');
    console.log('Catalogue test completed. No data bundle was submitted.');
    console.log(
      'To intentionally submit the selected bundle, run with AFGTOPUP_RUN_DATA_EXAMPLE=true.'
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Create/store one external ID for this customer order
  // ---------------------------------------------------------------------------
  const externalId = `data_order_${Date.now()}`;

  // ---------------------------------------------------------------------------
  // STEP 3: Submit bundle
  // ---------------------------------------------------------------------------
  const result = await sendDataBundle({
    phone: customerPhone,
    bundleId: selectedBundle.bundle_id,
    externalId,
    email: null
  });

  console.log('');
  console.log('Bundle submission accepted:');
  console.log(`  Transaction ID: ${result.transaction_id}`);
  console.log(`  External ID:    ${result.external_id}`);
  console.log(`  Status:         ${result.status}`);
  console.log(`  EUR charged:    €${result.eur_charged}`);
  console.log(`  Balance after:  €${result.balance_after}`);

  if (result._replayed === true) {
    console.log(
      '  Replay detected: the existing transaction was returned; no duplicate order was created.'
    );
  }

  // SANDBOX data-bundle submissions return a final simulated success directly.
  if (result.sandbox === true || result.final === true) {
    console.log('');
    console.log(`Final result: ${result.status}`);
    return;
  }

  // ---------------------------------------------------------------------------
  // STEP 4: LIVE status polling
  // ---------------------------------------------------------------------------
  // The first status can remain processing for several minutes.
  // Use a background job in production rather than blocking a customer request.
  const maxChecks = 12;
  const waitMs = 30000;

  for (let attempt = 1; attempt <= maxChecks; attempt += 1) {
    if (attempt > 1) {
      await sleep(waitMs);
    }

    const status = await checkDataBundleStatus({
      transactionId: result.transaction_id
    });

    console.log(
      `Status check ${attempt}/${maxChecks}: ${status.status} (final: ${status.final})`
    );

    if (status.final === true) {
      if (status.status === 'success') {
        console.log('✅ Final status: SUCCESS');
      } else if (status.status === 'failed') {
        console.log('❌ Final status: FAILED');
      } else {
        console.log(`Final status: ${status.status}`);
      }
      return;
    }
  }

  console.log(
    'Transaction is still processing. Keep the order pending and check again later.'
  );
}

runDataBundleExample().catch(err => {
  console.error('Data bundle example failed:', err.message);

  if (err.details) {
    console.error('Details:', err.details);
  }

  if (err.status === 409) {
    console.error(
      'Do not create a new external_id for the same order. Retry/check the original order.'
    );
  }

  process.exitCode = 1;
});
