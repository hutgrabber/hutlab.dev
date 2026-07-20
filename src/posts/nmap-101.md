---
title: nmap 101
date: 2026-07-19
layout: layouts/post.njk
permalink: /nmap/
tags:
  - posts
  - write-up
description: Getting those hands dirty with some advanced network scanning. This post is all about nmap the network mapping tool that provides as a first step to network recon.
feature_image: /images/2026-07-19-nmap/cover-image.png
templateEngineOverride: md
meta_title: Network Mapping 101
---
## What Is Nmap?

### Before Nmap Existed

Nmap has been in a Hollywood movie. Not a documentary, an actual movie. Trinity uses it in _The Matrix Reloaded_ to hack a power grid, and somehow that's the single most realistic hacking scene in the entire franchise. My last three pentest reports have less drama and roughly the same number of dependencies on a terminal window.

Before we get into what nmap does, it's worth sitting with what the alternative looks like, because most people who've never had to do it assume port scanning was always this easy. It wasn't. If you wanted to know what was listening on a host in the pre-nmap era (or if you're stuck without it today, which happens more than you'd think on a locked down jump box), your options were something like: `telnet <ip> <port>` one port at a time, reading whatever banner spits back if the connection doesn't immediately hang, and repeating that by hand for every port you cared about. Want to know if it's actually a web server or something else entirely squatting on port 80? Better hope it prints something readable when you poke it, because there's no database of 2,200 known services cross referencing the response for you. Want to guess the operating system? You're eyeballing TTL values (the hop counter every packet carries, decremented by one at each router it crosses) in a ping response and hoping the target hasn't changed the default. None of this scales past a handful of hosts, none of it is scriptable in any serious way, and none of it tells you the difference between a `closed` port and a `filtered` one unless you already know exactly what a firewall in the path is doing to your packets.

### What Nmap Automates

<u>Nmap</u> (Network Mapper) takes all of that manual probing and turns it into raw IP packets sent and interpreted at a scale no human is doing by hand. Point it at a host, and it tells you which ports are open, what's actually listening on them (not just the port number's textbook default), what operating system the target is probably running, and what a firewall or filter in between is doing to your packets. That last part matters more than it sounds: a huge amount of what makes nmap useful isn't finding open ports, it's understanding why a port _isn't_ responding the way you'd expect.

This post is the "101" in the sense that it starts from the default scan, but it doesn't stay there long. If you're brand new, you'll get enough to be dangerous. If you've been running `-sV -A` against everything for years without asking what's actually happening under the hood, there should be plenty here you haven't touched yet: idle scans, decoys, packet fragmentation, and the scripting engine doing things far past "print the open ports."

> [!danger] Scan what you're allowed to scan. Everything below works exactly as well against a network you don't have permission to touch as one you do. The difference is authorization, and only one of those is legal. If you want a live target to practice against without asking anyone's permission, nmap.org keeps `scanme.nmap.org` online for exactly that reason. Their only ask: no more than a dozen scans against it per day, and nothing beyond the scanning itself, no exploits, no denial of service testing.

With the disclaimer out of the way, there is a companion post along with this one, that has a list of commands to try out when working with nmap. Save those in your notes to keep them handy during your engagement as a cheat sheet:

https://hutlab.dev/nmap-commands/

## Basic Nmap Commands

### The Absolute Basics

`nmap $IP` runs the default scan: a SYN scan (more on why in a second) against the 1,000 most common TCP ports. `-p` narrows or expands that: `-p22,80,443` scans exactly those three, `-p1-1000` scans a range, and `-p-` scans all 65,535 ports, which is slower but occasionally the only way you find the interesting service someone stuck on a five digit port because they thought that made it hidden. Targets follow the same flexible syntax whether you're pointing at one box or a whole subnet: a single IP or hostname, a CIDR block like `10.20.30.0/24` (shorthand for every address sharing the first three octets, 256 hosts in that example), or an octet range like `10.20.30.1-50` when you want more control than CIDR gives you.

```bash
nmap -sV -p22,80,443 $IP
```

That's about as basic as this post is going to get, on purpose. If you've read [the hacker mindset](/the-hacker-mindset/), you already know I export my current target as `$IP` for the session ([`exip()`](/the-hacker-mindset/#designing-the-solution) does the honors) so I'm not retyping an address into every command. The rest of this section assumes you already know what a default scan looks like and cares more about what happens once you start turning knobs.

Here's the difference between the two in practice, a default scan against a lab target, followed by the same target with `-p-` turned loose on the full range:

<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" role="img" aria-label="Simulated terminal output comparing a default nmap scan to the same scan with -p-"> <rect x="0" y="0" width="700" height="430" rx="10" fill="#0d0b12"/> <rect x="0" y="0" width="700" height="34" rx="10" fill="#171226"/> <rect x="0" y="24" width="700" height="10" fill="#171226"/> <circle cx="22" cy="17" r="6" fill="#f2707f"/> <circle cx="42" cy="17" r="6" fill="#f0b45f"/> <circle cx="62" cy="17" r="6" fill="#6fe3a1"/> <text x="350" y="21" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12" text-anchor="middle">hutgrabber@lab: ~</text> <text x="20" y="60" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ nmap $IP</text> <text x="20" y="84" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Starting Nmap 7.94 ( https://nmap.org ) at 2026-07-14 09:41 EDT</text> <text x="20" y="104" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">Nmap scan report for WEB-01-EXTERNAL (10.20.30.14)</text> <text x="20" y="122" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">Host is up (0.018s latency).</text> <text x="20" y="142" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Not shown: 997 closed ports</text> <text x="20" y="162" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">PORT STATE SERVICE</text> <text x="20" y="180" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">22/tcp open ssh</text> <text x="20" y="198" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">80/tcp open http</text> <text x="20" y="216" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">443/tcp open https</text> <text x="20" y="236" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Nmap done: 1 IP address (1 host up) scanned in 1.24 seconds</text> <text x="20" y="270" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ nmap -p- $IP</text> <text x="20" y="290" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Not shown: 65530 closed ports</text> <text x="20" y="310" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">PORT STATE SERVICE</text> <text x="20" y="328" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">22/tcp open ssh</text> <text x="20" y="346" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">80/tcp open http</text> <text x="20" y="364" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">443/tcp open https</text> <text x="20" y="382" fill="#f077b6" font-family="Menlo, Consolas, monospace" font-size="12">31337/tcp open unknown</text> <text x="20" y="402" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Nmap done: 1 IP address (1 host up) scanned in 14.07 seconds</text> </svg><figcaption>Figure: the full range finds 31337</figcaption>

### Picking Up the Pace

The default <u>SYN scan</u> (`-sS`) is the one nmap reaches for automatically when you have raw socket privileges (the ability to build a packet by hand instead of asking your OS to open a connection for you), and there's a real reason it's the default instead of just a historical accident. It's called a half open scan because it never finishes the TCP handshake: nmap sends a SYN, a SYN/ACK back means `open`, a RST means `closed`, and silence (or certain ICMP errors) means `filtered`. Because the connection never completes, it's faster than the alternative and leaves less of a footprint in a target's logs.

That alternative is `-sT`, the connect scan, which asks your OS to actually finish the handshake via the standard `connect()` socket call. It's what nmap falls back to when you don't have root, and it's also the _only_ option in one specific situation worth knowing by name: if you're pivoting through a SOCKS proxy (a single forwarded connection that tunnels arbitrary TCP traffic through it), the way I set up in [SSH, Part 2](/ssh-part-2/), raw sockets don't survive the tunnel. Nmap silently drops to `-sT` in that case, no matter what you asked for. If you run a scan through proxychains and get nothing back, that's almost always why, and it's worth checking before you assume the whole subnet is filtered.

Speed past the scan type itself is controlled with `-T0` through `-T5`. These timing templates aren't just a vague "go faster" dial, they set concrete values: `-T4` caps the retry count at 6 and the max TCP scan delay at 10ms, `-T5` is more aggressive still, capping retries at 2 and delay at 5ms while also shortening the host and script timeouts. `-T0` (paranoid) waits five full minutes between probes, which is built for IDS evasion on a scan you're willing to let run for days, not something you reach for by accident. For most lab and engagement work, `-T4` is the one worth defaulting to.

`-A` is the shortcut that bundles a lot of what's covered in the rest of this section into one flag: OS detection, version detection, script scanning with the default set of NSE (Nmap Scripting Engine) scripts, and traceroute. It's convenient, but it's also loud and slow compared to picking exactly what you need, so treat it as a starting point for exploration rather than something you run against every host on an engagement without thinking about it.

### Naming Names

`-sV` is where nmap stops telling you "port 22 is open" and starts telling you what's actually answering on it. It works by sending a series of protocol specific probes (the `nmap-service-probes` database has entries for hundreds of protocols) and matching the response against known signatures. You control how hard it tries with `--version-intensity`, from 0 to 9, default 7: higher catches more obscure services at the cost of a slower scan.

```bash
sudo nmap -sV -O -p22,443 $IP
```

Add `-O` and nmap fingerprints the operating system by sending a battery of TCP and UDP probes and comparing the quirks in the responses (initial window size, TCP option ordering, IP ID sequencing, and a dozen other signals) against a database of more than 2,600 known OS fingerprints. It needs at least one open and one closed port to work reliably, which is worth remembering when a target comes back with no OS guess at all: check whether nmap actually had a closed port to compare against before assuming the fingerprint failed for some more interesting reason.

Combine `-sV` with the default NSE set (`-sC`, or just use `-A`) against port 22 or 443 and you start getting the fingerprints and certificates that make a target actually identifiable instead of just "a thing running SSH": `ssh-hostkey` pulls the host key fingerprints straight out of the handshake, and scripts like `ssl-enum-ciphers` interrogate a TLS listener for its supported cipher suites. We'll spend real time on reading both of these in the next section, because the raw output looks intimidating the first time you see it and isn't, once you know what each line means.

### Saving the Evidence

None of this is useful if you can't get it out of the terminal. Nmap writes five different output formats, and picking the right one is less about preference and more about what happens to the data next.

`-oN <file>` is normal output: the same thing you see in your terminal, saved to a file, meant for a human to read later. `-oX <file>` is XML, and it's the one that actually matters for anything downstream: every major Nmap parsing library, every report generator, every "import my scan into a tool" workflow expects XML, because it's structured and stable in a way the other formats aren't. `-oG <file>` is grepable output, one line per host, and despite being officially deprecated in favor of XML, it's still genuinely useful for a fast one liner: `grep open scan.gnmap` beats writing an XML parser for a five minute task. `-oA <basename>` writes all three at once (`.nmap`, `.xml`, `.gnmap`), which is what I actually run on anything worth keeping:


```bash
sudo nmap -sV -O -T4 -p- -oA WEB-01-EXTERNAL-fullscan $IP
```

Filenames support `strftime` style tokens too (`%Y`, `%m`, `%d`, `%H%M`, and so on), so `-oA 'scan-%Y%m%d-%H%M'` timestamps itself without any extra scripting on your end. There's a fifth format, `-oS`, which reformats output to look like it was typed by someone who thinks capital letters are for cowards. It exists, it's a joke nmap's own documentation is in on, and I've never had a reason to use it outside of showing someone the option exists.

The one gotcha worth knowing: the space between the flag and the filename is mandatory. `-oX scan.xml` works, `-oXscan.xml` silently creates a normal format file literally named `Xscan.xml`. I have absolutely done this and stared at the wrong file for longer than I'd like to admit before noticing the flag hadn't actually done anything.

Stack `-T4`, `-A`, and `-oA` on the same command and this is the shape of what comes back, OS detection, version detection, and the default NSE scripts all firing in one run, followed by the three files it left behind:

<svg viewBox="0 0 700 500" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" role="img" aria-label="Simulated terminal output for an nmap -T4 -A -oA scan and the resulting output files"> <rect x="0" y="0" width="700" height="500" rx="10" fill="#0d0b12"/> <rect x="0" y="0" width="700" height="34" rx="10" fill="#171226"/> <rect x="0" y="24" width="700" height="10" fill="#171226"/> <circle cx="22" cy="17" r="6" fill="#f2707f"/> <circle cx="42" cy="17" r="6" fill="#f0b45f"/> <circle cx="62" cy="17" r="6" fill="#6fe3a1"/> <text x="350" y="21" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12" text-anchor="middle">hutgrabber@lab: ~</text> <text x="20" y="60" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ sudo nmap -T4 -A -oA WEB-01-EXTERNAL-fullscan $IP</text> <text x="20" y="84" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Starting Nmap 7.94 ( https://nmap.org ) at 2026-07-14 10:15 EDT</text> <text x="20" y="104" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">Nmap scan report for WEB-01-EXTERNAL (10.20.30.14)</text> <text x="20" y="122" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">Host is up (0.021s latency).</text> <text x="20" y="142" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Not shown: 997 closed ports</text> <text x="20" y="162" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">PORT STATE SERVICE VERSION</text> <text x="20" y="180" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">22/tcp open ssh OpenSSH 9.6p1 Ubuntu 3ubuntu13 (Ubuntu Linux; protocol 2.0)</text> <text x="20" y="198" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">| ssh-hostkey:</text> <text x="20" y="216" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">|_ 256 3c:aa:8e:1f:9b:77:04:5d:e2:88:0a:61:3f:9c:d4:17 (ECDSA)</text> <text x="20" y="234" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">443/tcp open ssl/http nginx 1.24.0</text> <text x="20" y="252" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">| ssl-enum-ciphers:</text> <text x="20" y="270" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">|_ least strength: A</text> <text x="20" y="290" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Device type: general purpose</text> <text x="20" y="308" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Running: Linux 6.2.X</text> <text x="20" y="326" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">OS details: Linux 6.2 - 6.5</text> <text x="20" y="344" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Network Distance: 3 hops</text> <text x="20" y="362" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel</text> <text x="20" y="382" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Nmap done: 1 IP address (1 host up) scanned in 8.63 seconds</text> <text x="20" y="416" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ ls -la WEB-01-EXTERNAL-fullscan.*</text> <text x="20" y="436" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">-rw-r--r-- 1 hutgrabber staff 4218 Jul 14 10:15 WEB-01-EXTERNAL-fullscan.gnmap</text> <text x="20" y="454" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">-rw-r--r-- 1 hutgrabber staff 2916 Jul 14 10:15 WEB-01-EXTERNAL-fullscan.nmap</text> <text x="20" y="472" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">-rw-r--r-- 1 hutgrabber staff 18734 Jul 14 10:15 WEB-01-EXTERNAL-fullscan.xml</text> </svg> <figcaption>Figure: one scan, three output files</figcaption>

The port table above is dense with information and I've been glossing over exactly what each column means. Time to fix that.

## Reading Nmap Output

### The Port Table

Every scanned port lands in one of four states, and the difference between them is the entire point of running a raw packet scan instead of just trying to connect. `open` means something is actively listening and answered the probe. `closed` means the port responded, but nothing is listening, RST for a SYN scan, or an ICMP port unreachable message for UDP (ICMP being the protocol behind things like ping, used here to report an error instead of a reply). `filtered` means nmap couldn't tell either way because something (almost always a firewall) is silently dropping the probe instead of responding to it. You'll also see the combined states `open|filtered` and `closed|filtered` on scan types that can't fully distinguish between the two, most commonly UDP scans and the NULL/FIN/Xmas family. Run with `--reason`, and nmap tells you exactly what triggered each verdict, "syn-ack" for an open port, "reset" for a closed one, so you're not just trusting a label, you're seeing the actual packet that produced it.

The summary line above the port table, something like `Not shown: 995 closed ports`, is nmap telling you it's collapsing the boring majority into one line instead of printing a thousand identical `closed` rows. If that number looks suspiciously round or suspiciously large for a host you expected to be wide open, it's worth rerunning with `--open` to filter the noise down to only what actually responded.

### Service and Version Strings

A `-sV` line looks like this, straight out of a real scan against nmap's own test target:

```
22/tcp   open     ssh         OpenSSH 5.3p1 Debian 3ubuntu7 (protocol 2.0)
80/tcp   open     http        Apache httpd 2.2.14 ((Ubuntu))
```

Reading left to right: port and protocol, state, the service name nmap thinks is running (from its own guess or a version match), then the version string itself, product, version number, and anything extra the probe picked up, in this case the Debian package variant and the negotiated protocol version. That version string is the whole reason `-sV` exists. Knowing port 22 is open tells you almost nothing. Knowing it's OpenSSH 5.3p1 tells you exactly which CVEs to go check.

### Keys and Certificates

This is the block that trips people up the first time they see it, because it doesn't look like the rest of the port table:

```
22/tcp   open     ssh         OpenSSH 5.3p1 Debian 3ubuntu7 (protocol 2.0)
| ssh-hostkey: 1024 8d:60:f1:7c:ca:b7:3d:0a:d6:67:54:9d:69:d9:b9:dd (DSA)
|_2048 79:f8:09:ac:d4:e2:32:42:10:49:d3:bd:20:82:85:ec (RSA)
```

Those `|` and `|_` prefixed lines are NSE script output riding along under the port they belong to. `ssh-hostkey` connects to the SSH service and pulls every host key it offers, printing the key size, the fingerprint, and the algorithm for each: DSA, RSA, ECDSA, or ED25519 depending on what the server supports. The `|_` on the last line isn't decorative, it's how NSE marks the end of that script's output block so you know where it stops and the next thing (another script, or the next port) begins. The practical use here is bigger than it looks: if you're scanning the same host from two different engagements and the fingerprint changed, either someone rebuilt the box, or something less innocent is intercepting your connection. Save these fingerprints. Compare them later.

TLS certificates work on the same principle but through a different script, most commonly `ssl-enum-ciphers` for cipher suite auditing. Point it at an HTTPS or other TLS wrapped port and it grades every cipher suite the server offers by strength, flagging weak or deprecated ones instead of just listing them flat. Reading it is mostly about scanning for the grade column: an A next to a modern suite is fine, a C or worse next to something offering RC4 or a export grade cipher from a decade no one should still be supporting is the actual finding.

### Everything Else

Below the port table, a fuller scan keeps talking, and every line there answers a specific question worth reading instead of skimming past.

`Device type` and `Running` come from `-O` and are exactly what they say: a best guess at whether you're looking at a general purpose host, a router, a printer, or something else, plus the OS family and version range nmap's fingerprint database matched against. `OS CPE` gives you the same information as a CPE string (a standardized format vulnerability databases use to reference specific software and versions), handy if that's where this scan is headed next. `Network Distance` is hop count (how many routers sit between you and the target), from a real traceroute if you asked for one (bundled into `-A`), or estimated from TTL otherwise.

In verbose mode, `-O` also reports a TCP Sequence Predictability Classification, an English language rating like "worthy challenge" or "trivial joke" describing how hard it would be to forge a TCP connection against this host by guessing its sequence numbers. It's a legacy of an attack that's rare today but not extinct, and the rating is exactly as blunt as it sounds: if a host reports "trivial joke," that's not a compliment. Verbose mode also surfaces an uptime guess pulled from the TCP timestamp option, which is a fun one to cross reference against a target's patch cadence if you're trying to build a picture of how often a box actually gets rebooted.

## Advanced Nmap Commands

Everything so far assumes nmap is talking to a target with nothing actively working against it. That's rarely true past a home lab. This section is about what happens when there's a firewall paying attention.

### The Zombie Scan

`-sI <zombie_ip> <target>` is the closest thing nmap has to a magic trick. It performs a completely blind scan where no packet with your real IP address ever touches the target. Instead, it exploits predictable IP ID generation on a third host (the "zombie"). The IP ID is a per-packet counter most operating systems increment by one every time they send a packet, and by watching how that counter changes on the zombie, nmap infers which ports on the real target are open without ever touching it directly. Any <u>IDS</u> watching the target sees the zombie's IP doing the scanning, not yours.

```bash
sudo nmap -sI 10.20.30.99 -p1-1000 $IP
```

The zombie has to be an idle host with predictable, incremental IP ID generation, which rules out a lot of modern operating systems by default (many randomize IDs specifically to break this technique). Finding a usable zombie on a real network is half the challenge. The other, more interesting use case isn't stealth at all, it's mapping trust relationships: the port list you get back is open ports _as seen from the zombie's perspective_, so scanning the same target through several candidate zombies tells you which machines a firewall or router implicitly trusts.

### Spoofing Your Way Around

A surprising number of firewall misconfigurations come down to trusting a source port instead of actually inspecting the traffic. DNS replies come from port 53, so some administrators allow all inbound traffic claiming to originate from port 53, reasoning that no attacker would bother spoofing it. `--source-port` (or its shorthand `-g`) exploits exactly that assumption:

```bash
sudo nmap --source-port 53 -p22,80,443 $IP
```

It only works on scan types using raw sockets (SYN, UDP, and friends), not on connect scans or anything relying on your OS's normal socket stack, since the OS picks its own source port for those regardless of what you ask for.

`--spoof-mac` does the same trick one layer down, rewriting the MAC address (the hardware address burned into a network interface, one layer below an IP address, and the identifier your local network segment actually uses) on every raw ethernet frame nmap sends. Feed it a full address, a partial one it'll pad randomly, a vendor name it'll look up an OUI for (the three byte vendor prefix baked into every MAC address), or a bare `0` for something fully random. `-D` layers on <u>decoys</u>: supply a list of other IPs (real or, with `RND`, generated on the spot) and nmap makes it look like all of them are scanning the target simultaneously, burying your real address in the noise. Put `ME` in the list to control where your actual IP lands in that lineup, or leave it out and nmap places you randomly.

```bash
sudo nmap -D RND:10,ME -p1-1000 $IP
```

None of this is undetectable. A patient analyst tracing routes back through decoy IPs, or an ISP filtering spoofed source addresses, can unwind most of it. It raises the cost of getting caught, it doesn't eliminate it, and treating it as a guarantee of anonymity is the kind of mistake that ends engagements badly.

### The ACK Scan

`-sA` is a different tool for a different job. It never determines whether a port is `open`, that's not what it's for. Its entire purpose is figuring out whether a firewall in front of your target is stateful or stateless. Send an ACK packet (with no SYN preceding it) to a port behind a stateless filter, and the filter has no session to check against, so it lets the packet through and the target replies with a RST, showing up as `unfiltered`. A stateful firewall recognizes the ACK doesn't belong to any connection it's tracking and drops it, showing up as `filtered`. Neither result tells you what's actually running on that port. Both tell you something important about the box standing in front of it, which is sometimes exactly the information you need before deciding which other technique on this list is worth trying next.

### Fragmentation and Padding

`-f` splits your outgoing packets into fragments of 8 bytes each after the IP header, small enough that a naive packet filter inspecting each fragment individually can't reassemble enough of the TCP header to know what it's looking at. Specify `-f` twice for 16 byte fragments, or set an exact size yourself with `--mtu` (Maximum Transmission Unit, the largest chunk of data a network link will carry in one packet before it has to be split up; the value has to be a multiple of 8). This only helps against filters that don't reassemble fragments before inspecting them, and plenty of modern firewalls do reassemble by default specifically to close this gap, so it's worth confirming with a packet capture that your fragments are actually going out fragmented rather than assuming the flag did something.

```bash
sudo nmap -f -p22,80,443 $IP
```

`--data-length <n>` appends random padding bytes to most probe packets, which does nothing to change what the scan detects but makes the traffic look a little less like a textbook nmap fingerprint to something doing shallow packet inspection. It's a minor tweak, not a disguise, and it's most useful stacked on top of the fragmentation and spoofing options above rather than relied on by itself.

## Nmap Scripting Engine

### The Short Version

NSE runs scripts, written in Lua, against the hosts and ports nmap has already found. That's really the whole concept: everything interesting about NSE is in what the scripts actually do, not in the mechanism running them. `-sC` runs the default script set. `--script` lets you pick exactly which ones to run, by name, by category, or by directory. We've already seen a few of NSE's output in the previous sections (`ssh-hostkey`, `ssl-enum-ciphers`) without dwelling on the mechanics behind them. Time to fix that.

### Script Arguments

Most interesting scripts take arguments, and the syntax is Lua's table syntax borrowed wholesale: comma separated `name=value` pairs, with `{}` for table values. This is a real example straight from Nmap's own documentation, and it's dense enough to be worth studying once rather than guessing at:

```bash
nmap -sC --script-args 'user=foo,pass=",{}=bar",paths={/admin,/cgi-bin},xmpp-info.server_name=localhost'
```

Arguments can be qualified with the script name (`xmpp-info.server_name`) so they only affect that one script, or left unqualified when you want a value like `timeout=250ms` to apply broadly across every script that reads a `timeout` argument. Specify both, and the qualified one wins for its script while the unqualified one covers everything else. A simpler, more typical case:

```bash
nmap --script snmp-sysdescr --script-args creds.snmp=admin $IP
```

Got a lot of arguments, or want them out of your shell history? `--script-args-file` reads the same syntax from a file instead.

### Finding a Script

Nmap ships with hundreds of scripts, and remembering exact names is a losing battle. This is the actual problem the `nse()` function from [the hacker mindset](/the-hacker-mindset/#designing-the-solution) solves: it greps the local script database for whatever string you throw at it, `nse ssh` or `nse smb-`, so you're searching instead of remembering. If you haven't set that up, the scripts live in a `scripts` subdirectory of nmap's data directory (`/usr/share/nmap/scripts/` on most Linux installs), and a plain `ls` there works in a pinch.

`--script-help` gets you a script's description without running it, and it accepts the same selection syntax as `--script` itself, including wildcards and boolean expressions. This is straight from Nmap's own reference documentation:

```
$ nmap --script-help "afp-* and discovery"

afp-ls
Categories: discovery safe
  Attempts to get useful information about files from AFP volumes.

afp-serverinfo
Categories: default discovery safe
  Shows AFP server information. This information includes the server's
  hostname, IPv4 and IPv6 addresses, and hardware type.
```

That same selection syntax is worth knowing on its own, because `--script` accepts full boolean expressions, not just a flat list. `--script "not intrusive"` runs everything except the scripts flagged as risky to a target. `--script "default or safe"` is the same as listing both categories with a comma. `--script "(default or safe or intrusive) and not http-*"` combines all three categories while excluding an entire family by name. Prefix any script or expression with `+` and it runs regardless of its own `portrule`, useful when you already know a service is running on a nonstandard port and don't want to wait for a full `-sV --version-all` just to get NSE to notice it's there.

Neither of these needs a target, which makes them the easiest thing in this entire post to check yourself right now:

<svg viewBox="0 0 700 460" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" role="img" aria-label="Simulated terminal output for nmap --script-help against a single script and a category expression"> <rect x="0" y="0" width="700" height="460" rx="10" fill="#0d0b12"/> <rect x="0" y="0" width="700" height="34" rx="10" fill="#171226"/> <rect x="0" y="24" width="700" height="10" fill="#171226"/> <circle cx="22" cy="17" r="6" fill="#f2707f"/> <circle cx="42" cy="17" r="6" fill="#f0b45f"/> <circle cx="62" cy="17" r="6" fill="#6fe3a1"/> <text x="350" y="21" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12" text-anchor="middle">hutgrabber@lab: ~</text> <text x="20" y="60" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ nmap --script-help ssh-hostkey</text> <text x="20" y="84" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Starting Nmap 7.94 ( https://nmap.org ) at 2026-07-14 11:02 EDT</text> <text x="20" y="114" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">ssh-hostkey</text> <text x="20" y="132" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Categories: default safe</text> <text x="20" y="150" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">https://nmap.org/nsedoc/scripts/ssh-hostkey.html</text> <text x="20" y="168" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12"> Shows SSH hostkeys, and optionally their fingerprints, by</text> <text x="20" y="186" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12"> connecting to the target and requesting them directly.</text> <text x="20" y="220" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ nmap --script-help "default and safe"</text> <text x="20" y="244" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Starting Nmap 7.94 ( https://nmap.org ) at 2026-07-14 11:03 EDT</text> <text x="20" y="274" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">ftp-anon</text> <text x="20" y="292" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Categories: default safe</text> <text x="20" y="310" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">https://nmap.org/nsedoc/scripts/ftp-anon.html</text> <text x="20" y="328" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12"> Checks if an FTP server allows anonymous logins.</text> <text x="20" y="358" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">http-auth</text> <text x="20" y="376" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Categories: default safe</text> <text x="20" y="394" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">https://nmap.org/nsedoc/scripts/http-auth.html</text> <text x="20" y="412" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12"> Retrieves the authentication scheme for a web page and</text> <text x="20" y="430" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12"> whether it requires credentials.</text> </svg> <figcaption>Figure: script help needs no target</figcaption>

### Writing Your Own Scripts

Custom scripts live wherever you point `--script` at, a full path to a file or a directory ending in `/` works without any installation step. Drop one into `~/.nmap/scripts/` (not searched on Windows) or the shared `scripts` directory and run `--script-updatedb` afterward so it shows up in category and wildcard lookups, and in that same `nse` search function once it's indexed.

The shape of a script is a handful of fields plus one function that does the actual work. `description` is a plain text explanation, shown by `--script-help`. `categories` is a Lua array, `categories = {"default", "discovery", "safe"}`, deciding which category based selections will pick the script up. `author` and `license` are just credit and a licensing statement, optional but polite. `dependencies` is an array of script names that should run first if they're also selected, so you can build on another script's findings without re-implementing its logic.

The part that actually decides _when_ your script runs is a rule function: `prerule()` runs before any scanning starts, useful for broadcast style discovery. `hostrule(host)` runs once per matched host. `portrule(host, port)` runs once per matched port, and is the one you'll write most often. `postrule()` runs once after everything else finishes, good for summarizing results across the whole scan rather than one host at a time. A script needs at least one of these, and can have more than one if it's useful in multiple phases.

Whatever function your rule triggers, `action` is where the actual work happens, and it can return a table (auto-formatted into the structured output you've already seen under `ssh-hostkey`), a plain string (printed as-is), or `nil` if there's nothing worth reporting. A minimal skeleton, stripped down to just the shape:

lua

```lua
description = "Says hi to whatever's listening, nothing more."
categories = {"discovery", "safe"}
author = "hutgrabber"
license = "Same as Nmap--See https://nmap.org/book/man-legal.html"

portrule = function(host, port)
  return port.number == 8080 and port.state == "open"
end

action = function(host, port)
  return "Hello from port 8080."
end
```

That's genuinely enough to get a script indexed, selectable by category, and running against exactly the port you told it to care about. Nmap's own [Script Format reference](https://nmap.org/book/nse-script-format.html) covers every field in more detail than fits here, and the accompanying tutorial chapters in the same book walk through building a complete script line by line if you want to go further than a skeleton.

## Reading NSE Output

### Where Script Output Lives

Script output attaches to whatever it ran against: port scripts show up nested under their port in the table, prefixed with `|`, host scripts show up in their own block per host, and the very last line of any script's output block gets `|_` instead of `|`, marking where that script's output ends. It's a small visual convention, but once you're scanning a host with five or six scripts firing on the same port, it's the only thing telling you where one script's findings stop and the next one's start.

### A Worked Example

I can't hand you a screenshot of NSE finding something interesting, because that requires a target actually worth finding something on, and my lab doesn't have anything juicy enough sitting around to responsibly demonstrate against. So here's what that output actually looks like instead, styled to match the real format nmap ships:

<svg viewBox="0 0 700 330" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" role="img" aria-label="Simulated terminal output showing an nmap scan with ssh-hostkey NSE output"> <rect x="0" y="0" width="700" height="330" rx="10" fill="#0d0b12"/> <rect x="0" y="0" width="700" height="34" rx="10" fill="#171226"/> <rect x="0" y="24" width="700" height="10" fill="#171226"/> <circle cx="22" cy="17" r="6" fill="#f2707f"/> <circle cx="42" cy="17" r="6" fill="#f0b45f"/> <circle cx="62" cy="17" r="6" fill="#6fe3a1"/> <text x="350" y="21" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12" text-anchor="middle">hutgrabber@lab: ~</text> <text x="20" y="60" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ sudo nmap -sV -p22 --script ssh-hostkey $IP</text> <text x="20" y="86" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Starting Nmap 7.94 ( https://nmap.org ) at 2026-07-14 09:41 EDT</text> <text x="20" y="106" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">Nmap scan report for WEB-01-EXTERNAL (10.20.30.14)</text> <text x="20" y="124" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">Host is up (0.021s latency).</text> <text x="20" y="154" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">PORT STATE SERVICE VERSION</text> <text x="20" y="174" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">22/tcp open ssh OpenSSH 9.6p1 Ubuntu 3ubuntu13 (Ubuntu Linux; protocol 2.0)</text> <text x="20" y="194" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">| ssh-hostkey:</text> <text x="20" y="212" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">| 256 3c:aa:8e:1f:9b:77:04:5d:e2:88:0a:61:3f:9c:d4:17 (ECDSA)</text> <text x="20" y="230" fill="#7db8f0" font-family="Menlo, Consolas, monospace" font-size="12">|_ 256 91:0f:44:d8:2a:6b:15:ce:37:f0:88:9a:cd:12:3e:76 (ED25519)</text> <text x="20" y="260" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Service detection performed. Please report any incorrect results at</text> <text x="20" y="278" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">https://nmap.org/submit/ .</text> <text x="20" y="298" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">Nmap done: 1 IP address (1 host up) scanned in 6.82 seconds</text> </svg> <figcaption>Figure: reading an ssh-hostkey result</figcaption>

Now the part that's a little more speculative in shape, a script whose `action` returns a table instead of a plain string, which is the format vulnerability checking scripts generally use to report a finding with severity and references attached:

<svg viewBox="0 0 700 300" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" role="img" aria-label="Simulated terminal output showing a table-style NSE vulnerability script result"> <rect x="0" y="0" width="700" height="300" rx="10" fill="#0d0b12"/> <rect x="0" y="0" width="700" height="34" rx="10" fill="#171226"/> <rect x="0" y="24" width="700" height="10" fill="#171226"/> <circle cx="22" cy="17" r="6" fill="#f2707f"/> <circle cx="42" cy="17" r="6" fill="#f0b45f"/> <circle cx="62" cy="17" r="6" fill="#6fe3a1"/> <text x="350" y="21" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12" text-anchor="middle">hutgrabber@lab: ~</text> <text x="20" y="60" fill="#6fe3a1" font-family="Menlo, Consolas, monospace" font-size="13">$ sudo nmap --script vuln-example -p443 $IP</text> <text x="20" y="90" fill="#c39bf5" font-family="Menlo, Consolas, monospace" font-size="12">PORT STATE SERVICE</text> <text x="20" y="108" fill="#d8d4e4" font-family="Menlo, Consolas, monospace" font-size="12">443/tcp open https</text> <text x="20" y="128" fill="#f0b45f" font-family="Menlo, Consolas, monospace" font-size="12">| vuln-example:</text> <text x="20" y="146" fill="#f0b45f" font-family="Menlo, Consolas, monospace" font-size="12">| VULNERABLE:</text> <text x="20" y="164" fill="#f0b45f" font-family="Menlo, Consolas, monospace" font-size="12">| Example Misconfiguration Disclosure</text> <text x="20" y="182" fill="#f0b45f" font-family="Menlo, Consolas, monospace" font-size="12">| State: LIKELY VULNERABLE</text> <text x="20" y="200" fill="#f0b45f" font-family="Menlo, Consolas, monospace" font-size="12">| Risk factor: Medium</text> <text x="20" y="218" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">| Description:</text> <text x="20" y="236" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">| Illustrative shape only, not a real script or a real finding.</text> <text x="20" y="254" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">| References:</text> <text x="20" y="272" fill="#8b84a2" font-family="Menlo, Consolas, monospace" font-size="12">|_ https://nmap.org/book/nse-script-format.html</text> </svg> <figcaption>Figure: a hypothetical vuln script</figcaption>

I'd rather label that second one honestly as a mockup than pretend I captured a real vulnerability against a target I made up for a blog post. If you want the real thing, `-sC` or `-sV --script vuln` against a host that's actually got something wrong with it will show you the genuine format soon enough.

### The Postrule That Snitches

One detail worth knowing about `ssh-hostkey` specifically: it's not only a port script. It also ships a <u>postrule</u> that runs once, after nmap has finished every host in the scan, and checks whether any two hosts reported the _same_ key. Finding a duplicate is a real, actionable signal, either someone cloned a VM image without regenerating its host key (common, mostly harmless, still worth flagging), or something is intercepting connections and presenting the same forged key to multiple targets (a lot less harmless). This is exactly the kind of thing a `postrule` is for: not discovery, not host level scanning, just summarizing something the rest of the scan already collected but couldn't see across hosts on its own.

## Enter Rustscan

<figure class="img-l">
  <img src="/images/2026-07-19-nmap/rustscan.gif" loading="lazy">
</figure>

### What It Fixes

Everything in this post assumes you're willing to wait for nmap to work through however many ports you asked for. Rustscan's whole pitch is that you shouldn't have to: it scans all 65,535 ports in a few seconds by leaning on async networking and a much more aggressive open file limit than nmap defaults to, then hands the actual open port list to nmap for the parts nmap is genuinely better at, service detection, OS fingerprinting, NSE.

<figure class="img-h1">
  <img src="/images/2026-07-19-nmap/rustscan-ex1.gif" alt="Left image" loading="lazy">
</figure>
<figure class="img-h1">
  <img src="/images/2026-07-19-nmap/rustscan-ex2.gif" alt="Left image" loading="lazy">
</figure>
<figure class="img-m">
  <img src="/images/2026-07-19-nmap/rustscan-ex3.gif" loading="lazy">
</figure>

### Not Today

I'm not covering it properly here, on purpose. It deserves its own post rather than a rushed paragraph at the bottom of this one, and there's enough nuance in how it hands off to nmap (and where that handoff can go wrong) to justify the space. Consider this the trailer, but here's some documentation to get you started:

https://github.com/bee-san/RustScan

## SYN'n Off

### What We Actually Covered

Default scans, timing templates, stealth versus connect scans and why a SOCKS proxy takes the choice away from you, version and OS fingerprinting, reading a port table without squinting at it, SSH keys and TLS ciphers, idle scans through a zombie host, decoys, source port and MAC spoofing, fragmentation, and a scripting engine that goes a lot further than "print the open ports" once you start feeding it arguments and writing your own. That's a lot more than "101" usually implies, and if you made it this far without skipping to the code blocks, you already know more about reading nmap's output than most people who've been running `-sV -A` on autopilot for years.

### One Last Thing

Go build the lab, run the scans, and actually read what comes back instead of grepping straight for "open" and moving on. The interesting part of this tool was never the scan. Don't forget to check out my [companion post](/nmap-commands/) with various examples to try out. It's what the response tells you about everything standing between you and the target. SYN off.