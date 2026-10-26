---
title: php2shell Hell
date: 2026-10-25
layout: layouts/post.njk
permalink: /php2shell-hell/
tags:
  - posts
  - write-up
description: What a temporal memory bug actually is, why php2shell is one, and why it took a language model to find a hole that had been sitting in PHP since 2012. We look at it all, in this one.
templateEngineOverride: md
feature_image: /images/2026-10-25-php2shell-hell/php2shell-hell-cover.webp
---
I promised a deep dive at the end of [Vuln Week Galore](/vuln-week-galore/), and here it is. Before we start, if you're interested in low level assembly and that interest is something that has brought you here, you'd love the following 2 of my github repositories that explore the world of binary exploitation through a couple of university courses I took back in the day.

### Some of my own work

https://github.com/hutgrabber/umd-enpm691

https://github.com/hutgrabber/umd-enpm809v

---

> [!note] Foreword:
> Whatever you are about to read, took an extensive amount of research which involved reading through the actual github commits that patched both the CVEs: 
> - [3584a98bda0f2c0d367255b046798b0d3a221a19](https://github.com/php/php-src/commit/3584a98bda0f2c0d367255b046798b0d3a221a19)
> - [31c0ea7d7ff1d1fccb6492e52dab544011628065](https://github.com/php/php-src/commit/31c0ea7d7ff1d1fccb6492e52dab544011628065)
> 
> I now have a new found appreciation for software development in general and would like to give kudos to the team of [4 remediation developers](/php2shell-hell/#commit-authors-the-super-humans-who-saved-the-internet) who quickly shipped patches to the bugs in a timely manner, that saved the internet.


---

## Two kinds of memory bug

**A quick refresher**

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/php2shell-memory.png" alt="Diagram comparing a classic stack buffer overflow to a heap use-after-free" loading="lazy">
  <figcaption>Figure: the two memory bug patterns, side by side</figcaption>
</figure>

Before getting into php2shell specifically, it's worth separating two things that get lumped together as <u>memory corruption</u>.

A <u>stack overflow</u> is spatial. A function has a fixed-size buffer on the stack, something writes past the end of it without a bounds check, and the overflow marches straight into whatever sits next in that stack frame, often the saved return address. This is the bug class that stack canaries, ASLR and non-executable stacks were all built to stop, and it has been the default target for fuzzers for about two decades because it is spatial. Throw enough random input at a function and eventually one of your inputs is too long.

A <u>use-after-free</u> is temporal. Something on the heap gets allocated, a pointer references it, the memory gets freed, and that pointer doesn't get cleared. Nothing is wrong yet. The bug only fires later, when something dereferences the stale pointer after the allocator has already handed that same block of memory to something else. Now you're reading or writing data that belongs to a completely different object, through a pointer that still thinks it owns the old one.

php2shell is the second kind. Both CVEs are use-after-free bugs, and that single fact explains most of what's interesting about this story, including why it survived in PHP for over a decade.

---

## Why this bug hides

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/php2shell-threat-model.png" alt="Threat model diagram showing the general shape of a php2shell style remote code execution chain" loading="lazy">
  <figcaption>Figure: the general shape, not the specific trigger</figcaption>
</figure>

Here's the shape every use-after-free of this kind shares, php2shell included:

1. Some operation starts, and partway through, it stashes a pointer somewhere that outlives the operation itself. A global, a cache, a session structure, doesn't matter which.
2. The operation hits a failure path. Not a crash exactly, a *handled* failure, the kind of thing that's supposed to clean up gracefully and move on.
3. The cleanup code assumes the operation either fully succeeded or never started. It has no path for "got halfway, then bailed." So the pointer from step one survives, still pointing at memory that just got freed.
4. Later, something trusts that pointer again. Maybe it's a different request on a reused worker process. Maybe it's a diagnostic routine running before your actual code gets control at all. Either way, it reads or writes through the dangling reference, and now you have a write-after-free, which is the dangerous half of use-after-free.

What matters for understanding the danger is the pattern itself: a failure path that got tested for "does it crash" and never tested for "does it leave something half-initialized behind." Nobody sat down and wrote a buggy comparison or an off-by-one here. They wrote a correct success path and a correct, separate path for total failure, and the bug lives entirely in the seam between the two. A state nobody designed for, because nobody designed it to exist.

**That seam is exactly what makes this bug class so hard to catch.**

---

## Why fuzzers missed it and a model didn't

A fuzzer's entire strategy is throwing huge volumes of mutated input at a program and watching for crashes, timeouts or sanitizer violations, while tracking which lines of code it managed to touch along the way. That works extremely well against spatial bugs, because a spatial bug is a property of a single execution: one input, one code path, one overflow. More coverage eventually finds it.

A temporal bug isn't a property of one execution. It's a property of a relationship between two executions, the one that leaves the stale state behind and the one that reads it later. A fuzzer optimizing for line coverage has no concept of "did I reach this exact half-failed state, and did a second, unrelated request arrive before anything reset it." That's not a line to cover. It's a sequence across requests the fuzzer was never modeling in the first place.

What actually found this bug, according to the public writeups, wasn't a fuzzer. It was a researcher who described the two required states in plain language, roughly: here's what has to be true before cleanup runs, here's what has to be true for cleanup to get skipped, go find me a place in this codebase where both line up, and handed that description to a language model. That's a fundamentally different search strategy than coverage-guided fuzzing. It's closer to asking where in a fifteen-million-line codebase a specific logical invariant gets violated, which is a question a model can reason about directly instead of needing millions of randomized executions to stumble into.

That's also the uncomfortable part. If this search strategy generalizes, and there's no obvious reason it wouldn't, expect more of these dormant temporal bugs to surface across old, widely deployed codebases over the next while. PHP just happened to go first.

---

## From dangling pointer to shell

### **Getting those hands dirty**

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/threat-model.jpg" loading="lazy">
  </figure>

**Step 1 - <u>Reconnaissance</u>**
We are trying to run a container here that houses the exploit and we can see that the `php2shell-target` container is up and running.

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/target-php-version.webp" loading="lazy">
  </figure>

We see that the php-version here, is the un-patched one. Next, let's try to `curl` `127.0.0.1` on `8088` and see what it's doing.

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/target-curl-list.png" loading="lazy">
  </figure>

^^ And looking at the source code we can see that this is set to print `OK` whenever a request comes in on `http://127.0.0.1:8088/index.php`.

**Step 2 - <u>Exploitation</u>**
Now to exploit it, we are just going to go ahead and run the built-in `exploit.py` that TryHackMe gives us, and while this "two step" exploitation write up might not feel all that useful, it's important to look at the output here and we'll get into the nitty gritty in a second.

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/target-exploit.webp" loading="lazy">
  </figure>

### **Understanding the exploit**

While that exploit was underwhelming, it was necessary for brevity. What we are going to discuss now, is a little more of value than copying a script off of github and running it on different targets in the wild (PSA, do not do that. The line between fun and f\*\*ked is really thin.)

So, what just happened? Hold on to that last image I shared with all of the weird addresses and the chunks. We will come back to it.

Let's put a pin on that and check the following proof of concept:

https://github.com/ikow/php2shell-poc/

The attack happens in phases, the firs phase involves forming the malformed HTTP request. Here, we poison 3 HTTP multipart POST request fields: <u>Session Fixation</u>, <u>Upload Process Trigger</u> and <u>Poisoned Filename with PHP Payload</u>.

- `PHPSESSID`: Fixes the destination session file path.
- `PHP_SESSION_UPLOAD_PROGRESS`: Instructs the SAPI to initialize session tracking before execution.
- `filename`: Carries the raw PHP payload.

Once we have the malformed HTTP request, we can either exploit **CVE-2026-109618** (Memory Corruption via OOM Bailout) or **CVE-2026-109619** (Cross-Request Use-After-Free via Stale Global State). The links to both disclosures are given below, they will take you to PHP's GitHub Repo's Advisory Section:
- [RCE via OOM corruption](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w)
- [RCE via stale global state](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp)

To really ride my previous point home, it helps to separate out the two core engine vulnerabilities that are exploited within **each** CVE and that is also the reason, we have 2 CVE IDs. Once the first step of creating your malformed HTTP request is completed, this is how the rest of the attack unfolds:

- **CVE-2026-109618 (Intra-Request OOM Bailout Corruption):** Occurs _within a single request_ when an Out-of-Memory (`longjmp`) bailout interrupts data structure initialization, causing that same request's shutdown routine to run across uninitialized/corrupt pointers.
- **CVE-2026-109619 (Cross-Request Stale Global State UAF):** Occurs _across two sequential requests_ handled by the same persistent worker process when a pointer in global memory survives after its request-heap backing memory is freed, allowing the next request to dereference it before re-initialization.

**Step-by-Step Execution Flow**

1. **Calibrated Multipart Exhaustion (Pre-Script Startup):** The PoC sends a crafted `multipart/form-data` HTTP `POST` request filled with thousands of form fields or deeply nested array keys (e.g., `a[0][1][2]...`). As the RFC 1867 SAPI parser reads the body to populate the `$_POST` or `$_FILES` hash tables, it repeatedly invokes internal Zend hash table insertion functions (`_zend_hash_str_add_or_update_i()`).

2. **Tripping the Mid-Allocation `longjmp()` (CVE-2026-109618):** When inserting into or resizing a Zend HashTable (`Bucket` array) or allocating a structure, C code often updates the table metadata (such as incrementing element counts `nNumUsed` or linking a bucket pointer) _before_ calling `emalloc()` to allocate the child value string. The PoC calibrates the payload size to hit `memory_limit` on that exact child allocation.

3. **Abandoning the Call Stack:**`_emalloc()` fails, triggers a fatal error, and calls `zend_bailout()`, which executes `longjmp(*EG(bailout), FAILURE)`. The CPU instruction pointer jumps straight back to the top-level SAPI handler, abandoning the C stack mid-function.

	- **The Broken Invariant:** Because the jump happened mid-operation, the HashTable or executor global (`EG()`) now contains a half-written entry—its type flag or pointer field still holds <u>uninitialized</u> heap bytes (whatever raw values were sitting in that memory chunk previously), or `init_executor()` was skipped entirely while shutdown flags say it ran.

4. **Corrupted Request Shutdown (`zend_deactivate`):** Apache `mod_php` transitions into `php_request_shutdown()`. The Zend Engine iterates through `$_POST`/`$_FILES` and executor globals (`EG()`) to free every variable via `zval_ptr_dtor()`.

5. **Hijacking Control Flow:** When `zval_ptr_dtor()` inspects the half-initialized bucket left behind in Step 3, it reads the uninitialized bytes as a valid `zval` pointer and type tag. By shaping the heap beforehand (allocating and freeing specific string sizes earlier in the same multipart request, or across a preceding request on the same worker via **CVE-2026-109619**), the attacker controls the exact bytes sitting in that uninitialized slot. The destructor treats the attacker's forged structure as a real PHP object or resource and invokes its destructor function pointer (`zend_object_handlers-> dtor_obj`), redirecting execution directly to `system()` or a ROP chain.

ROP chaining is achieved by exploitation attempts to recover two addresses:
- Heap chunk base address.
- PHP library (`libphp`) base address.

Those addresses are visible in the image we held on to:

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/target-exploit-annotated.png" loading="lazy">
  </figure>

These addresses help reduce ASLR’s protection because they reveal where relevant memory regions are located.

---

## What PHP actually changed

**The fix matters more than the trigger**

<figure class="img-feat">
  <img src="/images/2026-10-25-php2shell-hell/php2shell-defense.png" alt="Diagram of defenses against memory corruption bugs including php2shell" loading="lazy">
  <figcaption>Figure: defense in depth for this bug class</figcaption>
</figure>

This part is genuinely useful to know in detail, because it's defensive information, not offensive.

Before the fix, PHP used `longjmp`, an old C mechanism for bailing out of deeply nested code in one jump, as its response to running out of memory mid-request. That jump is fast and simple, and for twenty years it was fine, because jumping straight to the end of a request and discarding whatever was half-built usually just meant a failed request, not a security problem. The fix PHP shipped on 21 October stops doing that for the common case. Hitting the memory limit no longer unwinds the stack immediately. Instead the error gets queued and raised at a safe point, so code that stashed a pointer somewhere gets a chance to also clean that pointer up before control leaves. A second, harder limit still exists for genuinely catastrophic cases, and that one just terminates the process outright instead of trying to recover gracefully, which is a reasonable thing to do once "recover gracefully" turned out to be the actual problem.

In other words, the fix isn't a patch to one specific function. It's PHP admitting that `longjmp` as error handling was never really safe for anything that touches shared, long-lived state, and closing that entire category of exit instead of chasing every place it could go wrong one at a time.

---

## Go check your version

I said in [Vuln Week Galore](/vuln-week-galore/) I'd bring more coffee for this one. I lied a little, I brought a diagram instead, but the sentiment holds either way.

If there's one lesson from php2shell worth keeping past this week, it's that "this crashed, but we recovered" is doing a lot of quiet, unexamined work in most C codebases, and recovering badly from a crash can be exactly as dangerous as not handling it at all.

Go check your PHP version. I'll wait.

```bash
php -v
```

---
### Commit Authors - The super humans who saved the internet.
**[Arnaud Le Blanc](https://github.com/arnaud-lb) || [Ilija Tovilo](https://github.com/iluuu1994) || [Jakub Zelenka](https://github.com/bukka) || [Nora Dossche](https://github.com/ndossche)**

<figure class="img-q1">
  <img src="/images/2026-10-25-php2shell-hell/arnaud.jpg" loading="lazy">
  </figure>
<figure class="img-q2">
  <img src="/images/2026-10-25-php2shell-hell/tovilo.png" loading="lazy">
  </figure>
  <figure class="img-q3">
  <img src="/images/2026-10-25-php2shell-hell/jakub.jpg" loading="lazy">
  </figure>
  <figure class="img-q4">
  <img src="/images/2026-10-25-php2shell-hell/nora.png" loading="lazy">
  </figure>