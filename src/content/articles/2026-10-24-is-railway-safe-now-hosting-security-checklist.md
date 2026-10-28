---
title: "Is Railway Safe Now? What the October 2026 Breach Means, Plus a Hosting Security Checklist"
date: 2026-10-24
description: "Is Railway safe after the October 2026 breach? What Railway confirmed, what’s still unknown, and a 12-step security checklist for any host."
summary: "Is Railway safe after the October 2026 breach? What Railway confirmed, what’s still unknown, and a 12-step security checklist for any host."
tags: ["railway", "security", "hosting", "devops", "data-breach"]
canonical: https://medium.com/@raghavji2050/is-railway-safe-now-what-the-october-2026-breach-means-plus-a-hosting-security-checklist-94b471b56e10
---

*What Railway’s preliminary incident report confirms, what it doesn’t, and the security habits that protect you on Railway or any other host.*

*This story was written with the assistance of an AI writing program. Facts, times and commands were checked against Railway’s official status page, blog and docs.*

*Last updated: 10:15 AM IST, 24 Oct 2026. Facts checked against Railway’s report and status page at 10:10 AM IST on 24 Oct 2026.*

**Quick answer:** Railway is running normally again, and on 23 Oct 2026 it published a Preliminary Incident Report. The report says attackers spent about a day and a half inside internal systems (7:28 PM IST on 20 Oct to 9:02 AM IST on 22 Oct), were hunting for AI provider API keys, and decrypted environment variables for at most 1.85% of workspaces (about 100,000). Railway says user accounts weren’t accessed and running apps stayed online, and it has rolled all keys, moved builds to single-tenant environments and rebuilt its internal tooling. Railway’s own answer to “is it safe now?” is yes. Railway marked the incident resolved at 3:36 AM IST on 24 Oct, but its forensic investigation is ongoing, and Railway hasn’t ruled out access to source code. Whatever you decide, rotate the secrets you stored in Railway before 21 Oct, because that part is up to you.

**TL;DR**

* **Confirmed:** an attacker decrypted a subset of customers’ environment variables after getting into Railway’s build and CI systems (Railway’s preliminary report).
* **Railway’s advice:** everyone who signed up before 21 Oct should rotate the keys stored on Railway, remove public network access to databases, and check GitHub and container registry audit logs.
* **Status:** builds and deployments are back for every plan, the report is out, and Railway marked the incident resolved at 3:36 AM IST on 24 Oct. The investigation continues, and new signups were still paused in that final update.
* **Your job:** rotate secrets, revoke the old keys at each provider, create new Railway tokens, reconnect GitHub, check provider bills and logs, and keep off-platform backups.

## What happened at Railway in October 2026?

On 21 Oct 2026, Railway published a [security disclosure](https://blog.railway.com/p/security-disclosure-wednesday-october-21st). Its key points, in Railway’s words:

* Railway “detected anomalous activity involving systems that store customer environment variables.”
* “An unauthorized third party may have accessed encrypted environment variables and, for some of them, obtained the decrypted contents.”
* Railway believes this “is part of a series of attacks recently targeting platform companies with the aim of compromising AI inference providers,” and it notified those providers to revoke keys.

New builds and deployments were paused during the investigation, while apps that were already running stayed online. Builds came back in stages: Enterprise at 9:02 AM IST on 22 Oct, Pro at 11:59 AM, Hobby at 2:38 AM on 23 Oct, and Free and Trial at 4:19 AM ([status page](https://status.railway.com/incident/QH8L8B3E)). The full timeline is in [my outage article](https://medium.com/@raghavji2050/is-railway-down-what-the-21-22-october-2026-railway-outage-means-for-developers-1571c57e7953).

## What Railway has done since

From Railway’s status page, blog and preliminary report:

* **Invalidated all API tokens and Project Tokens** created before the incident, and revoked CLI sessions. Old tokens stay invalid even though the API was fully restored at 10:30 PM IST on 22 Oct.
* **Reset storage-bucket credentials and the GitHub tokens it held,** rolled all GitHub App installations for Railway, and published a guide to [redeploy buckets and reconnect GitHub](https://blog.railway.com/p/security-disclosure-recommendation-redeploy-buckets-and-reconnect-github-after-the-credential-reset).
* **Published 14 security guides** on its [engineering blog](https://blog.railway.com/engineering): database credential rotation (PostgreSQL, MySQL, MongoDB, Redis), checks for unusual AWS, GCP and GitHub access, checks for unexpected usage of Stripe, OpenAI, Anthropic, Grok and OpenRouter, the bucket and GitHub guide, and a newer guide to [recover failing deploys](https://blog.railway.com/p/security-disclosure-recommendation-recover-failing-deploys).
* **Paused new signups** at 12:36 AM IST on 23 Oct to focus on existing customers. Its final status update (3:36 AM IST, 24 Oct), which marked the incident resolved, said they were still paused.
* **Emailed customers in risk groups,** starting at 7:30 AM IST on 23 Oct with those it saw as most likely affected, and then the remaining at-risk groups.

## What the incident report says

* **Published:** Railway linked its [Preliminary Report: Oct 21st Security Incident](https://blog.railway.com/p/preliminary-report-october-security-incident) from the status page at 10:08 PM IST on 23 Oct 2026 (16:38 UTC). The blog post is dated 22 Oct, and its facts are “as of October 22nd”. Railway says “our forensic investigation is still ongoing” and that a follow-up will come when it ends.
* **How it happened:** Railway describes “a sustained and targeted campaign” that “was attempting to obtain AI provider API keys to perform distillation attacks”. The attackers found a privilege escalation in Railway’s build infrastructure, got credentials for its CI environment, and decrypted artifacts that held more API access. Railway then found “an unauthorized query of encrypted environment variables, of which a subset were decrypted”. The attack ran from 7:28 PM IST on 20 Oct (13:58 UTC) to 9:02 AM IST on 22 Oct (03:32 UTC, 22 Oct), when Railway confirmed the attacker no longer had access. Railway says it can’t share “the specific details and scale of the exploits” yet.
* **Scope:** “at most 1.85% of all workspaces had some environment variables potentially compromised”, which Railway says is about 100,000 workspaces. Railway says the attacker “did not access Railway user accounts”. It isn’t ruling out access to source code until its final report. Running services stayed online throughout. Railway sent keys to providers such as GitHub, GitLab, Anthropic, OpenAI, OpenRouter and Stripe from 2:55 PM IST on 21 Oct (09:25 UTC), in some cases every key stored on the platform, so a revocation email from a provider doesn’t by itself mean your key was exposed.
* **What Railway changed:** it rolled all keys and then rolled them again once the attacker was out, rolled credentials for every storage bucket, and moved its build system from isolated multi-tenant to single-tenant environments. It also rebuilt all its internal tooling from validated source, hired an outside forensics firm, and added a way to mass-revoke Railway app permissions when it sees suspicious activity. Railway says it made other fixes that it won’t disclose yet.
* **What Railway asks you to do:** if you signed up before 21 Oct, rotate the keys stored on Railway. Railway also advises all customers to remove public network access to databases, check GitHub audit logs and review app access, and check registry audit logs such as Docker Hub. If you log in and see no projects, and your GitHub email differs from your Railway email, use “Log in using email”.

## What we still don’t know

* The specific exploit Railway’s build system had. Railway says it will “disclose this responsibly” once the investigation ends.
* Exactly which variables were decrypted. Railway says envelope encryption means its logs can’t show which keys in an affected project were exposed.
* Whether the attacker accessed source code. Railway will confirm in its final forensic report.
* When signups will return. The status page marked the incident resolved at 3:36 AM IST on 24 Oct, but signups were still paused.

**About the “is Railway built on PHP?” question:** people are searching for this, but Railway’s disclosure, preliminary report, status page and guides don’t mention PHP at all. Don’t believe claims that connect the breach to a programming language.

## So, is Railway safe to use now?

An honest answer has three parts:

1. **The platform is operating again.** Builds and deployments are back on every plan, and the API is restored ([status page](https://status.railway.com/incident/QH8L8B3E)). Railway’s report answers “Is Railway safe to use now?” with “Yes” and says it has “redeployed and revalidated all impacted systems”.
2. **The report is preliminary.** It gives a timeline, a scope figure and a list of fixes, but not the exploit details, and the investigation is still running. Read the report and decide for yourself, and watch for the final one.
3. **Your own exposure depends on you.** If you haven’t rotated the secrets you stored in Railway, you’re still exposed, whether you stay or move. A leaked OpenAI or Stripe key keeps working until you revoke it at OpenAI or Stripe.

If you decide to leave, [my migration guide](https://medium.com/@raghavji2050/railway-alternatives-in-2026-render-fly-io-aws-or-coolify-a-fair-migration-guide-2c3a2aa5936d) compares the options fairly.

## A 12-step security checklist for any hosting platform

These habits apply to Railway, Render, Fly.io, AWS, Coolify or a plain VPS.

**Right now (if you used Railway before 21 Oct)**

1. **Rotate every secret** stored in Railway’s variables: AI keys, payment keys, database passwords, SMTP, OAuth secrets and registry credentials.
2. **Revoke the old keys at the provider,** not just in Railway. Rotation only works once the old key stops working.
3. **Rotate database passwords the supported way.** Railway’s [PostgreSQL rotation guide](https://blog.railway.com/p/security-disclosure-recommendation-rotate-postgresql-database-credentials) says to use Regenerate in the Database tab, not to edit POSTGRES\_PASSWORD or run ALTER USER by hand, and then to redeploy every service that uses the database.
4. **Redeploy after changing variables.** Railway’s guide notes that containers read variables only at startup. Commits you pushed while deploys were paused weren’t queued, so use Deploy Latest Commit to catch up ([recover failing deploys guide](https://blog.railway.com/p/security-disclosure-recommendation-recover-failing-deploys)).
5. **Create new Railway tokens and log in again** with the smallest scope that works. Old tokens and CLI sessions were revoked, so run railway logout and then railway login on your machine. [Here’s how to fix tokens](https://medium.com/@raghavji2050/railway-api-token-not-working-a3b84eeb30c9).
6. **Check provider usage and bills,** including OpenAI, Anthropic, OpenRouter, Stripe and your cloud accounts, for activity you don’t recognise. Railway has a guide for each.
7. **Review GitHub access.** Railway’s [GitHub guide](https://blog.railway.com/p/security-disclosure-recommendation-check-for-anomalous-github-access) points to your security log, authorized OAuth and GitHub Apps, SSH keys, personal access tokens, and repository deploy keys and webhooks. Export the logs before you revoke anything, so the evidence survives. Then reconnect GitHub to Railway, since Railway reset the tokens it held.

**Habits for the long run (any host)**

8. **One key per environment and per service,** so a leak in staging doesn’t expose production.

9. **Set spending limits or alerts** at AI and payment providers where they offer them, so a stolen key can’t quietly run up a bill.

10. **Keep databases private** unless something outside actually needs access. Railway’s report advises removing public network access, and its guide warns that with Public Access on, a database credential is usable from anywhere on the internet until you rotate it.

11. **Keep off-platform backups and test a restore.** [Here’s how for Railway](https://medium.com/@raghavji2050/how-to-export-or-back-up-your-railway-database-postgres-mysql-mongodb-redis-before-you-migrate-e84ab2a5f5d3).

12. **Write a one-page incident plan:** where every secret lives, how to rotate each one, and who does it. When the next incident hits, at any host, you’ll know what to do.

*If you use an AI coding assistant, I put together a free “security audit” prompt on PromptPilot that asks it to check one feature for leaked secrets, injection bugs and missing auth checks, and to point to the exact lines:* [*https://promptpilot-ai-psi.vercel.app/p/security-audit*](https://promptpilot-ai-psi.vercel.app/p/security-audit)*. It’s a starting point for a review, not a replacement for one.*

## FAQ

**Is Railway safe to use after the breach?**

Railway says yes: its preliminary report says it has redeployed and revalidated all impacted systems, and builds and deployments are back on every plan. The investigation is still ongoing, so read the final report when it comes out, and rotate your own secrets either way.

**Was my Railway account affected?**

Railway says the attacker didn’t log in to user accounts, but decrypted environment variables for at most 1.85% of workspaces. It has emailed customers in its risk groups, and it still recommends that everyone who signed up before 21 Oct rotate their keys, so don’t wait for an email.

**Is Railway reliable?**

Railway had two major platform-wide incidents in 2026: the 19–20 May outage after Google Cloud suspended its account (covered in my outage article) and this October security incident, with a multi-day build pause. Its status page also lists smaller build and deploy incidents. Check status.railway.com history and weigh it against your app’s needs.

**Is Railway legit?**

Yes. Railway is a real cloud hosting company with public docs, a status page, a security disclosure and a preliminary incident report for this incident. The October incident was a security breach at a real provider, not a scam.

**Did Railway get hacked through PHP?**

Railway hasn’t said that. Its disclosure, report and guides don’t mention PHP. The report describes a privilege escalation in its build infrastructure.

**Should I move off Railway?**

Only if the move solves a real problem for you. Moving doesn’t remove the need to rotate secrets, and every host has incidents. See my fair comparison and migration guide.

**Where is Railway’s incident report?**

The preliminary report is on Railway’s blog: [Preliminary Report: Oct 21st Security Incident](https://blog.railway.com/p/preliminary-report-october-security-incident). Railway says it will publish a follow-up when its investigation ends.

## Related reading

* [Is Railway down? What the 21–22 October 2026 Railway outage means for developers](https://medium.com/@raghavji2050/is-railway-down-what-the-21-22-october-2026-railway-outage-means-for-developers-1571c57e7953)
* [Railway API token not working? How to fix “Not Authorized” and “Project Token not found”](https://medium.com/@raghavji2050/railway-api-token-not-working-a3b84eeb30c9)
* [How to export or back up your Railway database](https://medium.com/@raghavji2050/how-to-export-or-back-up-your-railway-database-postgres-mysql-mongodb-redis-before-you-migrate-e84ab2a5f5d3)
* [Railway alternatives in 2026: a fair migration guide](https://medium.com/@raghavji2050/railway-alternatives-in-2026-render-fly-io-aws-or-coolify-a-fair-migration-guide-2c3a2aa5936d)

Sources (checked 24 Oct 2026, 10:10 AM IST): [Railway preliminary report](https://blog.railway.com/p/preliminary-report-october-security-incident), [Railway security disclosure](https://blog.railway.com/p/security-disclosure-wednesday-october-21st), [Railway status page](https://status.railway.com/incident/QH8L8B3E), [Railway engineering blog guides](https://blog.railway.com/engineering), [PostgreSQL rotation guide](https://blog.railway.com/p/security-disclosure-recommendation-rotate-postgresql-database-credentials), [GitHub access guide](https://blog.railway.com/p/security-disclosure-recommendation-check-for-anomalous-github-access), [Buckets and GitHub guide](https://blog.railway.com/p/security-disclosure-recommendation-redeploy-buckets-and-reconnect-github-after-the-credential-reset), [Recover failing deploys guide](https://blog.railway.com/p/security-disclosure-recommendation-recover-failing-deploys), [May 2026 incident report](https://blog.railway.com/p/incident-report-may-19-2026-gcp-account-outage).
