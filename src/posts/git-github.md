---
title: git 101
date: 2024-01-15T15:25:57.000Z
layout: layouts/post.njk
permalink: /git-github/
tags:
  - posts
  - tutorials
description: Get started with git & github. Learn everything - all the way from learning how to set up git on a new system to making your first commit.
templateEngineOverride: md
feature_image: /images/2024-01-15-git-github/cover-image.png
---

A Beginner’s Guide

<figure class="figure"><img alt="" class="kg-image" loading="lazy" src="/images/2024-01-15-git-github/git-graph.jpg"/></figure>

If you have anything to do pertaining to do with IT or code, you have sure as hell come across the term ‘git’. This is my first ever blog post, the goal of which is to help pure beginners to setup & get started with Git.

---

#### 📘 Difference between Git & GitHub

- Git and GitHub are both popular tools for software development, but they serve different purposes. Git is a version control system, while GitHub is a web-based hosting service for Git repositories.
- Git is a free and open-source software that allows you to track changes in your code over time. It’s a distributed version control system, which means that you can work on your code offline and then sync your changes with a remote repository. This makes it easy to collaborate with others on projects, even if they’re not located in the same place.
- GitHub is a web-based hosting service for Git repositories. It provides a number of features that make it easy to manage and collaborate on projects, including; a graphical user interface (GUI) for working with Git; a web-based interface for browsing and searching repositories; a notification system for tracking changes to repositories; a code review system for getting feedback on your code & finally, a pull request system for merging changes from one branch to another.

In short, Git is a tool for managing your code, while GitHub is a platform for hosting and collaborating on Git repositories.

Here is a table that summarizes the key differences between Git & GitHub:

<table>
<thead>
<tr>
<th></th>
<th><strong>Git</strong></th>
<th><strong>GitHub</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>Type</strong></td>
<td>Version control system</td>
<td>Web-based hosting service</td>
</tr>
<tr>
<td><strong>Cost</strong></td>
<td>Free and open-source</td>
<td>Free for individuals and small teams, paid plans for businesses</td>
</tr>
<tr>
<td><strong>Features</strong></td>
<td>Track changes to code, collaborate with others, manage projects</td>
<td>GUI, web-based interface, notification system, code review system, pull request system</td>
</tr>
<tr>
<td><strong>Ownership</strong></td>
<td>Linux Foundation</td>
<td>Microsoft</td>
</tr>
</tbody>
</table>

Which tool you use depends on your needs. If you’re a solo developer or working on a small project, Git may be all you need. If you’re working on a larger project with multiple contributors, or if you need the features that GitHub provides, then GitHub may be a better choice.

---

#### 🗒️ Starting From Scratch

To get started with git, install the git version control system in your computer locally. This can be done using a package manger. For MacOS one can use `brew install git` or `sudo apt-get install git` on Debian based systems. To check for successful installation, you can run the command `git -v` in your terminal to check for successful installation. Once installed, configure git with your account:

```bash
# Set your global username and email address 
git config --global user.name "Your Name" 
git config --global user.email "your.email@example.com" 
 
### this will be used later ### 
 
# Set your username and email address for a single repository 
cd /path/to/repository 
git config user.name "Your Name" 
git config user.email "your.email@example.com"
```

#### 🥕 Configuring Git with GitHub

- LogIn to your github account and create a new repository. Make sure you don’t add any files (`.gitignore`, `README.md`, etc.) to your project to avoid any collisions.
- GitHub will require you to set up SSH keys if your repo is private.

**SSH Setup**

On your local machine generate a new ssh key-pair using the command shown below. This will generate a kay-pair with the name of your choice. The public key will end with a `.pub` extension.

```bash
ssh-keygen -t ed25519 -C youremail@service.com 
# follow on screen instructions & add a password for this key
```

We also need to start-up the `ssh-agent` service so that we can start using these keys.

```bash
eval '$(ssh-agent -s)' # starts ssh agent in bg 
ssh-add ~/.ssh/id_keyname # make sure you add your private key here
```

If running on MacOS, you can do the following to not enter your password each time you push/pull code from GitHub. You will have to save the key to `apple keychain` and edit the `~/.ssh/config` file as well.

```bash
# use the private key here, the public key ends with .pub, don't use that now. 
eval '$(ssh-agent -s)' # starts ssh agent in bg 
ssh-add --use-apple-keychain ~/.ssh/id_keyname  
# use the apple keychain to remember the password in your keychain 
 
# on linux, add this one liner to your ~/.zshrc or ~/.bashrc file 
eval '$(ssh-add -s)' && ssh-add $HOME/.ssh/id_keyname && clear 
# everytime your shell starts, the key will be added to your current session 
# and then the screen will be cleared.
```

You can also get away with adding lines to your `~/.zshrc` file if you just add the identity to your git config file. Add the following files to your git config file. Just know that there are two config files for git. One config file is found in the home directory at `$HOME/.gitconfig` this file is a global configuration file. Anytime the command `git` is used with the `--global` flag, settings are stored in this file. Another file with the name `config` is created under the `.git` directory called `config` at the path `./.git/config` which stores configuration settings only for that current repository. The ssh configuration we want to put, should be in the global config directory for git. We can add the following lines:

```bash
Host github.com 
  AddKeysToAgent yes 
  UseKeyChain yes # for macos 
  IdentityFile $HOME/.ssh/key_name # private key
```

Once all of this is done, we can move on to adding the public key to github so that when we push files, github knows it’s us, and not someone else.

Cat out the public key — `cat ~/.ssh/id_keyname.pub` & copy it to clipboard. Paste this key in the `GitHub settings > SSH & GPG keys > Add New SSH Key`. For every device that you want to clone your repository into, you will have to generate a new key. With MacOS, you can use the tag `--use-apple-keychain` in order to use the stored password. Just make sure you you let your `ssh-agent` know to load the passphrase from keychain to the current `zsh-session`. In order to do this, write the following lines in your `.zshrc` file:

```bash
ssh-add --apple-use-keychain -q 
ssh-add --apple-load-keychain -q 
# this will load your keychain everytime you enter a z-shell session
```

#### 💍 Your First Commit

To create a new project, make an empty repo on Github. GH is going to ask you a few things:

1. Is this repo private or public? Choose what you want, but know that private repos can’t be accessed with `HTTP`. You will probably need to use the `SSH` link to clone & interact with it.

2. GH will ask you to add a `.gitignore` file or a `README.md` file. First make sure that you know --

> What the fish is a `.gitignore` file ??? This is a hidden text file file that lives in the directory where the project is placed. It's the same place where the `.git` folder is. This is a normal text file. You can add a list of file types to the `.gitignore` file to make sure that whenever you push code to the remote repo, it excludes certain files listed in the `.gitignore` file. These files, will not make it into the commit being pushed.

We want to make sure that none such files are created at the time of initializing a new repository. Now all we need to do to make a new repository is to copy the ‘link of origin’ for the repository. This will be the link `https://github.com/username/repo_name.git` in case the repo is `public`. However, in the case that you created a `private` repository, this link will look something like this `github@github.com/username/repo_name.git`. This in fact, is an SSH link to your repository. You, however, can use the `git clone <URL>` command with any of these links. Now follow this steps on your local machine:

```bash
# create a new directory for the project 
mkdir -p My_Project 
cd My_Project 
 
# now, initialize a repository in this project directory 
git init 
 
# your file structure should look like this 
. 
└── .git 
    ├── hooks 
    ├── info 
    ├── objects 
    │   ├── info 
    │   └── pack 
    └── refs 
        ├── heads 
        └── tags 
# point this directory to your remote project that you just created on GH 
git remote add origin <URL> 
 
# point all your future pushes to a branch (unless a new one is created later on) 
git branch -M branch_name
```

This is it. Now you can start coding, save changes, and push code. Let us create a `README.md` file to demonstrate this:

```bash
echo '## Hi Mom :)' >> README.md 
git add README.md 
git commit -m 'commit message' 
git push # may ask you for the passphrase you used for your key-pair.
```

Every time you want to push changes, you can simply run the `add`, `commit` & `push` commands, in that sequence to push to GH.

Go to `github.com` and refresh the page. You will find the recently pushed `README.md` file waiting for you.

---

### And That's All She Wrote!

We learned about what Git is and how it differs from GitHub, and we also learned how to initialize a new git repo and set it up so that it can sync with a remote repository on GitHub.
