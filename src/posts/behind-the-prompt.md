---
title: behind the prompt
date: 2026-07-14
layout: layouts/post.njk
permalink: /dotfiles/
tags:
  - posts
  - write-up
description: A tour through my actual terminal setup. zsh, starship, tmux, Neovim, GNU Stow, and the small scripts that hold it together, on an M1 Mac that occasionally has to fight its own processor.
templateEngineOverride: md
feature_image: /images/2026-07-14-dotfiles/cover-image.png
---
People keep asking what's actually inside that dotfiles repo I keep linking at the bottom of every post. I've dropped the link enough times that it feels dishonest not to actually walk you through it, so here it is: everything I run, why I run it, and the handful of scripts I wrote myself and signed like a graffiti tag because apparently that's a thing I do now.

https://github.com/hutgrabber/hutgrabber-dots

This isn't a "10 tools to 10x your terminal" listicle. Some of what's below I use every single day. Some of it I installed once, got scared of, and never opened again. I'll tell you which is which.

---

# The Foundation

## Why macOS

I run an M1 Max, and the honest answer for why is boring: battery life that survives a full day of engagements without hunting for an outlet, and a Unix underneath that means `ssh`, `git`, and a real `/bin/zsh` were already sitting there before I installed a single thing. Darwin is a certified Unix. That's not marketing, it's an actual certification macOS has held since Leopard. Practically what that means for me is that almost every tool built for Linux either runs unmodified or is a `brew install` away.

[Homebrew](https://brew.sh/) is doing a lot of quiet work here. It's the package manager macOS should have shipped with and didn't, so the community built one. `brew install ripgrep`, `brew install --cask ghidra`, done. I don't have a Brewfile checked into the dotfiles repo yet, which is a little embarrassing given how much this post is about tracking configuration properly. It's on the list.

Windows gets a fair shake too. WSL closed most of the gap, and if you're doing Windows internals or AD work there's no substitute for actually running Windows. But WSL existing at all is a tell: the fastest way to make Windows a good development environment was to put Linux inside it.

## The ARM Tax

Apple Silicon is fast and quiet and I have zero regrets about the chip. What I do have regrets about is every tool, binary, or CTF challenge that assumes you're on x86_64, which is still most of them.

### Reversing x86 on Apple Silicon

Static analysis is fine. Ghidra and IDA don't care what CPU they're running on, they're just reading bytes and drawing graphs, so disassembling an x86 binary on an ARM Mac works exactly like it would anywhere else. The pain shows up the moment you want to actually run the thing. Debugging a live process, attaching `gdb`, watching a binary hit a breakpoint mid execution, all of that needs an environment where the binary's instructions match the CPU underneath it. An M1 can't natively execute x86_64 machine code, full stop, so every "just run it and see" step in a workflow suddenly needs a plan.

### The Escape Hatches

#### **qemu, and its limits**

`qemu-x86_64-static` will emulate an x86_64 binary well enough to execute it on ARM, translating instructions on the fly. I've leaned on this exact trick before, it shows up in [Part 2 of the SSH series](/ssh-part-2/) for running a statically linked ssh client through a pivot box with the wrong architecture. It works, but it's slow because every instruction is being translated rather than executed natively, and it doesn't help you at all if the binary needs a specific kernel feature, a driver, or hardware access that the emulation layer just doesn't provide.

```bash
# run an x86_64 binary on an ARM host, absolute paths only
qemu-x86_64-static ./some_x86_binary
```

#### **Cloud VMs**

When emulation isn't enough, the fix is to stop pretending and just get real x86_64 hardware, rented by the hour. I wrote up the full process in [Bring Your Own Image](/bring-your-own-image/): take your custom `.ova`, convert it down to `.qcow2`, upload it to a Digital Ocean Space, and boot it as an actual x86_64 Droplet. No emulation, no translation layer, just a real x86 CPU somewhere in a data center that happens to be an `ssh` command away.

#### **Borrowing a Friend's Tower**

And sometimes none of that is fast enough, usually because it's 11pm and an assignment is due at midnight and I don't have time to convert a disk image. In that situation the fastest x86 machine I have access to is whichever friend still hasn't gone to sleep and owns a gaming PC. Not glamorous, extremely effective, and a reminder that sometimes the best tool is a text that says "hey, can I remote into your desktop for twenty minutes." Lol

---

# The Toolkit

## ZSH

### The Shell Lineup

Before getting into what I've configured, it's worth being honest about why zsh specifically, since there are three other reasonable answers sitting right next to it.

| Shell                                      | What it's actually for                                                                                                                             | Why it's not my daily driver                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [dash](https://man.cx/dash)                | The "Debian Almquist" shell is default `/bin/sh` on Debian and Kali. Strict POSIX, starts instantly, has no interactive comforts whatsoever.       | It's built to run scripts fast, not to be typed into by a human all day.                                                                                                   |
| [bash](https://www.gnu.org/software/bash/) | The shell that ran the internet for two decades and still runs most of it.                                                                         | Perfectly fine, genuinely. Zsh does everything bash does and then keeps going.                                                                                             |
| [fish](https://fishshell.com/)             | Sane defaults out of the box: autosuggestions and syntax highlighting with zero plugins installed.                                                 | It isn't POSIX compatible on purpose. `export VAR=val` becomes `set -x VAR val`, and every install script or one-liner you copy from the internet needs translating first. |
| [zsh](https://www.zsh.org/)                | POSIX-compatible enough that everything written for bash or sh just runs, plus a plugin ecosystem and a scripting language that doesn't fight you. | This one, I daily drive :)                                                                                                                                                 |

### Why ZSH Won

Zsh ships with a POSIX compatibility mode, and more importantly its everyday syntax stays close enough to bash and the POSIX shell spec that anything I copy from a man page, a `curl | sh` installer, or a reverse shell one liner just runs without translation. That matters more than it sounds like it should when half your job involves pasting commands you found five minutes ago into a terminal you don't fully trust yet.

https://youtu.be/1jE7rCvByHg?si=SD3FEx9MypgHxqoZ

Apple made it the default shell starting with Catalina in 2019, and the reason is a fun bit of trivia: newer versions of bash are licensed under GPLv3, which Apple avoids across their entire OS, so they froze macOS's bundled bash at an old GPLv2 version and switched the default to zsh instead. Zsh's license has no such baggage. So the "why zsh" answer is really two answers stacked on top of each other: it's compatible enough to be boring in the best way, and Apple's lawyers agreed.

## Shell Environment: Starship + Oh My Zsh

### What Each One Actually Does

These two get confused for doing the same job, so it's worth being precise. [Oh My Zsh](https://ohmyz.sh/) is a framework: it manages plugin loading order, ships a library of community plugins, and sets a handful of sane zsh options. [Starship](https://starship.rs/) is a completely separate binary, written in Rust, that renders the actual prompt line. I use Oh My Zsh purely for plugin management (`zsh-autosuggestions` and `zsh-syntax-highlighting`) and let Starship own the prompt entirely, instead of using an Oh My Zsh theme. The advantage is that Starship's config is a single `toml` file that would work identically if I ever switched to bash or fish, where an Oh My Zsh theme would just stop existing.

```bash
# from .zshrc, the actual load order
source $HOME/.config/omz/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
source $HOME/.config/omz/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
source $HOME/.config/omz/hacking.zsh
source $HOME/.config/omz/aliases.zsh
source $HOME/.config/omz/environment.zsh
eval "$(starship init zsh)"
```

Starship gets initialized last on purpose, so it wraps whatever prompt state the rest of the config has already set up. The payoff is that the same character in the prompt tells me what mode I'm in without reading anything: a normal arrow when I'm typing, a different glyph the instant I drop into Neovim's command mode inside a subshell.

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/starship-prompt.svg" alt="Starship prompt rendering the same line in insert mode and normal mode, with the character symbol changing shape" loading="lazy">
  <figcaption>Figure — the vim-aware character symbol, catppuccin_mocha palette</figcaption>
</figure>

If you'd rather watch one of these get built from a blank file instead of reading a TOML dump:

https://www.youtube.com/watch?v=G7aWxK4395Y

Starship isn't just a colored arrow. It reads whatever context the current directory happens to be sitting in and renders a different set of modules each time, silently, without me telling it anything:

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/starship-modules.svg" alt="Six different prompt renders across a python project, a node project, a terraform workspace, a failed command, a low battery, and a slow command, each pulling in different starship modules" loading="lazy">
  <figcaption>Figure — one config, and the prompt reshapes itself per directory, per exit code, per battery level</figcaption>
</figure>

### Inside My omz/ Folder

`$ZSH_CUSTOM` normally points inside the hidden `.oh-my-zsh` install directory, which means your actual customizations live buried inside someone else's cloned repo. I pointed mine at `$HOME/.config/omz/` instead, which is a folder that lives in my own dotfiles repo and gets sym-linked into place by Stow (an amazing terminal utility, we will talk about soon). Nothing I've written is at risk of getting nuked by an Oh My Zsh update.

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/omz-plugin-tree.svg" alt="Diagram of the ZSH_CUSTOM folder structure on the left, feeding into the exact source order inside .zshrc on the right, ending with starship init" loading="lazy">
  <figcaption>Figure — the folder on the left, the load order it actually gets sourced in on the right</figcaption>
</figure>

The two plugins doing the quiet work in that load order are `zsh-syntax-highlighting` and `zsh-autosuggestions`, both community plugins, neither one part of Oh My Zsh's own theme system:

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/omz-autosuggest.svg" alt="Terminal showing a greyed-out autosuggestion tail while typing an ssh command, a known command turning green, and a typo turning red before it is even run" loading="lazy">
  <figcaption>Figure — a guess pulled from history, and a typo caught before enter</figcaption>
</figure>

#### **The Aliases**

The full list lives in `aliases.zsh`, but the ones I actually type without thinking:

```bash
alias g="git"
alias gs="git status"
alias gcm="git commit -m"
alias gits="cd $HOME/Developer/Projects/git-repos/"
alias conf="cd $HOME/.config/"
alias zsrc="source $HOME/.zshrc"
alias v="nvim"
```

`zsrc` alone has saved me an unreasonable number of "why isn't this alias working" moments that turned out to just be an unsourced shell.

#### **The Functions**

A handful of these have already shown up on this blog before, back in [The Hacker Mindset](/the-hacker-mindset/), which walked through the `addhost`/`rmhost` pair and their `MARK` checkpoint trick in more depth than I'll repeat here. The short version of what lives in `hacking.zsh`:

```bash
mcd() {
    mkdir -p -- "$1" && cd -P -- "$1";
}

serve() {
    PORT=$1
    DIR=$2
    python3 -m http.server "$PORT" --directory "$DIR"
}

exip() {
  export IP=$1
  echo "Exported IP $1"
}
```

`mcd test` makes a directory and drops you into it in one step. `serve 8080 .` starts a quick HTTP server for grabbing files off a target or serving a payload. `exip 10.10.10.10` exports `$IP` so every scan afterward can just reference `$IP` instead of me retyping an address I'll definitely fat finger by the third command.

And in the interest of the honesty this whole post is supposed to have: `environment.zsh` currently has a function defined as `funtion addkey()`, missing the second `c`. It's been broken for longer than I'd like to admit, and I only noticed while writing this paragraph. Achieving a perfectly clean dotfiles repo is apparently also hard.

## Layer 2: bat, Not cat

[bat](https://github.com/sharkdp/bat) is a `cat` replacement with syntax highlighting, git gutter markers, and automatic paging through `less` when the output is long. I already use it daily, it's the reason there's a `Catppuccin Mocha.tmTheme` file sitting in `.config/bat/themes/`, matching the same palette Starship uses so a file preview and a prompt don't look like they came from two different decades.

<figure class="img-h1">
  <img src="/images/2026-07-14-dotfiles/cat-output.svg" alt="cat printing a config file as a flat, unhighlighted wall of text" loading="lazy">
  <figcaption>cat: readable, but flat</figcaption>
</figure>

<figure class="img-h2">
  <img src="/images/2026-07-14-dotfiles/bat-output.svg" alt="bat printing the same config file with syntax highlighting, line numbers, and a git gutter marker" loading="lazy">
  <figcaption>bat: same file, and you can see what changed</figcaption>
</figure>

```bash
bat sshd_config
bat --diff main.py          # only show hunks that changed against git
bat -A payload.sh           # show tabs, spaces, and line endings explicitly
```

I haven't fully aliased `cat` to `bat` system wide. Scripts that pipe `cat` output somewhere else don't need syntax highlighting getting mixed into the stream, so I keep both around and reach for the right one on purpose.

## Neovim

### Picking a Distro

"Just configure Neovim yourself" is technically true and a great way to lose a weekend. Most people start from a distribution instead, and there are enough of them now that picking one is its own decision. And before anyone accuses me of overcomplicating a text editor, I'd like the record to show this joke has been sitting there since 2014 and remains completely undefeated:

https://x.com/iamdevloper/status/435555976687923200

Choosing LazyVim didn't fix that joke. Nothing fixes that joke. It's not really about exiting anymore, it's about the fact that we keep doing this to ourselves on purpose.

| Distro | Philosophy |
|---|---|
| Vanilla Neovim | You write every line of `init.lua` yourself. Total control, zero defaults. |
| [kickstart.nvim](https://github.com/nvim-lua/kickstart.nvim) | A single heavily commented file meant to be read and forked, not installed as is. Built for learning the pieces. |
| [NvChad](https://nvchad.com/) | Fast and visually polished out of the box, with its own theming layer on top. |
| [AstroNvim](https://astronvim.com/) | Community maintained, plugin manager agnostic, leans on community plugin packs. |
| [LazyVim](https://www.lazyvim.org/) | A full featured, IDE like setup built on `lazy.nvim`, structured so every plugin is its own file you can add, remove, or override. |

### Why LazyVim

LazyVim wins for me because extending it never means fighting it. Every plugin is just a Lua file that returns a table, and dropping a new file into `lua/plugins/` is the entire process for adding something new. Turning on a whole feature set, like JSON language support or ESLint integration, is a one line import in `lazy.lua`:

```lua
spec = {
    { "LazyVim/LazyVim", import = "lazyvim.plugins" },
    { import = "lazyvim.plugins.extras.lang.json" },
    { import = "lazyvim.plugins.extras.ui.mini-animate" },
    { import = "lazyvim.plugins.extras.linting.eslint" },
    { import = "lazyvim.plugins.extras.formatting.prettier" },
    { import = "lazyvim.plugins.extras.lsp.none-ls" },
    { import = "plugins" },
}
```

It's also worth saying out loud: a solid chunk of the plugins doing the real work here, `lazy.nvim` itself, `which-key.nvim`, `todo-comments.nvim`, `tokyonight.nvim`, `persistence.nvim`, `noice.nvim`, `trouble.nvim`, `flash.nvim`, come from the same author, [folke](https://github.com/folke). LazyVim isn't just built by one person, it's built by someone who also personally maintains half the ecosystem it depends on, which is a strange amount of leverage for one GitHub account to have over my daily workflow.

For a full walkthrough of getting from a blank Neovim install to something that resembles this setup:

https://www.youtube.com/watch?v=N93cTbtLCIM

### The Plugins That Earn Their Keep

#### **Finding things**

LazyVim's default picker in this config is [fzf-lua](https://github.com/ibhagwan/fzf-lua) rather than Telescope, fuzzy finding files, buffers, and live grep results without leaving the editor. Which, funny enough, makes the "fzf" entry later in this post's wishlist section a little dishonest: a Lua reimplementation of fzf's matching algorithm has been running inside Neovim this whole time, I just haven't reached for the standalone binary at an actual shell prompt yet.

#### **Git, without leaving the editor**

`gitsigns.nvim` puts change markers in the gutter and lets you stage or preview hunks inline. `lazygit.nvim` goes further and pops the full [lazygit](https://github.com/jesseduffield/lazygit) terminal UI open in a floating window, so committing, branching, and resolving a merge conflict never requires switching to a different tmux pane.

#### **Everything else**

`which-key.nvim` shows every available keybinding the moment you pause after pressing the leader key, tuned to a 500ms delay so it doesn't flash up on every normal keystroke. `todo-comments.nvim` lets me jump between `TODO` and `FIXME` comments with `]t` and `[t`, which given how many TODOs are scattered through this dotfiles repo alone is doing more work than I'd like to admit. `mason.nvim` auto installs language servers and formatters, including `write-good`, a prose linter, which means the tool checking my code style is technically also available to check the grammar in this very sentence. `nvim-cmp` runs completion, with `<C-space>` to trigger it manually when it's being shy.

### The Colorscheme Situation

The plugin list installs five full colorschemes: Nord, Tokyo Night, Rose Pine, Dracula, and Catppuccin. Exactly one of them, Catppuccin Mocha, is actually set as the default. I've also overridden its `base`, `mantle`, and `crust` colors to pure black, because the standard Mocha background is a very dark purple and I wanted something closer to true black for max contrast in a terminal that's already dim most of the time I'm using it. So the honest inventory is four colorschemes I paid the install cost for and never look at, sitting there in case future me changes his mind, which is a very specific kind of commitment issue.

### A Few Keymaps Worth Stealing

```lua
keymap.set("i", "jk", "<ESC>", { desc = "Exit insert mode with jk" })
keymap.set("n", "x", '"_x', { desc = "Delete without saving to register" })
opt.clipboard:append("unnamedplus")
opt.swapfile = false
```

`jk` exits insert mode without reaching for Escape, which sounds trivial until you notice how far the Escape key actually is from home row. `x` deleting into the black hole register instead of overwriting whatever you last yanked has saved me from re-copying the same string four times in a row more times than I can count. `unnamedplus` means anything yanked inside Neovim is immediately available to `Cmd+V` anywhere else on the Mac, no separate clipboard gymnastics required. None of these are about refusing to touch a mouse specifically, they're about refusing to reach for anything, even a key that's three rows away.

## tmux

### What It's Actually For

A terminal multiplexer keeps sessions alive independent of the terminal app itself, splits one window into multiple panes, and lets you name and organize windows by purpose instead of drowning in a dozen identical terminal tabs. [The Hacker Mindset](/the-hacker-mindset/) already covers the workflow reasoning: one window for recon, one for listeners, one for editing exploit code. tmux is the thing that actually makes that layout possible.

If you've never touched tmux before, this is a solid fifteen minutes:

https://www.youtube.com/watch?v=nTqu6w2wc68

### Reading My tmux.conf

#### **The Prefix Remap**

```bash
unbind C-b
set-option -g prefix C-a
bind-key C-a send-prefix

unbind r
bind r source-file $HOME/.config/tmux/tmux.conf \; display "Reloaded :)"
```

`C-b` collides with readline's back-one-character binding often enough to be annoying, and `C-a` is both easier to reach and matches the muscle memory anyone coming from GNU screen already has. `bind r` reloads the config without restarting the session, which turns editing `tmux.conf` into an actual feedback loop instead of a guessing game.

#### **Mouse: Off. Mostly.**

The config sets `mouse off`, and the honest footnote is that I flip it back on more often than the file implies. Usually it's mid engagement, my fingers miss a keybinding under pressure, and clicking the pane I actually meant to select is just faster than debugging my own muscle memory in the moment. I'd love to tell you I never touch a trackpad once tmux is open. I'm also flawed, and human, and pretending otherwise on a blog post about honesty in configuration would be a strange place to start lying.

What does stay consistent is vim style pane selection, and it lines up exactly with how panes move inside Neovim thanks to `vim-tmux-navigator`:

```bash
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R
```

The same `hjkl`, and the same `C-h/j/k/l`, move focus whether the active pane is a shell or a Neovim split, so the whole terminal starts feeling like one continuous grid instead of two separate tools glued together.

#### **The Plugin Shelf**

Managed through [TPM](https://github.com/tmux-plugins/tpm), the tmux plugin manager:

- `tmux-sensible`, a baseline of defaults that should probably just be tmux's actual defaults.
- `tmux-yank`, so copying text in tmux's copy mode lands in the real system clipboard.
- `vim-tmux-navigator`, the pane navigation glue mentioned above.
- `dracula/tmux`, the status line theme, showing CPU usage, RAM usage, and the current git branch. This is the one corner of the whole setup that never got the Catppuccin memo, and at this point it's stayed Dracula long enough that changing it would feel wrong.

```bash
git clone https://github.com/tmux-plugins/tpm $HOME/.config/tpm/plugins/tpm
```

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/tmux-panes.svg" alt="A tmux session with three panes, Neovim in a large left pane, system stats and a shell on the right, and a Dracula themed status bar along the bottom" loading="lazy">
  <figcaption>Figure — the actual layout: editor, resource stats, and a scratch shell, one status bar tying it together</figcaption>
</figure>

## Tools On My Radar

Not everything here is a daily driver. Some of it is genuinely on the "I should actually install this" list, written down publicly so I have to follow through.

### fzf

[fzf](https://github.com/junegunn/fzf) is a general purpose fuzzy finder that works on anything piped into it, not just files. Its real power shows up once you start chaining it into other commands. My favorite combination, once it's actually installed at the shell level rather than just living inside Neovim, is piping `find` into `fzf` with a live `bat` preview window, so you can fuzzy search for a file and see its contents rendered with syntax highlighting before you commit to opening it:

```bash
find . -type f | fzf --preview 'bat --style=numbers --color=always {}'
```

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/fzf-bat-preview.svg" alt="A terminal split between a fuzzy-filtered file list on the left and a syntax-highlighted bat preview of the selected file on the right" loading="lazy">
  <figcaption>Figure — searching and previewing at the same time, no separate open step</figcaption>
</figure>

That one command replaces a search, an open, a "wrong file," a close, and a second search. It's the kind of tool that makes you want to pipe everything into everything else just to see what happens. Someone else demoing the exact same chain, in motion:

https://www.youtube.com/watch?v=u-qLj4YBry0

And the file preview is really just the easiest example to explain in a paragraph. The same binary sits happily behind any list at all:

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/fzf-multi.svg" alt="Three terminal panels showing fzf filtering a git branch list, a process list piped into kill, and shell history, each with one entry highlighted" loading="lazy">
  <figcaption>Figure — branches, processes, history. fzf never asks what it's filtering, it just filters</figcaption>
</figure>

### ripgrep

[ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`) is a recursive search tool that respects `.gitignore` by default and is fast enough that the difference against classic `grep -r` is genuinely noticeable on a large codebase. It's almost certainly already running quietly behind fzf-lua's live grep inside Neovim, so the wishlist entry here is really about reaching for `rg` directly at the shell prompt instead of only benefiting from it secondhand.

```bash
rg "TODO" --type py
rg -i "password" --hidden -g '!node_modules'
```

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/ripgrep-output.svg" alt="rg searching a codebase for TODO comments, results grouped by file with line numbers and highlighted matches, finishing in 9 milliseconds" loading="lazy">
  <figcaption>Figure — grouped by file, matches highlighted, .venv and node_modules skipped without being told to</figcaption>
</figure>

### zoxide

[zoxide](https://github.com/ajeetdsouza/zoxide) replaces `cd` with something that tracks which directories you actually visit and how often, so `z proj` jumps straight to `~/Developer/Projects/git-repos/hutlab-blog` after you've been there a few times, no full path required. It pairs naturally with fzf too: `zi` opens an interactive fuzzy list of your most visited directories.

```bash
z dots      # jump to whatever directory matches "dots" best
zi          # interactively pick from your directory history
```

---

# Managing and Version Control

## GNU Stow

[GNU Stow](https://www.gnu.org/software/stow/) is a symlink farm manager. The dotfiles repo's folder structure mirrors `$HOME` exactly, `.zshrc` at the root, `.config/nvim/` nested the same way it would sit in a real home directory, and running `stow .` from inside the repo creates symlinks from every one of those files into the matching location in `$HOME`. Editing `~/.zshrc` afterward is actually editing the tracked file inside the repo, because the thing sitting at `~/.zshrc` isn't a copy, it's a symlink pointing straight back at it.

```bash
cd ~/.dotfiles
stow .          # symlink everything into $HOME
stow -R .       # restow, useful after adding new files
stow -D .       # remove all the symlinks, undo everything
```

<figure class="img-l">
  <img src="/images/2026-07-14-dotfiles/stow-symlinks.svg" alt="Diagram showing files inside the dotfiles git repo connected by dashed arrows to matching paths in $HOME, representing symlinks created by stow" loading="lazy">
  <figcaption>Figure — one `stow .`, and $HOME fills up with pointers back to the repo</figcaption>
</figure>

`.stow-ignore-local` tells Stow which files not to touch: version control cruft, editor backup files, and the `README.md` itself, since a symlinked README sitting loose in `$HOME` helps nobody.

For the full picture, including the git workflow around it:

https://www.youtube.com/watch?v=TLFsee7DDSI

## Git, Briefly

Everything above is tracked in a normal git repository, nothing exotic about the workflow itself. If you need the actual git fundamentals, from installing it to your first commit, [Git & GitHub](/git-github/) already covers that ground properly. I'm not going to repeat it here.

## New Machine, Five Minutes

Which is really the whole point of writing all of this down as a repo instead of just a pile of muscle memory. A brand new machine goes from empty to fully configured in two commands:

```bash
git clone git@github.com:hutgrabber/hutgrabber-dots.git $HOME/.dotfiles
cd $HOME/.dotfiles && stow .
```

Shell, prompt, editor, and multiplexer, all present and accounted for, before the "Setting Up Your Mac" popup has even finished asking if I want to enable Siri.
