async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
    process.exit(1);
  }

  console.log("=== Testing Razorpay Order Creation ===");
  console.log("Using Key ID:", keyId);

  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const amountPaise = 4200000; // ₹42,000.00
  const receipt = `rcpt_${Date.now()}`;

  const payload = {
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes: {
      merchant: "Apollo Hospitals Enterprise Ltd",
      category: "HOSPITAL",
      mcc: "8062",
      patient: "Ravi Kumar",
      policy: "Star Health Family Optima",
    },
  };

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("\n=== Razorpay API Response ===");
  console.log(JSON.stringify(data, null, 2));

  if (res.ok && data.id) {
    console.log("\n SUCCESS! Razorpay Order Created Successfully!");
    console.log("Order ID:", data.id);
    console.log("Amount (INR): ₹", data.amount / 100);
    console.log("Status:", data.status);
    console.log("\nYou will now be able to see this order immediately in your Razorpay Dashboard under 'Orders'!");
  } else {
    console.error("\nOrder creation failed:", data.error?.description || data);
  }
}

main().catch(console.error);
