---
title: All Things SSH - Part 2
date: 2026-07-09
layout: layouts/post.njk
permalink: /ssh-part-2/
tags:
  - posts
  - write-up
description: The sequel nobody asked for but everybody needed. We take SSH out of the sysadmin toolbox and into the red team bag - local, dynamic and remote port forwarding, SOCKS5 proxying, sshuttle, and a couple of Windows detours.
templateEngineOverride: md
feature_image: /images/2026-07-09-ssh-part-2/cover-image.png
---
<!-- TODO before publishing: still need a cover image for feature_image. Diagrams are done, sitting in src/images/2026-07-09-ssh-part-2/. -->

It has been a hot minute since [Part 1](/ssh-part-1/), hasn't it? Back then we covered the absolute basics - installing OpenSSH, generating keys, getting `ssh-copy-id` to do the boring work for you, and poking around the config file until it obeyed. I promised two follow-ups at the end of that post: one on hardening an ssh server, and one on using ssh as an actual tool in an engagement. This is the second one. The hardening post is still sitting in the drafts folder, judging me quietly.

So today we're not talking about ssh as "the thing you use to log into your homelab." We're talking about ssh as a pivoting engine - the tool that turns one compromised box into a doorway for every network sitting behind it. If you've ever done a HackTheBox pro lab, an internal pentest, or basically any engagement with more than one subnet, you already know where this is going.

<u>A quick disclaimer before we start</u>, because I don't want anyone getting the wrong idea: everything below assumes you're on an authorized engagement, a CTF, or your own lab. Pivoting through networks you don't have permission to be in is a great way to turn a fun Tuesday into a conversation with a lawyer.

> [!warning] Scope, always
> Port forwarding and tunneling are neutral tools. Whether they're "hacking" or "system administration" depends entirely on whether you were invited. Get your rules of engagement in writing before any of this touches a client network.

---

## Why SSH

**Why adversaries (and you) love it**

Every internal network I've ever poked at has had ssh sitting somewhere - usually on a Linux box that's dual-homed between two network segments, quietly bridging a world the firewall would otherwise never let you touch. A few reasons ssh keeps showing up on both sides of the fence:

- It's usually already installed. No dropping a binary, no AV alerting on a weird process.
- The traffic is encrypted by default, so a blue team watching packet contents doesn't get much for free.
- Port 22 outbound is very commonly allowed, because half the org's automation depends on it.
- It does four completely different jobs - shell access, file transfer, port forwarding, and SOCKS proxying - with the same binary and the same credentials.

That last point is the whole reason this post exists. Once you have a foothold with ssh access, you effectively have a Swiss Army knife for reaching everything that box can reach, without dropping a single extra tool on disk.

---

## The Lab

**One layout we'll reuse for every technique below**

Let's use one consistent lab layout for the rest of this post, because jumping between made-up IPs every section gets confusing fast. Picture three networks stacked behind each other:

```
Kali (you) ---- 192.168.50.0/24 ---- confluence01 ---- 10.4.50.0/24 ---- pgdatabase01 ---- 172.16.50.0/24 ---- hr_shares
```

`confluence01` is your beachhead - you popped a shell on it through some exposed web app, and it happens to be dual-homed, sitting on both your network and the `10.4.50.0/24` internal range. From there, `pgdatabase01` is reachable, and it turns out *that* box is also dual-homed into a third, even more internal network where `hr_shares` lives with port 445 open. Classic onion.

None of these techniques care whether the "compromise" step was a web shell, a reverse shell, or you just SSH'd in with harvested creds - the moment you have command execution and an ssh client on the pivot box, the rest of this applies.

<figure class="img-l">
  <img src="/images/2026-07-09-ssh-part-2/topology-overview.svg" alt="Three subnets connected by two dual-homed pivot boxes, confluence01 and pgdatabase01, with no direct route from Kali to hr_shares" loading="lazy">
  <figcaption>Figure - the lab: three subnets, two dual-homed pivots, and no straight line from you to the target</figcaption>
</figure>

---

## SSH Tunneling

**Same binary, five different shapes**

Everything from here on out is still just `ssh`, pointed at different flags. The only thing that changes is which direction the connection gets initiated in, and whether you're forwarding one specific port or an entire SOCKS proxy. Pick the section below that matches your situation.

### Local Forwarding

**Reaching through the box**

This is the one most people learn first because it maps almost one-to-one onto "I want to talk to a port that isn't mine directly." The syntax:

```bash
ssh -N -L 0.0.0.0:LOCAL_PORT:TARGET_IP:TARGET_PORT user@middle_system
```

`-L` binds a port on your side of the connection and tunnels anything sent to it, through the ssh session, out the other end to whatever IP and port you specified. `-N` tells ssh not to bother opening a shell - just hold the tunnel open. In our lab, if I'm sitting on `confluence01` and want to reach `hr_shares` on port 445 through `pgdatabase01`:

```bash
# run from confluence01
ssh -N -L 0.0.0.0:4455:172.16.50.217:445 database_admin@10.4.50.215
```

Now anything I send to `127.0.0.1:4455` on `confluence01` gets forwarded, through the tunnel, to port 445 on `hr_shares`. From my Kali box I'd first need to reach `confluence01` itself (another local forward, or just be sitting on it directly), and then I can run tools against `127.0.0.1:4455` as if `hr_shares:445` were sitting right in front of me:

```bash
# from wherever you can reach the forwarded port
smbclient -L //127.0.0.1 -p 4455 -U 'someuser'
```

The catch with `-L` is that you need to already know what you're aiming at. It's precise, but it doesn't help you discover what else might be sitting on that internal network. For that, we need something more permissive.

<figure class="img-l">
  <img src="/images/2026-07-09-ssh-part-2/local-forward.svg" alt="Diagram of ssh -L tunneling one bound port from Kali through confluence01 and pgdatabase01 to hr_shares port 445" loading="lazy">
  <figcaption>Figure - one bind, one path: -L is a single dedicated straw through the pivot chain</figcaption>
</figure>

### Dynamic Forwarding

**Turn a box into a SOCKS proxy**

This is the one that actually changes how you work. Instead of forwarding one specific port, `-D` turns your ssh connection into a SOCKS5 proxy - anything you point at it gets routed through the tunnel to wherever it was destined, no pre-planning required.

```bash
ssh -N -D 0.0.0.0:OPEN_NEW_PORT user@middle_system
```

From `confluence01`, forwarding straight into the `10.4.50.0/24` range where `pgdatabase01` lives:

```bash
ssh -N -D 0.0.0.0:9999 database_admin@10.4.50.215
```

Then on Kali, tell proxychains about it by adding a line to `/etc/proxychains4.conf`:

```
socks5 192.168.50.63 9999
```

And now every proxychains-wrapped command you run gets routed through `confluence01`, straight into `10.4.50.0/24`, using nothing but the ssh session you already have:

```bash
proxychains4 smbclient -L //172.16.50.217/ -U 'username' -P='Passw0rd!'
proxychains4 nmap -v -sT 172.16.50.217 -p 4800-4900 -T5 -Pn -n
```

<u>Two gotchas that will save you time</u>:

1. SOCKS proxies can't do raw sockets, so `nmap` has to fall back to a full TCP connect scan - `-sT`, never `-sS`. If you run a default nmap scan through proxychains and get nothing back, this is almost always why.
2. Add `-Pn -n` religiously. `-Pn` skips the host discovery ping (which won't survive a SOCKS proxy anyway), and `-n` skips DNS resolution so you're not waiting on lookups that will just time out.

If you're running a binary compiled for a different architecture than your pivot box - say an x86 tool you need to run through a container that's actually ARM, or vice versa - `qemu-x86_64-static` will happily run it for you, proxychains and all:

```bash
qemu-x86_64-static /usr/bin/proxychains4 qemu-x86_64-static ./some_x86_binary
```

Worth knowing that `qemu-x86_64-static` doesn't understand your `$PATH` - always give it absolute paths, or it'll stare back at you blankly.

<figure class="img-l">
  <img src="/images/2026-07-09-ssh-part-2/dynamic-forward.svg" alt="Diagram of ssh -D turning confluence01 into a SOCKS5 proxy that proxychains can route any traffic through, reaching both pgdatabase01 and hr_shares" loading="lazy">
  <figcaption>Figure - one tunnel, any destination: -D hands proxychains a whole subnet instead of one port</figcaption>
</figure>

### Remote Forwarding

**When the firewall only lets traffic out**

Sometimes the box you're on can only be reached on one specific inbound port - say `confluence01` only has 8090 open because that's where its web server lives, and everything else inbound gets dropped by a firewall. In that situation, `-L` is useless, because nobody can connect *to* your forwarded port from the outside. You need the connection to go the other way.

```bash
# run from confluence01
ssh -N -R 127.0.0.1:OPEN_NEW_PORT:INTERNAL_IP:PORT kali_user@kali_IP -v
```

This opens a port on *your* attack machine's loopback and binds it to a target reachable from `confluence01`:

```bash
ssh -N -R 127.0.0.1:5555:10.4.50.215:5432 hutgrabber@coffeetom -v
```

Now on your Kali box, `127.0.0.1:5555` gets you straight to `pgdatabase01` on port 5432, even though nothing on that internal network could ever have reached out to you first. `confluence01` initiated the connection outbound, and ssh does the rest.

> [!note] If password auth is your only option
> Reverse forwards like this often get set up during initial access, before you've had a chance to drop keys anywhere. If you're authenticating with a password instead of a key, double check `PasswordAuthentication yes` is actually set in `/etc/ssh/sshd_config` on whichever box is acting as the ssh server in this pairing - it's a surprisingly common thing to trip over mid-engagement.

<figure class="img-l">
  <img src="/images/2026-07-09-ssh-part-2/remote-forward.svg" alt="Diagram of ssh -R showing confluence01 initiating an outbound connection to Kali to open a reverse tunnel, since inbound traffic to confluence01 is firewalled" loading="lazy">
  <figcaption>Figure - same tunnel, flipped: the victim dials out to you instead of the other way around</figcaption>
</figure>

### Remote Dynamic Forwarding

**Full SOCKS, backwards**

Combine the last two ideas and you get remote dynamic forwarding: instead of forwarding one specific port back to you, the victim box opens a full SOCKS proxy pointed at *your* attack machine.

```bash
# run from the victim box
ssh -N -R OPEN_NEW_PORT kali_user@attack_IP
```

```bash
ssh -N -R 9998 hutgrabber@attack_IP
```

Then add the usual line to proxychains, except this time it's pointed at your own loopback, because that's where the tunnel terminates:

```
socks5 127.0.0.1 9998
```

```bash
proxychains nmap -sT -vvv -p 1-1000 10.4.50.215 -T5 -sCV
```

This one has an extra trap worth calling out explicitly: if the box you're pivoting through is dual-homed - one interface facing a network you can already reach, another facing something more internal - make absolutely sure you're targeting the *internal* IP in your commands, not the external one. Probing the wrong interface will just quietly return nothing, and you'll spend twenty minutes assuming the proxy is broken when it's actually working fine.

<figure class="img-l">
  <img src="/images/2026-07-09-ssh-part-2/remote-dynamic-forward.svg" alt="Diagram of ssh -R with no target, opening a full reverse SOCKS5 proxy from confluence01 back to Kali, which proxychains then uses to reach both internal subnets" loading="lazy">
  <figcaption>Figure - the reverse of -D: the SOCKS proxy ends up sitting on your machine, not theirs</figcaption>
</figure>

### sshuttle

**When you'd rather not think about it**

Sometimes you don't want a SOCKS proxy, you want something closer to an actual VPN - full subnet routing without wrapping every single command in `proxychains`. That's what `sshuttle` is for.

```bash
sshuttle -r user@ip_address:port SUBNET_1/CIDR SUBNET_2/CIDR
```

```bash
sshuttle -r database_admin@192.168.50.63:2222 10.4.50.0/24 172.16.50.0/24
```

Once that's running, traffic destined for either subnet just... works, transparently, no proxychains prefix needed. The catch is the requirements: root privileges on your ssh client side, and Python 3 available on whatever's acting as the ssh server. That second one trips people up more than you'd expect - not every pivot box has Python sitting around, especially the more locked-down ones.

---

## Beyond Linux

**ssh.exe and plink, for when the box isn't Linux**

Windows 10 builds 1709 and later ship the full OpenSSH suite pre-installed at `%systemdrive%\Windows\System32\OpenSSH\`. If you land on a foothold and want to know whether it's available:

```cmd
where ssh
```

If it's there, every technique above works exactly the same, just from a `C:\>` prompt instead of a `$`:

```cmd
C:\Users\rdp_admin> ssh -N -D 9999 hutgrabber@kali_IP
```

If for some reason the box doesn't have OpenSSH but does have PuTTY's command-line sibling, `plink` covers most of the same ground - local, dynamic, and remote forwarding all work. The one thing it can't do is remote *dynamic* forwarding, so if that's the technique your pivot chain needs, plink alone won't get you there and you'll need to find another way to drop a real ssh client.

---

## Wrapping This One Up

That's the red team side of ssh - the same binary you used in Part 1 to log into your NAS is, with a handful of flags, a full pivoting toolkit: local forwards for precision, dynamic forwards for a proper SOCKS proxy, remote forwards for firewalls that only let traffic leave, and sshuttle for when you'd rather not think about it at all.

The hardening post - locking down `sshd_config` so none of this works against *you* - is still coming. I'm not going to promise a date this time, past-me has clearly not earned that trust.

Until then: happy tunneling, and remember to actually clean up your forwards when you're done. Nothing embarrasses a pentester quite like a dangling SOCKS proxy showing up in someone else's final report.
