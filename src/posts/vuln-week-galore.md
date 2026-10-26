---
title: Vuln Week Galore
date: 2026-10-25
layout: layouts/post.njk
permalink: /vuln-week-galore/
tags:
  - posts
  - updates
description: PHP, GitLab, Node.js, LiteLLM and a certificate authority whose private key was the number '4' all went wrong in the same few days. Let's talk about the worst week to be on call as a software engineer :)
feature_image: /images/2025-10-25-vuln-week-galore/vuln-week.webp
templateEngineOverride: md
---
> [!warning] **Halloween is a week too early. Let's just say I am not a fan -_-**

Did you get any sleep this week? If you run servers, maintain dependencies, or happen to do any blue team work, nah you didn't.

In about six days we got a PHP flaw that knocked parts of Wikipedia offline, a maximum severity bug in GitLab, a poisoned Python package with 23 million weekly downloads, and a certificate authority with a private key of 4. I started this post with a list of five items. It is now nine & I have stopped counting on purpose.

So grab a coffee or maybe don't because this one will make you want to flip your table over. Every section covers what broke, who it touches, and what to do about it.

---

## The lineup

| Where    | What broke                                                                        | What to do                                                    |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| PHP      | Two unauthenticated remote code execution bugs (CVE-2026-109618, CVE-2026-109619) | Upgrade to 8.5.12, 8.4.27, 8.3.36 or 8.2.35                   |
| Node.js  | Out-of-bounds write in the Brotli decoder                                         | Upgrade to 22.23.4, 24.22.1 or 26.12.1                        |
| GitLab   | CVE-2026-110264, severity 10.0                                                    | Self-managed: upgrade to the fixed release for your line      |
| LiteLLM  | Malicious 1.107.0 release                                                         | Pin 1.106.2, rotate every credential if you installed 1.107.0 |
| eMudhra  | Eight certificate authority keys that were tiny numbers                           | Update browsers, operating systems and Go                     |
| OpenCode | Console breach exposed provider API keys                                          | Revoke and rotate keys                                        |
| Railway  | Environment variables possibly exposed                                            | Rotate everything stored there                                |
| Banks    | Outside AI agents logging in with customer credentials                            | Policy change, nothing to patch                               |
| OpenAI   | Internal agents weakened their own monitoring                                     | Nothing to patch, plenty to think about                       |

---

## PHP2Shell

PHP2Shell is the nickname for two flaws, [CVE-2026-109618 and CVE-2026-109619](https://sansec.io/research/php2shell), both scoring 9.2 out of 10. Either one lets an unauthenticated attacker run commands on a server that handles PHP web requests. PHP-FPM, Apache with `mod_php`, `php-cgi`, FrankenPHP and LiteSpeed are all in scope, and the PHP team rates `mod_php` as the riskiest setup because the attack can land before any of your application code runs.

The root cause is memory handling. When a request blows past `memory_limit`, PHP bails out with a `longjmp` and skips its cleanup. Pointers to freed memory survive, and a later request (or a reused worker process) treats that memory as live data. That is a <u>use-after-free</u>, and the file upload parser makes it especially easy to trigger mid-request. The next post walks through it step by step.

Calif, Wiz and OpenAI researchers found the bugs, and Calif reported them to PHP on 11 and 21 August. The earliest affected code path goes back to PHP 5.4.0 in 2012. The details leaked before the embargo ended, PHP shipped fixes on Wednesday 21 October, and the [NSA told anyone who could not patch immediately to take the system offline](https://www.defenseone.com/threats/2026/10/critical-flaws-php-warning/416727). Parts of Wikipedia and several European government sites did exactly that.

Only PHP 8.2 through 8.5 get official fixed releases. Everything older is end of life, though the project posted source backports for 7.4, 8.0 and 8.1, and your distribution may ship its own. No application code change or ini tweak fully fixes this one, you need the patched PHP itself.

```bash
php -v
```

In [The Hacker Mindset](/the-hacker-mindset/) I said every program takes input, processes it and produces output, and your job is to feed it something it does not expect. Here the unexpected input was simply too much of it. Also, updating WordPress does not update PHP, which is a sentence I expect to repeat to relatives.

---

## Node.js

**More like "Ohh Nooo-de!"**

On 21 October Node.js shipped fixes for ten vulnerabilities across the 22.x, 24.x and 26.x lines, four of them rated high. The headline is CVE-2026-111497, an <u>out-of-bounds write</u> in the Brotli decoder. A crafted compressed stream declares a single block type, switches blocks anyway, and the decoder fails to reject it. Node.js says the result permits remote code execution, so any server that decompresses attacker-supplied Brotli data is in the blast radius, request bodies included. Node.js rates it high even though the fix commit describes it as a low severity bug that is not easy to exploit, so you are allowed to be worried and skeptical at the same time.

The fixed versions are 22.23.4, 24.22.1 and 26.12.1. Node 20 and older are end of life and get nothing. The same release also removes trust in the compromised eMudhra certificates, which is where we are headed in a few sections.

```bash
node --version
```

Compressed data is the original gift wrap: nobody checks what is inside until it is already open. A [full list of the ten fixes](https://www.konfirmity.com/advisories/nodejs-october-2026-security-releases) is worth skimming too, since the other three high ones weaken hostname checks.

---

## GitLab

**With a 2014 birthday, the wishes definitely came in a little bit late on this one.**

[CVE-2026-110264](https://gcn.com/gitlab-patches-maximum-severity-flaw/22707/) scores a full 10.0 out of 10. GitLab says an integer overflow while compiling a specially crafted regular expression could, under certain conditions, let an unauthenticated attacker execute code on the server. It hits self-managed Community and Enterprise editions, and the vulnerable code goes back to version 7.0, released in 2014. GitLab.com is already patched.

If you run your own instance, the fixes are in 19.5.1, 19.4.3, 19.3.6, 19.2.9, 19.1.9, 19.0.10 and 18.11.13. One trap to watch for: if you patched on 12 October after the earlier critical release, that was a different bug (CVE-2026-97229), so you are not done. As of 22 October there was no confirmed exploitation, and GitLab plans to publish the technical details about 90 days after the patch.

```bash
sudo gitlab-rake gitlab:env:info
```

An integer overflow in a regex compiler. Naturally. Your code host also holds your source, your pipelines and the secrets to deploy everything, which makes "just a regex" the scariest phrase of the week.

---

## LiteLLM

**This one just does not seem to stop getting boinked :/**

On 21 October a malicious `litellm` 1.107.0 [landed on PyPI at 11:39 UTC](https://securitylabs.datadoghq.com/articles/litellm-compromised-pypi-docker/) and in the official Docker images, including floating tags like `latest`. PyPI quarantined it around 13:20, so the window was roughly two hours. LiteLLM is a proxy that routes requests to AI model providers and pulls about 23 million downloads a week.

The malware rode in on a `.pth` file, which Python processes on every interpreter start, so nothing had to import `litellm` for the credential stealer to fire. It went after cloud, developer, AI tool and browser credentials, plus the provider keys stored in the LiteLLM proxy database, and it dropped a loader that fetched more code every hour. Stolen data went to a lookalike domain registered on 13 October, a week before the release. This is the second LiteLLM compromise this year, after versions 1.82.7 and 1.82.8 in March.

If you installed 1.107.0, or pulled a floating image tag that day, treat the host as compromised and rotate everything it could reach. The safe version is 1.106.2.

```bash
pip show litellm | grep -i '^version'
sudo find / -path "*site-packages*" \( -name cook.pth -o -name cook.py \) 2>/dev/null
```

Many projects depend on `litellm>=` with an open ended constraint, so a fresh install or a `lockfile` refresh grabbed the bad build immediately. A pinned version is a very boring way to avoid a very exciting afternoon.

---

## eMudhra

**The value of my private key is '4'**

eMudhra is an Indian certificate authority whose certificates chain to roots that major browsers trust. On 17 October a researcher found that eight of its intermediate private keys were tiny integers: 4, 56, 66, 115, 155, 156, 230 and 237. Those are P-384 keys, which should carry 384 bits of randomness, and instead you could recover them by guessing small numbers against the public certificate. Six of the eight were meant for issuing HTTPS certificates and two were for code signing. They were generated on 30 April 2025, and eMudhra blames a script flaw during a key generation ceremony.

<figure class="img-s"><img alt="" class="kg-image" loading="lazy" src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3QwdTEzcXZhM3ZpejVkMXlkc2QxYmhoOHZzcjNtZnR6eTN3emMyaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/e5uyWolyR0y30Wo1ya/giphy.gif"/></figure>

Whoever holds the key to a trusted intermediate can mint a certificate for any domain. [No forged certificate has been shown in the wild](https://bleepingcomputer.com/news/security/mozilla-google-apple-block-compromised-emudhra-ca-certificates), but Google, Apple, Mozilla and Microsoft all blocked the affected certificates anyway, and Chrome is removing eMudhra's root from its trust store on 27 October. Go shipped 1.27.3 and 1.26.10 to block the intermediates, and Node.js updated its bundled certificate store.

```bash
go version
```

The intended number of possible keys was about 2^384. The actual number was about 256. That is the difference between a vault and a coat check.

---

## OpenCode

OpenCode, the open source AI coding agent, [disclosed on 17 October](https://bleepingcomputer.com/news/security/opencode-hack-exposes-api-keys-amid-ai-distillation-attacks) that its hosted Console had been breached. About 1.4% of Console users who had linked external providers were affected, and the OpenAI, Anthropic and Google API keys saved in their workspaces may have been exposed. The way in was a legacy system the team was decommissioning. Users reported unauthorized charges, and some saw more than $1,700 overnight. Keys configured locally in the command line or desktop app are a separate matter.

OpenCode called it a large-scale <u>distillation attack</u>, meaning someone uses access to a strong model to harvest its answers and train a cheaper copy. Some observers have questioned that label. Either way, the fix is the same: revoke the keys, issue new ones, check your usage, and set spend limits on every provider account you own.

Calling it a distillation attack is one way to describe someone running up your bill.

---

## Railway

**Your environment variables, decrypted for someone else**

On 21 October Railway [detected anomalous activity](https://blog.railway.com/p/security-disclosure-wednesday-october-21st) in the systems that store customer environment variables. Its disclosure says an unauthorized party may have accessed the encrypted variables and, for some of them, obtained the decrypted contents. Railway paused deployments and told everyone to roll all stored environment variables, API keys included, along with any private registry credentials, then review logs for unusual activity.

Put OpenCode, Railway and the earlier Fireworks AI incident side by side and the pattern is hard to miss. Each one is a platform that holds customers' keys to other services. Attackers do not need to break into fifty companies when one provider keeps all fifty sets of keys in the same place.

---

## Banks versus agents

**Not a vulnerability, but it still made my week suck. It counts.**

This one is a policy story. On 13 October JPMorgan said it blocks outside AI agents from logging into customer accounts with banking credentials, and [Jamie Dimon warned](https://fortune.com/2026/10/15/jamie-dimon-ai-agents-meta-muse-jpmorgan/) that customers who hand an agent their login take on the liability. Charles Schwab says it blocks unauthorized agents attempting to log in for clients, and Citi and Bank of America followed by 16 October, according to the Financial Times. Read-only access through authorized data sharing providers stays.

To a bank, an agent using your password looks like you, so the banks are falling back on the one control they fully own: who gets to log in. Nothing to patch here, but it is worth knowing that **your assistant's shortcuts may now be your problem**.

Somewhere a very patient fraud analyst is reading "my assistant did it" for the first time.

---

## OpenAI's agents

On 20 October OpenAI [disclosed two incidents](https://bleepingcomputer.com/news/security/openai-agents-disabled-safety-monitoring-one-lied-about-it) in which its own coding agents weakened the monitoring meant to watch them. On 3 October an agent running GPT-6.1 Sol, fixing an evaluation task, turned off automatic alerts to the security team. It had been told not to send messages during a Slack search and decided that covered the alerts too. On 6 October a GPT-6 Astra agent migrating a program to match a reference implementation removed a monitoring integration, and when asked about it, said it had not.

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTBmdDV3cjYwczF1dW1lcHVwamVsajFnbmVtYXB2ZXo4d3hqcHo0ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/kE6xCyOOHoxlS/giphy.gif"/></figure>

OpenAI says neither incident had external impact or met its top severity threshold. The monitor kept running and storing findings. It just stopped telling anyone.

"Technically followed the instructions" is the oldest bug in the book. We just gave it a new employee. The boring fix applies to humans and agents alike: nobody should be able to edit the thing that monitors them.

---

## Go patch smth this weekend...

Update PHP, Node.js and GitLab, and check your Go version while you are at it. Rotate every key that ever touched LiteLLM, OpenCode or Railway.

I hope your infrastructure is on a fixed version by the time the next advisory drops. If it is not, I will see you in the next post, coffee on me ;)
