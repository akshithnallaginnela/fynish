export type FaqSource = { question: string; terms: string[]; answer: string; url: string; title: string };

// Small, source-linked starter set. Product wording and the connected policy schedule still control a real claim.
export const faqSources: FaqSource[] = [
  {
    question: "Cashless vs reimbursement",
    terms: ["cashless", "network hospital", "non-network", "reimbursement", "pay first"],
    answer: "Cashless settlement is generally requested at an insurer's network hospital and needs insurer authorisation. At a non-network hospital, a customer may need to pay first and submit a reimbursement claim. Availability and payable expenses depend on the specific policy and approval.",
    title: "HDFC ERGO health insurance FAQs",
    url: "https://www.hdfcergo.com/faqs/health-insurance-policy-faqs",
  },
  {
    question: "Waiting periods and pre-existing conditions",
    terms: ["waiting period", "pre-existing", "pre existing", "ped", "diabetes", "coverage start"],
    answer: "A waiting period can limit claims for specified conditions or benefits for a period stated in the policy. The duration and conditions vary by product; check the policy schedule and wording before relying on an answer.",
    title: "HDFC ERGO health insurance FAQs",
    url: "https://www.hdfcergo.com/faqs/health-insurance-policy-faqs",
  },
  {
    question: "Having more than one policy",
    terms: ["two policies", "multiple policies", "more than one", "another insurance", "second policy", "buy a policy"],
    answer: "A person can have more than one health insurance policy. How claims coordinate, what each plan pays, and whether limits or exclusions apply depend on each policy's terms and the claim circumstances.",
    title: "HDFC ERGO health insurance FAQs",
    url: "https://www.hdfcergo.com/faqs/health-insurance-policy-faqs",
  },
  {
    question: "What the health cover may include",
    terms: ["covered", "coverage", "room rent", "icu", "pre hospital", "post hospital", "hospital expenses"],
    answer: "Health plans may cover eligible hospitalisation expenses such as room, nursing, treatment, medicines, or diagnostics, subject to the selected plan, limits, waiting periods, exclusions, and any co-payment. The policy wording and schedule decide the exact cover.",
    title: "HDFC ERGO health insurance policy FAQs",
    url: "https://www.hdfcergo.com/faqs/health-insurance-policy-faqs",
  },
  {
    question: "Filing a reimbursement claim",
    terms: ["documents", "file a claim", "reimbursement claim", "bill", "receipt", "claim process"],
    answer: "Keep itemised hospital bills, payment receipts, discharge papers, prescriptions, reports, and claim forms. The insurer can ask for additional documents, and submission deadlines differ by policy. Follow the timeline in your policy or contact the insurer.",
    title: "HDFC ERGO health claim process",
    url: "https://www.hdfcergo.com/claim/register-health-insurance-claim/cashless-claims",
  },
];

const words = (text: string) => new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

export function findFaqContext(question: string) {
  const query = words(question);
  const ranked = faqSources
    .map((faq) => ({ faq, score: faq.terms.reduce((score, term) => {
      const termWords = [...words(term)];
      return score + (question.toLocaleLowerCase().includes(term.toLocaleLowerCase()) ? 3 : termWords.some((word) => query.has(word)) ? 2 : 0);
    }, 0) + [...words(faq.question)].filter((word) => query.has(word)).length }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ faq }) => faq);
  // Romanized Telugu/Hindi may not contain searchable English terms; the model can select from the small FAQ set.
  return ranked.length ? ranked : faqSources;
}
