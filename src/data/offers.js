// Live PHP Hub offers. URLs and prices were copied from written product notes;
// nothing here was invented. Sources:
// - /workspace/ai-products/promo/REACH-REQUESTS.md (lines 266–269)
// - /workspace/ai-products/promo/SELL-LIVE-COPY-2026-11-13.md
// - /workspace/ai-products/STATUS.md (Career Call 2405650; Audit 2405744)
// Checked 15 Nov 2026: Gumroad URLs returned 200; Topmate URLs returned 403
// (Cloudflare), which is expected for curl.
const UTM = 'utm_source=php-hub&utm_medium=cta&utm_campaign=live-offers';
const topmate = (id) => `https://topmate.io/raghavji/${id}?${UTM}`;
const gumroad = (slug) => `https://raghavji.gumroad.com/l/${slug}?${UTM}`;

export const OFFERS = {
  codeReview: {
    title: 'Code Review ₹299',
    blurb: 'A live 45-minute Laravel review of a focused slice of code you own or are authorized to share (a PR, a GitHub link, or about 500 lines). Intro price for the first 5 bookings; then ₹699. This is not a review of a whole large codebase.',
    href: topmate('2387784'),
    cta: 'Book on Topmate',
  },
  careerCall: {
    title: 'Career Guidance Call Pack ₹999',
    blurb: 'Three 30-minute calls, currently booked Mon–Fri 9–11 PM IST, plus a 90-day plan you keep. Honest advice from PHP and Laravel work — this does not promise a job, a promotion, or a salary outcome.',
    href: topmate('2405650'),
    cta: 'Book on Topmate',
  },
  mockInterview: {
    title: 'Mock Interview ₹999',
    blurb: 'A 60-minute Laravel or PHP practice round. When you book, you pick one track: core, machine-coding, or backend design (3+ years). You get written feedback afterwards. This does not promise a job offer.',
    href: topmate('2362558'),
    cta: 'Book on Topmate',
  },
  audit: {
    title: 'Laravel Security Audit ₹2,999',
    blurb: 'A 45-minute video walkthrough of common Laravel risks, currently booked Mon–Fri 9–11 PM IST. For an app you own or are authorized to manage.',
    href: topmate('2405744'),
    cta: 'Book on Topmate',
  },
  dev10: {
    title: 'DEV10 — 10% off two interview kits',
    blurb: 'Enter code DEV10 at Gumroad checkout. It applies only to these two kits and has no expiry date. The kits are practice material and do not promise a job or a particular interview result.',
    links: [
      { href: gumroad('laravel-interview-kit-2026'), label: 'Laravel Interview Kit 2026 ($9)' },
      { href: gumroad('backend-system-design-kit-2026'), label: 'System Design Interview Kit 2026 ($29)' },
    ],
  },
};
