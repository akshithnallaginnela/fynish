import { mkdir, writeFile } from "node:fs/promises";

const lines = [
  "SYNTHETIC SAMPLE - NOT A REAL HOSPITAL BILL - NOT FOR REAL CLAIMS",
  "Apollo Hospitals - fictional Fynish demonstration",
  "ITEMISED INPATIENT BILL",
  "Sample patient: Ravi Demo",
  "Sample invoice: DEMO-42000",
  "Admission Date: 2026-11-12",
  "Discharge Date: 2026-11-13",
  "Room Type: Single Standard AC",
  "Room Rent Per Day: INR 4000",
  "Room rent (2 days): INR 8000",
  "Doctor consultation: INR 10000",
  "Treatment charges: INR 16000",
  "Medicines: INR 4000",
  "Diagnostics: INR 4000",
  "Total Amount: INR 42000",
  "Fictional data, created only for the Fynish demo.",
];
const escapePdf = (value) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const stream = `BT\n/F1 11 Tf\n54 760 Td\n${lines.map((line) => `(${escapePdf(line)}) Tj\n0 -22 Td`).join("\n")}\nET\n`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`;
await mkdir("public/demo", { recursive: true });
await writeFile("public/demo/apollo-sample-bill.pdf", pdf);
