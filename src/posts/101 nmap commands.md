---
title: 101 nmap commands, a companion post
date: 2026-07-19
layout: layouts/post.njk
permalink: /nmap-commands/
tags:
  - posts
  - tutorials
description: A companion cheat sheet to nmap 101. One hundred and one commands, one trick each, zero filler.
feature_image: /images/2026-07-19-nmap/nmap-commands-companion-post.png
templateEngineOverride: md
meta_title: 101 Nmap Commands
---

The [nmap 101 post](/nmap/) ran long. Long enough that someone asked me for the version without the paragraphs, the one you actually paste into a terminal at 2am when the engagement clock is running. Fair. So here are 101 nmap commands, one per trick, and I made a point of never showing the same feature twice.

Every command assumes I've already exported my target as `$IP`, which is the [`exip()` habit](/the-hacker-mindset/#designing-the-solution) from the mindset post, so swap in your own address and go. When a one liner here isn't enough, nmap's own [reference guide](https://nmap.org/book/man.html) always is. Same rule as ever: scan what you own or have written permission to touch, and `scanme.nmap.org` is there when you need a legal target.

## Finding Hosts

Before you scan ports you have to know what's alive, and the <u>host discovery</u> [options](https://nmap.org/book/man-host-discovery.html) are where most people leave accuracy on the table.

### Ping sweep
**Who's home on this subnet.**

```bash
nmap -sn 10.20.30.0/24
```

`-sn` disables the port scan entirely and just reports which of the 256 hosts answer, the fastest way to draw a map before you commit to anything.

### Skip discovery
**Assume it's up and scan anyway.**

```bash
nmap -Pn $IP
```

`-Pn` skips the discovery ping and treats the host as online, which is the only way you'll get results out of a box that silently drops every probe.

### SYN ping
**Knock with a SYN instead of a ping.**

```bash
sudo nmap -PS22,80,443 $IP
```

`-PS` sends TCP SYN packets to the listed ports to decide liveness, useful when ICMP is filtered but the web and SSH ports are not.

### ACK ping
**Liveness check that slips past SYN filters.**

```bash
sudo nmap -PA80 $IP
```

`-PA` probes with a bare ACK, which some stateless firewalls wave through even when they block the SYN.

### UDP ping
**Poke the protocol everyone forgets.**

```bash
sudo nmap -PU53,161 $IP
```

`-PU` uses UDP for discovery, handy for finding hosts that only answer on DNS or SNMP.

### SCTP ping
**Discovery for telecom stacks.**

```bash
sudo nmap -PY132 $IP
```

`-PY` sends an SCTP INIT for host discovery, which matters the day you're staring at a SIGTRAN or SS7 network.

### ICMP echo
**The plain old ping, on purpose.**

```bash
sudo nmap -PE $IP
```

`-PE` forces a classic ICMP echo request, the discovery method everyone pictures and nmap doesn't always use by default.

### Protocol ping
**Ask which IP protocols answer.**

```bash
sudo nmap -PO1,6,17 $IP
```

`-PO` pings using raw IP packets for protocol numbers 1, 6, and 17 (ICMP, TCP, UDP), a discovery angle that dodges port-based filters.

### ARP ping
**The only honest way to sweep a LAN.**

```bash
sudo nmap -PR 10.20.30.0/24
```

`-PR` uses ARP on the local segment, which is faster and far more reliable than any IP-level ping because a host can't hide from ARP on its own wire.

### List targets
**Expand the range without sending a packet.**

```bash
nmap -sL 10.20.30.0/24
```

`-sL` prints every address nmap would scan and resolves reverse DNS for each, a zero-noise way to sanity check your scope before you fire.

### No resolution
**Stop waiting on DNS.**

```bash
nmap -n $IP
```

`-n` skips reverse DNS entirely, which quietly shaves minutes off any scan spanning a large range.

### Force resolution
**Resolve even the dead ones.**

```bash
nmap -R $IP
```

`-R` forces reverse DNS lookups even for hosts that appear down, occasionally the fastest way to learn what a filtered box actually is.

### Custom resolver
**Bounce your lookups off someone else.**

```bash
nmap --dns-servers 1.1.1.1,8.8.8.8 $IP
```

`--dns-servers` sends your name queries through specific resolvers instead of the system's, which is both faster and a little quieter.

### Trace the path
**See the hops on the way in.**

```bash
sudo nmap --traceroute $IP
```

`--traceroute` maps the router path to each target as part of the scan, no separate tool required.

### IPv6 scan
**The other address space.**

```bash
sudo nmap -6 -sV 2001:db8::dead:beef
```

`-6` tells nmap to treat targets as IPv6, the half of the internet a lot of scans quietly ignore.

## Choosing a Scan

Experts pick a <u>scan technique</u> [to fit](https://nmap.org/book/man-port-scanning-techniques.html) the target and the firewall in front of it. Script kiddies run a default SYN scan at everything and wonder why it's slow.

### SYN scan
**The stealthy half-open default.**

```bash
sudo nmap -sS $IP
```

`-sS` sends a SYN, reads the reply, and never finishes the handshake, which is fast and light on the target's logs.

### Connect scan
**The one that works without root.**

```bash
nmap -sT $IP
```

`-sT` completes the full TCP handshake through the OS, the fallback when you lack raw socket privileges or you're stuck behind a [SOCKS proxy](/ssh-part-2/).

### UDP scan
**The services nobody audits.**

```bash
sudo nmap -sU --top-ports 50 $IP
```

`-sU` scans UDP, paired here with the 50 most common ports so it finishes this side of next Tuesday.

### ACK scan
**Map the firewall, not the ports.**

```bash
sudo nmap -sA $IP
```

`-sA` never reports open, it tells you which ports are filtered versus unfiltered, which is really a readout on whether the firewall is stateful.

### Window scan
**ACK scan with a lucky tell.**

```bash
sudo nmap -sW $IP
```

`-sW` reads the TCP window field on RST replies to guess open ports on the minority of stacks that leak that detail.

### Maimon scan
**A FIN/ACK the BSDs mishandle.**

```bash
sudo nmap -sM $IP
```

`-sM` sends a FIN/ACK probe that certain BSD-derived systems drop on open ports, exposing them.

### Null scan
**Zero flags, maximum sneak.**

```bash
sudo nmap -sN $IP
```

`-sN` sends a TCP packet with no flags set at all, which sails past some stateless filters and confuses simple loggers.

### FIN scan
**One flag, quietly.**

```bash
sudo nmap -sF $IP
```

`-sF` sets only the FIN bit, another way through non-stateful firewalls on RFC-compliant hosts.

### Xmas scan
**Light it up like a tree.**

```bash
sudo nmap -sX $IP
```

`-sX` sets FIN, PSH, and URG together so the packet is lit up like a Christmas tree, hence the name.

### SCTP init
**The SYN scan for SCTP.**

```bash
sudo nmap -sY $IP
```

`-sY` is the SCTP INIT scan, a clean open/closed/filtered read on the protocol that carries a lot of phone-network traffic.

### Cookie echo
**A subtler SCTP probe.**

```bash
sudo nmap -sZ $IP
```

`-sZ` uses an SCTP COOKIE ECHO chunk, less obvious than an INIT scan and able to slip past some non-stateful SCTP rules.

### Protocol scan
**Which protocols, not which ports.**

```bash
sudo nmap -sO $IP
```

`-sO` cycles through IP protocol numbers instead of ports to inventory what the host actually speaks, from ICMP to GRE.

### Idle scan
**Scan through a zombie, hands clean.**

```bash
sudo nmap -sI 10.20.30.99 $IP
```

`-sI` bounces the entire scan off an idle "zombie" host so not one packet from your real address ever reaches the target.

### FTP bounce
**Make an old FTP server do it.**

```bash
nmap -b anonymous@ftp-relay.local $IP
```

`-b` abuses a legacy FTP proxy feature to scan a target through a third-party server, mostly a museum piece now but occasionally still alive on the inside.

### Custom flags
**Design your own scan.**

```bash
sudo nmap --scanflags URGACKPSH $IP
```

`--scanflags` lets you set any combination of TCP flags by hand, for the day no canned scan type does the exact thing you need against a picky IDS.

### Version scan
**Name the software, not the port.**

```bash
sudo nmap -sV $IP
```

`-sV` interrogates each open port to identify the real product and version, turning "port 22 is open" into "OpenSSH 9.6, go check its CVEs."

## Selecting Ports

The default 1,000 ports are a convenience, not a promise. Bend the [port selection](https://nmap.org/book/man-port-specification.html) to the job.

### Every port
**All 65,535, no shortcuts.**

```bash
nmap -p- $IP
```

`-p-` scans the full TCP port range instead of the top 1,000, the only reliable way to catch a service hidden on a five digit port.

### Named ports
**Exactly these, nothing else.**

```bash
nmap -p 22,80,443,8080,8443 $IP
```

`-p` with a list scans precisely the ports you name, ideal for a fast targeted check.

### Port range
**A contiguous block.**

```bash
nmap -p 1-1024 $IP
```

`-p` with a range scans a continuous span, here the well-known ports below 1024.

### Top ports
**The statistically likely ones.**

```bash
nmap --top-ports 200 $IP
```

`--top-ports` scans the N most commonly open ports by nmap's own frequency data, a smart middle ground between fast and thorough.

### Fast pass
**The hundred that usually matter.**

```bash
nmap -F $IP
```

`-F` runs the fast scan, only the 100 most common ports, for when you need a first impression in seconds.

### Mixed protocols
**TCP and UDP in one shot.**

```bash
sudo nmap -sSU -p U:53,111,161,T:21-25,80,443 $IP
```

`-p U:` and `T:` split the port list across UDP and TCP in a single combined scan.

### Sequential order
**Turn off the shuffle.**

```bash
nmap -r $IP
```

`-r` scans ports in numeric order instead of nmap's default randomized sequence, which makes watching the output easier when you're debugging.

### Ports by name
**Select by service, not number.**

```bash
nmap -p http,https,ssh,ms-sql-s $IP
```

`-p` accepts service names straight from nmap-services, so you can say what you mean without memorizing port numbers.

### Exclude ports
**Skip the landmine.**

```bash
nmap -p- --exclude-ports 9100 $IP
```

`--exclude-ports` scans everything except the ports you name, and 9100 is the classic one to skip unless you enjoy printing forty pages of garbage.

### Protocol ratio
**Everything above a frequency floor.**

```bash
nmap --port-ratio 0.05 $IP
```

`--port-ratio` scans every port more common than the ratio you give, a tunable dial between `-F` and `-p-`.

## Fingerprinting

Getting a version and an OS out of a host is where a scan stops being an inventory and starts being [actionable intelligence](https://nmap.org/book/man-os-detection.html).

### OS detection
**Guess the operating system.**

```bash
sudo nmap -O $IP
```

`-O` fingerprints the OS from dozens of TCP/IP stack quirks and matches them against nmap's database of known signatures.

### Aggressive guess
**Take a swing even without a match.**

```bash
sudo nmap -O --osscan-guess $IP
```

`--osscan-guess` prints the closest OS matches with confidence percentages when there's no perfect fingerprint, better than a blank line.

### Limit OS scan
**Only fingerprint promising hosts.**

```bash
sudo nmap -O --osscan-limit $IP
```

`--osscan-limit` skips OS detection on hosts that lack both an open and a closed port, saving real time on a big sweep since the guess would be worthless anyway.

### Version intensity
**Try harder on stubborn services.**

```bash
sudo nmap -sV --version-intensity 9 $IP
```

`--version-intensity 9` throws every probe including the rare ones, for that service that refuses to identify itself at the default level.

### Light version
**A quick, cheaper guess.**

```bash
sudo nmap -sV --version-light $IP
```

`--version-light` caps probing at intensity 2, much faster and slightly less certain, which is the right trade on a wide scan.

### All probes
**Leave nothing untried.**

```bash
sudo nmap -sV --version-all $IP
```

`--version-all` ignores the rarity ranking and sends every probe against every port, the maximum-effort version pass.

### Aggressive mode
**The everything flag.**

```bash
sudo nmap -A $IP
```

`-A` bundles OS detection, version detection, default scripts, and traceroute into one flag, loud and slow but a great opening move on a single box.

### Version trace
**Watch the probing happen.**

```bash
sudo nmap -sV --version-trace $IP
```

`--version-trace` prints every version probe and response, invaluable when you're trying to understand why nmap guessed wrong.

### OS retries
**Cap the fingerprint attempts.**

```bash
sudo nmap -O --max-os-tries 1 $IP
```

`--max-os-tries 1` limits OS detection to a single attempt per host, trading a little accuracy for a faster finish.

### Predictability check
**Uptime and sequence guessing.**

```bash
sudo nmap -O -v $IP
```

`-O` with `-v` also reports the target's TCP sequence predictability and a boot-time guess, one being a spoofing hint and the other a patch-cadence tell.

## Tuning the Clock

Nmap's [timing controls](https://nmap.org/book/man-performance.html) are the difference between a scan that finishes over lunch and one that finishes over the weekend.

### Paranoid timing
**Slow enough to duck an IDS.**

```bash
sudo nmap -T0 $IP
```

`-T0` waits five minutes between probes, which is built for evading detection on a scan you're genuinely willing to leave running for days, so bring a book.

### Aggressive timing
**The sane fast default.**

```bash
sudo nmap -T4 $IP
```

`-T4` assumes a quick, reliable network and is the template I reach for on nearly everything modern.

### Insane timing
**Speed over certainty.**

```bash
sudo nmap -T5 $IP
```

`-T5` is the fastest template and will miss things on a shaky link, for when accuracy is a problem you're choosing to have later.

### Minimum rate
**Guarantee a floor.**

```bash
sudo nmap --min-rate 1000 $IP
```

`--min-rate 1000` forces at least 1,000 packets per second, the blunt instrument for finishing a huge scan on a deadline.

### Maximum rate
**Cap the noise.**

```bash
sudo nmap --max-rate 50 $IP
```

`--max-rate 50` holds the scan to 50 packets per second, which keeps you under a fragile link's tolerance or a rate-based alarm's threshold.

### Minimum parallelism
**Force more probes in flight.**

```bash
sudo nmap --min-parallelism 10 $IP
```

`--min-parallelism 10` keeps at least ten probes outstanding at once, speeding up a sluggish host at some risk to accuracy.

### Maximum parallelism
**One probe at a time.**

```bash
sudo nmap --max-parallelism 1 $IP
```

`--max-parallelism 1` serializes probes, a gentle way to treat a fragile embedded device that falls over under load.

### Minimum hostgroup
**Scan in bigger batches.**

```bash
sudo nmap --min-hostgroup 256 $IP/16
```

`--min-hostgroup 256` scans hosts in groups of at least 256, which finishes a wide sweep faster at the cost of getting results in chunks.

### Maximum hostgroup
**Get results sooner.**

```bash
sudo nmap --max-hostgroup 16 10.20.30.0/24
```

`--max-hostgroup 16` keeps batches small so host results start printing early instead of after the whole group completes.

### Retry cap
**Stop retransmitting so much.**

```bash
sudo nmap --max-retries 2 $IP
```

`--max-retries 2` limits probe retransmissions, a big speedup against a rate-limited host where nmap would otherwise retry ten times per port.

### Host timeout
**Cut your losses.**

```bash
sudo nmap --host-timeout 15m $IP/24
```

`--host-timeout 15m` gives up on any single host after fifteen minutes so one pathological box doesn't eat the whole scan.

### Scan delay
**Space the probes out.**

```bash
sudo nmap --scan-delay 1s $IP
```

`--scan-delay 1s` waits a full second between probes to a host, the classic way to stay under a "one reply per second" rate limit or a threshold-based IDS.

### Max scan delay
**Bound the adaptive slowdown.**

```bash
sudo nmap --max-scan-delay 100ms $IP
```

`--max-scan-delay 100ms` caps how far nmap will slow itself when it detects rate limiting, trading a little accuracy to keep the scan moving.

### RTT timeout
**Tighten the wait window.**

```bash
sudo nmap --max-rtt-timeout 200ms $IP
```

`--max-rtt-timeout 200ms` shortens how long nmap waits for a reply before giving up, a real time saver on a low-latency network.

### Beat RST limits
**Ignore reset rate limiting.**

```bash
sudo nmap --defeat-rst-ratelimit $IP
```

`--defeat-rst-ratelimit` stops nmap from slowing down to catch rate-limited RST packets, faster when you only care about open ports.

## Evasion and Spoofing

Firewalls and intrusion detection make mapping harder on purpose, and the [evasion options](https://nmap.org/book/man-bypass-firewalls-ids.html) are how you test whether those defenses actually hold. There's no magic flag here, only <u>tradecraft</u>.

### Fragment packets
**Split the header to blind filters.**

```bash
sudo nmap -f $IP
```

`-f` chops the packet into 8-byte fragments so a filter inspecting each piece alone can't see the whole TCP header, useless against anything that reassembles first.

### Custom MTU
**Pick your fragment size.**

```bash
sudo nmap --mtu 24 $IP
```

`--mtu 24` sets a specific fragment size (a multiple of 8), giving you finer control over the fragmentation trick than plain `-f`.

### Decoy scan
**Hide in a crowd of fakes.**

```bash
sudo nmap -D RND:10,ME $IP
```

`-D` makes it look like ten random addresses are scanning alongside you, burying your real IP in the noise while `ME` fixes your slot in the lineup.

### Spoof source IP
**Wear someone else's address.**

```bash
sudo nmap -S 10.20.30.5 -e eth0 -Pn $IP
```

`-S` forges the source address, which needs `-e` to name the interface and `-Pn` to skip discovery, and note you won't see replies since they go to the spoofed host.

### Source port
**Exploit a trusting firewall.**

```bash
sudo nmap --source-port 53 $IP
```

`--source-port 53` sends from port 53, walking straight through firewalls that blindly trust anything that looks like a DNS reply.

### Custom payload
**Append raw bytes.**

```bash
sudo nmap --data 0xdeadbeef $IP
```

`--data` tacks arbitrary hex onto each packet, useful for triggering a specific service behavior or just not looking like a stock probe.

### String payload
**Leave a readable note.**

```bash
sudo nmap --data-string "authorized scan, ticket 4412" $IP
```

`--data-string` embeds plain text in your packets, which is the polite move for an authorized engagement so a blue teamer sniffing the wire knows it's you.

### Pad the packet
**Add random length.**

```bash
sudo nmap --data-length 50 $IP
```

`--data-length 50` appends 50 random bytes to each probe so the traffic sheds the tell-tale minimalist nmap packet size.

### Spoof MAC
**Borrow a vendor's identity.**

```bash
sudo nmap --spoof-mac Cisco $IP
```

`--spoof-mac Cisco` rewrites your hardware address using a real Cisco vendor prefix, handy on a LAN that filters by MAC or logs by vendor.

### Bogus checksum
**Smoke out the middleboxes.**

```bash
sudo nmap --badsum $IP
```

`--badsum` sends deliberately invalid checksums that every real host drops, so any reply you get is coming from a firewall or IDS that forgot to check.

### IP options
**Bend the route.**

```bash
sudo nmap --ip-options R $IP
```

`--ip-options R` sets the record-route IP option, occasionally mapping a path to a target when a normal traceroute gets nowhere.

### Set the TTL
**Control the hop budget.**

```bash
sudo nmap --ttl 64 $IP
```

`--ttl 64` fixes the time-to-live on outgoing packets, useful for matching a target's expected values or probing exactly how far a filter sits.

### Shuffle targets
**Randomize the order.**

```bash
sudo nmap --randomize-hosts -iL scope.txt
```

`--randomize-hosts` scrambles the order you hit a host list, which smears the scan across a monitoring window instead of marching predictably through the range.

### Proxy chain
**Route through a proxy.**

```bash
nmap --proxies http://10.20.30.7:8080 -sV $IP
```

`--proxies` relays connections through an HTTP or SOCKS4 chain, and in all honesty it only affects the NSE and version-scan phases today, so don't count on it hiding your port scan.

### Pick interface
**Choose the exit.**

```bash
sudo nmap -e tun0 $IP
```

`-e` forces a specific interface, which matters the moment you're on a VPN and need traffic leaving through `tun0` rather than your default route.

## Scripting Engine

The [Nmap Scripting Engine](https://nmap.org/book/man-nse.html) is where nmap stops being a port scanner and starts being a small <u>automation platform</u>, and the [NSEDoc portal](https://nmap.org/nsedoc/) lists every script and its arguments.

### Default scripts
**The safe starter set.**

```bash
sudo nmap -sC $IP
```

`-sC` runs the default script category, a fast, mostly-safe batch that enriches almost any scan for free.

### Category scan
**Run a whole family.**

```bash
sudo nmap --script vuln $IP
```

`--script vuln` runs every script in the vuln category, checking for known weaknesses and staying quiet unless it actually finds one.

### Named script
**Just the one you want.**

```bash
sudo nmap --script ssh-hostkey -p22 $IP
```

`--script ssh-hostkey` runs a single script by name, here pulling the SSH host keys for fingerprint tracking.

### Wildcard scripts
**A whole prefix at once.**

```bash
sudo nmap --script "http-*" -p80,443 $IP
```

`--script "http-*"` loads every script whose name starts with `http-`, the fast way to throw the entire web toolkit at a server.

### Boolean selection
**Compose script sets.**

```bash
sudo nmap --script "default and safe" $IP
```

`--script "default and safe"` uses boolean logic to run only scripts in both categories, and you can nest `and`, `or`, and `not` for real precision.

### Force a script
**Ignore the port rule.**

```bash
sudo nmap --script +ms-sql-info -p1433 $IP
```

`--script +ms-sql-info` forces a script to run even when nmap didn't detect its service, perfect for a database parked on a nonstandard port.

### Script arguments
**Feed it inputs.**

```bash
sudo nmap --script http-brute --script-args userdb=users.txt,passdb=pass.txt $IP
```

`--script-args` passes parameters to scripts as key-value pairs, here handing a brute-force script your own wordlists.

### Args from file
**Keep secrets out of history.**

```bash
sudo nmap --script http-form-brute --script-args-file nse-args.txt $IP
```

`--script-args-file` reads those arguments from a file instead of the command line, so credentials stay out of your shell history.

### Script help
**Read the docs offline.**

```bash
nmap --script-help "smb-*"
```

`--script-help` prints a script's purpose and categories without running it, and it takes the same selection syntax as `--script`, no target required.

### Trace scripts
**Watch the conversation.**

```bash
sudo nmap --script smb-os-discovery --script-trace $IP
```

`--script-trace` prints every request and response a script makes, one layer above packet tracing and the fastest way to see why a script came back empty.

### Update database
**Reindex your scripts.**

```bash
sudo nmap --script-updatedb
```

`--script-updatedb` rebuilds the script database after you drop a new `.nse` file into the scripts directory, so it shows up in category and wildcard lookups.

### Broadcast discovery
**Find hosts nobody listed.**

```bash
sudo nmap --script broadcast-dhcp-discover
```

`--script broadcast-dhcp-discover` runs a prerule script that needs no target at all, shaking loose hosts and config by shouting on the local network.

## Output and Reading

A scan is only as good as what you can do with it afterward, so the [output formats](https://nmap.org/book/man-output.html) matter as much as the scan itself.

### All formats
**Save everything at once.**

```bash
sudo nmap -sV -oA WEB-01-EXTERNAL-scan $IP
```

`-oA` writes normal, XML, and grepable output together under one basename, which is what I actually run on anything worth keeping.

### XML output
**The machine-readable one.**

```bash
sudo nmap -sV -oX scan.xml $IP
```

`-oX` produces structured XML, the format every serious downstream parser and report generator expects.

### Grepable output
**One host per line.**

```bash
nmap -p- -oG scan.gnmap $IP
```

`-oG` writes one line per host so a quick `grep open scan.gnmap` beats writing a parser for a five minute question.

### Kiddie output
**Purely a joke.**

```bash
nmap -oS scan.txt $IP
```

`-oS` renders output in mock leetspeak, an option that exists entirely so nmap can make fun of script kiddies, and I've never used it for anything else.

### State reasons
**Why nmap decided that.**

```bash
sudo nmap --reason $IP
```

`--reason` shows the exact packet behind every verdict, so a `filtered` port comes with the evidence instead of just the label.

### Open only
**Cut the clutter.**

```bash
nmap --open $IP
```

`--open` hides closed and filtered ports so the report is just the things you can actually connect to.

### Packet trace
**See every packet.**

```bash
sudo nmap --packet-trace -p80 $IP
```

`--packet-trace` prints a summary of every packet sent and received, the single best way to actually understand what nmap is doing under the hood.

### Target list
**Feed hosts from a file.**

```bash
nmap -iL scope.txt -oA engagement-scan
```

`-iL` reads targets from a file, which is how real engagements run when the scope is a hundred hosts your DHCP server handed you.

## Scan You Later

That's 101, and if you skimmed straight down the code blocks without reading a single one liner, that's exactly what a cheat sheet is for. Bookmark it, keep it in the tab next to the [nmap 101 walkthrough](/nmap/) when you want the why behind any of these, and go run the ones you've never tried against a box you're allowed to touch. The tool rewards curiosity more than almost anything else in the kit, hope you got your coffee ready 😈
