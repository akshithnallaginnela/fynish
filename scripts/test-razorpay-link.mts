async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
    process.exit(1);
  }

  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  console.log("=== 1. Fetching Recent Payments from Razorpay ===");
  const paymentsRes = await fetch("https://api.razorpay.com/v1/payments?count=5", {
    headers: { Authorization: authHeader },
  });
  const paymentsData = await paymentsRes.json();
  console.log(`Found ${paymentsData.count || 0} recent payments.`);

  console.log("\n=== 2. Creating a Live Test UPI Payment Link ===");
  const linkPayload = {
    amount: 4200000, // ₹42,000.00
    currency: "INR",
    accept_partial: false,
    description: "Inpatient Hospital Bill - Apollo Hospitals",
    customer: {
      name: "Ravi Kumar",
      email: "ravi.kumar@example.com",
      contact: "+919876543210",
    },
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: false,
    notes: {
      hospital: "Apollo Hospitals Enterprise Ltd",
      mcc: "8062",
      patient: "Ravi Kumar",
      policy: "Star Health Family Optima",
    },
  };

  const linkRes = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(linkPayload),
  });

  const linkData = await linkRes.json();

  if (linkRes.ok && linkData.short_url) {
    console.log("\n SUCCESS! Test Payment Link Created!");
    console.log("--------------------------------------------------");
    console.log("Payment Link ID :", linkData.id);
    console.log("Amount          : ₹", linkData.amount / 100);
    console.log("Description     :", linkData.description);
    console.log("Status          :", linkData.status);
    console.log("CLICKABLE URL   :", linkData.short_url);
    console.log("--------------------------------------------------");
    console.log("\nYou can open this URL in your browser, select UPI, and use 'success@razorpay' to simulate a completed payment!");
  } else {
    console.error("Payment Link creation failed:", linkData);
  }
}

main().catch(console.error);
