import { PaytmChecksum } from "../src/adapters/payments/paytm-checksum";

async function main() {
  const mid = process.env.PAYTM_MID;
  const key = process.env.PAYTM_MERCHANT_KEY;
  const website = process.env.PAYTM_WEBSITE || "WEBSTAGING";

  if (!mid || !key) {
    console.error("Missing PAYTM_MID or PAYTM_MERCHANT_KEY in environment");
    process.exit(1);
  }

  const orderId = `ORDER_FYNISH_${Date.now()}`;
  const amount = "1.00";
  const custId = "CUST_RAVI_01";
  const callbackUrl = `https://securestage.paytmpayments.com/theia/paytmCallback?ORDER_ID=${orderId}`;

  console.log("=== Testing Paytm Checksum Generation ===");
  const testString = "Test message for checksum";
  const signature = await PaytmChecksum.generateSignature(testString, key);
  console.log("Generated Signature:", signature);

  const isValid = PaytmChecksum.verifySignature(testString, key, signature);
  console.log("Checksum self-verification:", isValid ? "PASSED (Valid)" : "FAILED");

  if (!isValid) {
    throw new Error("Checksum verification failed!");
  }

  console.log("\n=== Testing Paytm Payments Staging Initiate Transaction API ===");
  console.log("MID:", mid);
  console.log("Order ID:", orderId);
  console.log("Amount: ₹", amount);

  const body = {
    requestType: "Payment",
    mid,
    websiteName: website,
    orderId,
    callbackUrl,
    txnAmount: {
      value: amount,
      currency: "INR",
    },
    userInfo: {
      custId,
    },
  };

  const bodySignature = await PaytmChecksum.generateSignature(JSON.stringify(body), key);

  const payload = {
    head: {
      signature: bodySignature,
    },
    body,
  };

  const endpoint = `https://securestage.paytmpayments.com/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("\n=== Paytm Staging Response ===");
    console.log(JSON.stringify(data, null, 2));

    if (data.body?.resultInfo?.resultStatus === "S") {
      console.log("\nSUCCESS! Transaction Token generated:", data.body.txnToken);
    } else {
      console.log("\nResult Status:", data.body?.resultInfo?.resultStatus);
      console.log("Result Message:", data.body?.resultInfo?.resultMsg);
    }

    console.log("\n=== Testing Paytm Order Status API ===");
    const statusBody = {
      mid,
      orderId,
    };
    const statusSignature = await PaytmChecksum.generateSignature(JSON.stringify(statusBody), key);
    const statusRes = await fetch(`https://securestage.paytmpayments.com/v3/order/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        head: {
          version: "v1",
          channelId: "WEB",
          signature: statusSignature,
        },
        body: statusBody,
      }),
    });
    const statusData = await statusRes.json();
    console.log("Status API Response:", JSON.stringify(statusData, null, 2));
  } catch (err: unknown) {
    console.error("Fetch failed (network required):", err instanceof Error ? err.message : err);
  }
}

main().catch(console.error);
