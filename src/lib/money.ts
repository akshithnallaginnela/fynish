export const rupees = (paise: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(paise / 100);
