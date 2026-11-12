// Gumroad products by Raghav, copied only from the public product pages on
// https://raghavji.gumroad.com (checked 12 Nov 2026). Prices are in US dollars as listed.
// Non-developer products on the same storefront (planners, budget sheets, Diwali packs,
// AI prompt kits, the GST kit for CAs) are left out because PHP Hub is a developer site.
const G = (slug) => `https://raghavji.gumroad.com/l/${slug}`;
export const GUMROAD_PRODUCTS = [
  { name: 'PHP Security Checklist', price: '$9', url: G('tunxu'), topic: 'Security' },
  { name: 'Laravel Production Deployment Toolkit 2026: Docker, VPS, Zero-Downtime CI/CD & Backups', price: '$19', url: G('laravel-deployment-toolkit'), topic: 'Laravel' },
  { name: 'Backend System Design Interview Kit 2026: PHP & Laravel Edition (14 Cases + Tested Labs)', price: '$29', url: G('backend-system-design-kit-2026'), topic: 'Interviews' },
  { name: 'PHP Backend Interview Kit 2026', price: '$15', url: G('php-backend-interview-kit'), topic: 'Interviews' },
  { name: 'Laravel Interview Kit 2026: 120 Q&A + 3 Coding Rounds + HR', price: '$9', url: G('laravel-interview-kit-2026'), topic: 'Interviews' },
  { name: 'India Billing Kit for Laravel: Razorpay + GST Invoices', price: '$19', url: G('india-billing-kit'), topic: 'Laravel' },
  { name: 'Claude Code Skills Pack for Web Devs: 25 SKILL.md skills + 3 CLAUDE.md templates (Laravel, PHP, Next.js)', price: '$12', url: G('claude-code-skills-pack'), topic: 'Tooling' },
  { name: 'Free: 12 PHP Backend Interview Q&As + 1 Machine-Coding Round', price: 'Free (pay what you want)', url: G('free-php-interview-sample'), topic: 'Interviews' },
  { name: 'Free Razorpay Webhook Debug Kit (Node + PHP)', price: 'Free (pay what you want)', url: G('free-razorpay-webhook-debug-kit'), topic: 'Payments' },
  { name: 'Free Claude Code Skills Lite: 3 SKILL.md skills for web devs', price: 'Free (pay what you want)', url: G('free-claude-code-skills-lite'), topic: 'Tooling' },
];
