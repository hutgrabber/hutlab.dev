---
title: The Hacker Mindset - DRAFT
date: 2024-09-19T14:17:42.000Z
layout: layouts/post.njk
permalink: /the-hacker-mindset/
tags:
  - posts
  - career
description: This blog aims to cover things that I believe are invaluable for anyone starting their journey as a penetration tester. That being said, there is also a section in the blog that intrigues people who are looking for something zesty.
meta_title: The Hacker Mindset
feature_image: /images/2024-09-19-hacker-mindset/cover.jpg
templateEngineOverride: md
---

> A guide to developing the mindset and toolset needed to work as a penetration tester.

---

# Preface

This post covers the things I believe are most useful for anyone starting out as a penetration tester, along with a more hands-on section for readers who want practical setup advice.

The topic is personal to me, because I am sharing the guidance I wish someone had handed me when I began. It ranges from building a problem-solving mindset to configuring your terminal for efficiency, and it should be useful whether you are new to the field or already working in it.

---

# Penetration Testing

Penetration testing, or "pen-testing," is the practice of deliberately probing a system to find weaknesses before a real attacker does. It is authorized, scoped, and controlled work meant to show an organization where its defenses fall short.

I am still early in my own journey, and it really is a craft. What carries you is not only technical skill and problem-solving, but a set of working habits that this post aims to cover. So grab a cup of coffee before you start — if you think breaking into networks is hard, wait until you try brewing the perfect medium-roast americano. It's like trying to crack Fort Knox with a butter knife.

---

# The Crash Test Dummy

<figure class="img-s">
  <img src="/images/2024-09-19-hacker-mindset/crash-dummy.jpg" loading="lazy">
</figure>

*Embracing controlled chaos.*

This section is written mainly for people who are just getting started. Early on, I wish someone had explained how important it is to build a habit of asking how something might break. For most pentesters this becomes automatic. Whenever you look at a system, ask: how can I break it? As a security engineer, you will meet a wide range of programs, scripts, binaries, and tools, and each one is a candidate for this kind of thinking.

Any program can be reduced to three parts: it takes in data, processes that data, and produces an output. Your job is to feed it inputs it does not expect. See a website with a shopping cart? Try entering `-1` as the quantity and clicking `add-to-cart`, then watch what happens. This kind of test targets weak input validation and business-logic flaws, which are among the most common issues in web applications. If the application trusts the client to send a sensible value, a negative quantity can lead to price manipulation or broken totals.

Keep testing assumptions, and keep learning from what breaks.

---

# Organize, Organize, Organize

<figure class="img-s">
  <img src="/images/2024-09-19-hacker-mindset/moving-parts.jpg" loading="lazy">
</figure>

*There are more moving parts than you think.*

A personal system of organization matters more than most beginners expect. If you do not already have one, use what follows as a starting point.

Once you have the list of machines you will engage with, create directories for them based on their IP addresses. Adapt the naming scheme to the engagement:

```
# When you know there is an internal & external network: 
./EXT-192-168-45-234 
./EXT-192-168-45-119 
./INT-10-10-7-50 
./INT-10-10-7-231 
 
# When you know what services are running on the systems: 
./MS-01-INTERNAL 
./DC-01-INTERNAL 
./WEB-01-EXTERNAL 
./WEB-02-EXTERNAL 
./MSSQL-01-INTERNAL 
./CONFLUENCE-02-INTERNAL 
./SPLUNK-01-MAIN-INTERNAL 
./DNS-01-EXTERNAL 
 
# When everything is on a single cloud service: 
./ELB-01-US-EAST 
./EC2-01-US-WEST 
./EC2-02-US-WEST 
./REDIS-01-MAIN-US-EAST 
./S3-01-LOGS 
./S3-02-IMAGE-CACHE 
./S3-03-USER-STORE
```

Organize the subdirectories to match the context of the engagement too. For a CTF, you might use a structure that sorts the artifacts you find (credentials, PDFs, binaries, source code, hashes, and so on) into their own categories as you go.

<figure class="img-s"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/ctf-tree.png"/></figure>

**A few tips for keeping a clear head:**

1. **Enumerate well.** Spend most of your time learning about the machines and making notes. Capture every detail of your target before you make a move. Double-check your scans and other reconnaissance, and enumerate each port more than once, using more than one method.
2. **Go step by step.** Do not interact with random targets and services at random. Build a mind-map, set a goal, and take small steps. Finish one target completely before moving to the next, and keep taking notes as you work.
3. **Understand the outcome.** Before you begin, know what the engagement actually requires. Not every test calls for gaining remote code execution with CrackMapExec, Impacket, and Metasploit. Automated and exploit tooling can damage production environments, sometimes irreversibly, so always confirm what your rules of engagement permit. Sometimes you only need a working proof of concept; other times you only need to demonstrate access to a few files.

A plan of action and a consistent system of organization will carry you a long way.

---

# Getting Those Hands Dirty

*You cannot learn to swim from a book, and pentesting works the same way.*

Let us talk about engagements. There are three core components: **the terminal**, **your notes**, and **your tools**. In this section we will look at each and set up a portable pentesting environment, so you are not tied to a single distribution such as Kali Linux.

The idea is simple: a smoother workflow leads to clearer thinking, which keeps your goals in sight. You do not want to lose momentum fumbling for commands or accidentally closing a session you cannot easily rebuild.

<figure class="img-xs"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/argh-meme.png"/></figure>

## Your Temple, The Terminal

<figure class="img-s"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/terminal-temple.jpg"/></figure>

I wish I had learned the power of Bash earlier, but better late than never. Any scripting knowledge is a valuable asset here. We are going to use aliases, shell functions, and a few terminal applications to remove repetitive friction from your workflow.

### Pin-Pointing the Problem

As you work through practice machines, watch your own workflow and note the tasks you repeat constantly. This differs for everyone, so I will focus on my own recurring tasks. Here are six of them:

1. When I start probing an IP, I export it as a shell variable for the current session. If the IP is `10.10.10.10`, I run `export IP=10.10.10.10` so I can reference `$IP` in later commands. (This variable only lasts for the current shell session.)
2. If a system runs a web server, I add it to `/etc/hosts` so I can reach it by hostname, which reduces web-based errors. I often fumble while adding the entry, and later forget to remove it.
3. Before an engagement, I usually connect to a VPN to reach the client's infrastructure, especially for remote tests. The same applies when practicing on platforms like TryHackMe or Hack The Box.
4. When working with the Nmap Scripting Engine (NSE), I keep forgetting script names, so I repeatedly browse the script directory and run `ls -la` just to find the one I want.
5. I work across multiple terminal windows or tabs: one for reconnaissance, one for servers or listeners, one for editing exploit code, and so on.
6. I use many tools that do not ship with Kali Linux. To keep things organized, I store them in `/opt`. They range from binaries and scripts to cross-platform executables.

### Designing the Solution

This is where things get more technical, but the payoff is worth it.

First, get your bash on!

<div class="video-embed"><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="" frameborder="0" loading="lazy" src="https://www.youtube.com/embed/SPwyp2NG-bE?feature=oembed" title="Embedded video"></iframe></div>

Many of you will already know NetworkChuck. He is a strong resource for beginners and experienced users alike, and he explains concepts through clear, real-world examples.

A quick note on structure: each shell function below can be run as a standalone script in a `script.sh` file, but a cleaner approach is to keep everything in one place. Create a file such as `~/.config/all_scripts.sh`, add your functions and aliases to it, and then add this line to the bottom of your `~/.zshrc` or `~/.bashrc`:

```bash
source $HOME/.config/all_scripts.sh
```

This makes every command available in each new shell. (The command is lowercase `source`, or you can use its shorthand, the dot: `. $HOME/.config/all_scripts.sh`.)

If you already understand how your shell works, let us put it to use. Over time I have written several functions and aliases that address the six problems above, plus many others. As of September 2024, the configuration is still a work in progress that I expect to finish by the end of December 2024, but it is usable today. You can clone the repository, follow the instructions, and build on what is already there.

"https://github.com/hutgrabber/hutgrabber-dots.git"

Look at the "pentest" folder, which holds the scripts that make life easier. Here is how they map to the six problems:

**1. Exporting IP addresses.** The `exip()` function exports the given IP to the current session, so you can use `$IP` instead of retyping your target's address.

```bash
function exip() { 
  export IP=$1 
  echo "Exported IP $1" 
}
```

**2. Adding hosts to `/etc/hosts`.** The `addhost()` and `rmhost()` functions add and remove hostname entries, with a safeguard that prevents you from emptying the file when you run `rmhost()` repeatedly. To set this up, add the string `### MARK ###` at the end of your current hosts file. `rmhost` will refuse to delete any line at or past this checkpoint.

```bash
# Setup 
# ===== 
# Before doing anything you need to add the "MARK" keyword 
# at the end of your /etc/hosts file so that this script 
# can detect it. This will prevent you from running the 
# 'rmhost' command through the entire file and causing damage :/ 
 
function addhost() { 
  ip=$1 
  shift 
  hostname="$@" 
  sudo /bin/zsh -c "echo \"$ip $hostname\" >> /etc/hosts" 
} 
 
function rmhost() { 
    # Check the last line of the file 
    last_line=$(sudo tail -n 1 /etc/hosts) 
    mark="MARK" 
 
    # Check if the last line is the protected line 
    if [[ "$last_line" =~ "$mark" ]]; then 
        echo "Don't Push It Partner -_-" 
    else 
        # Remove the last line 
        sudo /bin/zsh -c "sed -i '\$d' /etc/hosts" 
        echo "Removing:" 
        echo "$last_line" 
    fi 
} 
 
# Bonus Alias that prints out the contents of /etc/hosts to the terminal: 
alias hosts="cat /etc/hosts"
```

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/hosts-alias.png"/>
<figcaption>Fig: host aliasing</figcaption></figure>

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/addhost-demo.png"/>
<figcaption>Fig: addhost demo</figcaption></figure>

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/rmhost-demo.png"/>
<figcaption>Fig: rmhost demo</figcaption></figure>

**3. Handling VPNs.** I keep all my VPN files in one folder in my home directory and set up aliases that connect to each one. I am also building a function that prompts for the VPN I want and connects based on my input. A separate alias, `vpnip`, shows the address assigned to me after connecting, which saves me from running `ip addr` and scrolling through the output. Note that `vpnip` assumes an OpenVPN interface named `tun0`; adjust it if your interface differs.

```bash
# Connecting to VPNs easily 
alias connecthtb="sudo openvpn $HOME/vpns/htb-vip.ovpn" 
alias connectpg="sudo openvpn $HOME/vpns/universal.ovpn" 
 
# Bonus Content - Show your public IP & your assigned VPN-IP 
alias pubip="host myip.opendns.com resolver1.opendns.com | grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' | awk 'NR==2'" 
alias vpnip="ip -4 addr show tun0 | grep -oP \"(?<=inet\s)\d+(\.\d+){3}\""
```

**4. The Nmap Scripting Engine.** When I forget which NSE script I need out of the hundreds available, I run `nse` followed by a search string, such as `nse smb-` or `nse http-` (the hyphen is optional), and it searches the script names for me. On most systems these scripts live in `/usr/share/nmap/scripts/`, so you can also list them there directly if you prefer.

```bash
nse() { 
  nsedb=$"acarsd-info.nse\naddress-info.nse\nafp-brute.nse\nafp-ls.nse\nafp-path-vuln.nse\nafp-serverinfo.nse\nafp-showmount.nse\najp-auth.nse\najp-brute.nse\najp-headers.nse\najp-methods.nse\najp-request.nse\nallseeingeye-info.nse\namqp-info.nse\nasn-query.nse\nauth-owners.nse\[REDACTED FOR SANITY]" 
 
  local search_string="$1" 
  if [[ -z "$search_string" ]]; then 
    echo "Usage: nse <search_string>" 
    return 1 
  fi 
 
  echo "$nsedb" | grep -i "$search_string" 
}
```

**5. tmux.** If you are not familiar with tmux, typecraft is a good place to learn. Chris covers a range of command-line tools and has short series on both tmux and Neovim, which are central to how I work. My tmux and Neovim configs are in the `hutgrabber-dots` repository on GitHub.

<u>T-Mux Productivity Workflow</u>

<div class="video-embed"><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="" frameborder="0" loading="lazy" src="https://www.youtube.com/embed/niuOc02Rvrc?feature=oembed" title="Embedded video"></iframe></div>

**6. Back up your toolset.** To avoid losing your tools, store them in `/opt` and push them to GitHub. In my case, some are binaries, some are PowerShell scripts, and some are Windows executables. Keep in mind that public repositories are visible to everyone, so use a private repo for anything sensitive and avoid committing credentials or client data.

If you are new to Git, [my tutorial](/git-github/) walks through every step to help you **get-git-done**. See what I did there?

https://hutlab.dev/git-github/

My pentesting toolset lives in the repository below. It is still a work in progress but usable, and I expect to make more changes over the winter.

https://github.com/hutgrabber/pentesting-toolkit

### A Strong Recommendation

Learning Vim has been worth the effort for me. The learning curve is steep but manageable once you commit to it. Once the motions click, you write and edit code noticeably faster. The blogs below can help you learn Vim in small, manageable steps.

<u>NeoVIM: Getting Started</u>

<div class="video-embed"><iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="" frameborder="0" loading="lazy" src="https://www.youtube.com/embed/zHTeCSVAFNY?feature=oembed" title="Embedded video"></iframe></div>

**Additional Resources:** Barbarian-Meets-Coding is a great resource I found when lurking around the internet. The independent blogging community always comes in clutch.

https://www.barbarianmeetscoding.com/blog/exploring-vim

https://www.barbarianmeetscoding.com/boost-your-coding-fu-with-vscode-and-vim-exercises/03-moving-blazingly-fast-with-vim-motions/

https://www.barbarianmeetscoding.com/boost-your-coding-fu-with-vscode-and-vim/moving-blazingly-fast-with-the-core-vim-motions/

https://www.barbarianmeetscoding.com/boost-your-coding-fu-with-vscode-and-vim/cheatsheet/

## Note Taking

<figure class="img-xs"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/markdown-links-meme.png"/></figure>

If you tell yourself to "hold that thought," it is usually gone before you can act on it.

I want to close with one of the most important and most often skipped topics in cybersecurity: note-taking. The human brain is good at generating ideas and poor at storing them, so a reliable system for capturing, storing, and retrieving notes is essential. Everyone works differently, but as a penetration tester you will generally keep two types of personal documents.

The first is your knowledge base, where you store concepts, commands, and procedures you may need to revisit later.

The second is your walkthrough, which becomes the foundation for the official pentest report an organization uses to understand its threat posture. Treat the walkthrough as a running record: document what you do and what happens as you do it.

### The Knowledge Base

<figure class="img-s"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/markdown-meme.png"/></figure>

**A few use cases**:

1. Store notes on a tool you are learning, and use Git to back them up.
2. Keep a consolidated command sheet so you can quickly find something you have forgotten. This works well as a cheatsheet.
3. Write a step-by-step guide for any procedure you may not remember six months from now.

If you produce something genuinely useful, consider writing it up to share with the community.

One more thing: learn Markdown. It is a real quality-of-life improvement for note-taking.

I use **Obsidian** for notes and **Notion** for writing walkthroughs. Either one gives you a solid base to get started.

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/tunneling-note.png"/></figure>

### Walkthroughs

When you begin practicing machines on hacking platforms, write walkthroughs for them as you go. Create sections such as "Enumeration," "Initial Foothold," "Exploitation," and "Privilege Escalation," then fill them with the steps you took. As a beginner, be thorough. Record what you did, and also the ideas you considered and chose not to pursue.

Use Git to back up your notes to a private repository so nothing is lost. If you want to go further, GitBook is worth a look.

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/tips-note.png"/></figure>

---

# Conclusion

<figure class="img-m"><img alt="" class="kg-image" loading="lazy" src="/images/2024-09-19-hacker-mindset/desk-photo.jpg"/></figure>

We have covered a lot, and it may feel like a great deal to absorb at once. Mastering penetration testing is a journey, not a single milestone. We looked at building a hacker mindset, testing your assumptions, and staying organized. We also worked through the practical side: an efficient terminal environment, tools like tmux and Vim, and a reliable note-taking system. Each of these supports the same goal, which is your steady growth as a penetration tester.

So grab a coffee, open your terminal, and start exploring! If you have any questions, you know where to [find me](/about-me/).