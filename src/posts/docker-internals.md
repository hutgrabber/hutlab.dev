---
title: there is no container
date: 2026-11-15
layout: layouts/post.njk
permalink: /docker-internals/
tags:
  - posts
  - write-up
description: Docker is a very friendly CLI sitting on top of kernel features that existed long before it did. Namespaces, control groups, overlay mounts, iptables and runc, taken apart one at a time, with a lot of diagrams.
templateEngineOverride: md
feature_image: /images/2026-11-15-docker-internals/cover.png
---
<!-- TODO before publishing: add a thank-you line to the credit callout once the Docker Saigon folks reply about the re-creation. -->

Quick question before we start. What is a container?

If your answer had the words "lightweight virtual machine" in it, you're in good company, and you're also wrong. I'm the person who tells everyone to stop fighting Python virtual environments and just run the tool in Docker, and for an embarrassingly long time I could not have told you what `docker run` actually asks the kernel to do. The honest answer is that it asks for a lot of things, and none of them are called "container." The Linux kernel has never heard of one.

> [!note] Credit where it's due
> The skeleton of this post comes from [Docker Internals](https://docker-saigon.github.io/post/Docker-Internals/) by the Docker Saigon community, written in February 2016 for a Grokking Engineering meetup. It's the post that made all of this click for me. A decade later the site is in rough shape and half the projects it links to don't exist anymore, so this is my rebuild: same topics, same order, every section re-explained and updated for Docker Engine 29, and a fresh set of diagrams.
>
> That post leaned on a slide deck by Jignesh Shah, [PostgreSQL and Linux Containers](https://www.slideshare.net/jkshah/postgresql-and-linux-containers), from the SF Bay Area PostgreSQL User Group.

This one assumes you've used Docker plenty and you're comfortable poking around `/proc`. I'm not going to explain what an image is. I am going to explain what the kernel thinks an image is, which is nothing, because it never sees one.

---

## The lab

*One Linux box, one label, one cleanup command.*

Everything below runs on a plain Linux VM in my lab with Docker Engine 29 and a <u>cgroup v2</u> kernel, which is what you get on any current Ubuntu, Debian or Fedora install. If you're on a Mac like me, a heads up: Docker Desktop runs every container inside a hidden Linux VM, so half the commands in this post (anything poking at `/proc`, `/sys/fs/cgroup` or `iptables`) will be looking at your Mac instead of the place your containers actually live. SSH into a real Linux box for this one.

Every container I start in this post gets `--label lab=internals`. That's not decoration, it's so the last section of this post can clean everything up with a single command instead of me hunting down twenty randomly named containers.

---

## What a container actually is

*A process with a very convincing blindfold.*

Four facts carry the whole post:

1. A container <u>shares the host kernel</u>. There is no second kernel, no hypervisor, no emulated hardware. The process makes syscalls into the exact same kernel as everything else on the box.
2. The kernel can <u>group processes</u> and account for, or cap, what the group consumes in CPU, memory, disk I/O and process count. That's control groups.
3. The kernel can give a process its own private <u>view</u> of the system: its own process tree, its own network stack, its own hostname, its own mount table. That's namespaces.
4. Put those together and a process feels like it's alone on a small machine. It boots in milliseconds and costs almost nothing, which is why people call it a lightweight VM. It isn't one. It's a normal process that has been lied to very consistently.

You can prove the first fact in two commands:

```bash
uname -r
docker run --rm --label lab=internals alpine uname -r
```

Same kernel string, both times. An Alpine userland, a Debian host, one kernel. Now prove the "normal process" part:

```bash
docker run -d --name sleepy --label lab=internals alpine sleep 31337
ps -eo pid,user,cmd | grep "sleep 31337"
```

There it is, in the host's process list, next to `sshd` and `cron`, with a regular PID. The host can see the container. The container can't see the host. That one-way mirror is the entire trick.

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/vm-vs-container.svg" alt="Three stacks: virtual machines on a hypervisor each running their own guest kernel, containers as plain processes on one shared host kernel, and containers running inside VMs on a hypervisor, which is how nearly every cloud runs them" loading="lazy">
  <figcaption>Figure: a VM brings its own kernel, a container borrows yours, and in the cloud you usually get both</figcaption>
</figure>

The third stack in that figure is the one you're actually running in production. Every managed Kubernetes cluster and almost every cloud Docker host is containers inside VMs. The VM gives the cloud provider a hard boundary between customers. The containers give you density and speed inside your own slice. People treat the two as competitors. In practice they nest.

### The trade you're making

The upside of borrowing the kernel is mostly arithmetic:

- **Footprint.** No guest kernel, no init system, no duplicate copy of every daemon. An idle Alpine container costs a few hundred kilobytes of RAM. An idle VM costs hundreds of megabytes before it does anything useful.
- **Startup and shutdown.** Starting a container is a `clone()` call with some flags, plus some mounts. There's nothing to boot. Shutting it down is sending a signal.
- **Density.** Because of the first two, you fit an order of magnitude more containers on a host than VMs. That's the whole economic argument for Kubernetes.
- **Nesting.** Containers run inside VMs, inside other containers (that's how Docker-in-Docker and every CI runner on the planet works), and inside containers inside VMs. Each layer only costs what it actually uses.

The downside comes from the exact same decision:

- **One kernel version for everyone.** If an app needs a kernel feature your host doesn't have, no image can fix that. A container built against new `io_uring` features doesn't care what the image says, only what the host kernel does.
- **No other operating systems.** A Linux kernel runs Linux containers. A Windows container needs a Windows kernel. Even a different CPU architecture is out of reach without help: running an ARM image on x86 (or the other way around) works through QEMU user mode emulation registered with `binfmt_misc`, the same `qemu-x86_64-static` trick from [the SSH pivoting post](/ssh-part-2/), just wired up automatically by `docker run --platform`.
- **Security.** The 2016 slide for this one said "to be improved." Ten years later it has improved a lot (we'll get there in the security section), but the fundamental shape hasn't changed: every container on the box is one kernel bug away from every other container on the box. A VM has to get through a hypervisor first.

Where that trade pays off hasn't changed much since 2016 either. You want identical environments you can stamp out like a cookie cutter, from a developer laptop to CI to production. You want to group and cap specific processes on a heavily loaded server so one noisy app can't starve the rest. You need several versions of the same software running side by side (three Postgres majors on one box is a perfectly normal Tuesday with containers and a small nightmare without them). And you want throwaway instances for dev and test that cost nothing to create and nothing to delete.

Docker the product is more than the isolation though. Strip it down and you get a <u>runtime</u> that actually starts the processes (these days that's `runc`), an <u>image format</u> plus a build system to produce images, a <u>distribution</u> story so images can be pushed and pulled through registries, and the <u>tooling</u> on top: the CLI, Compose, the API. We'll hit every one of those.

### A short history of faking it

Docker didn't invent any of the isolation. It made it usable. The idea of "put a process in a smaller world" is older than most of the people reading this.

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/timeline.svg" alt="Timeline of process isolation from chroot in 1979 through FreeBSD jails, Solaris Zones, OpenVZ, control groups, LXC, systemd-nspawn, Docker, libcontainer, appc, OCI and runc, containerd, the Kubernetes dockershim removal and Docker 29" loading="lazy">
  <figcaption>Figure: forty-ish years of telling processes they're alone</figcaption>
</figure>

The milestones worth knowing, one card at a time. Swipe, use the arrow keys, or pick a year:

::: carousel rail=labels title="A short history of process isolation, 1979 to 2025"
::: card label="1979" title="chroot" tag="before Linux" tone=blue
Version 7 Unix, landing in BSD in 1982. It changes what `/` means for a process. That's all it does, and we'll see later why "that's all" matters.
::: card label="2000" title="FreeBSD jails" tag="before Linux" tone=blue
chroot plus restrictions on networking and processes. The first thing that really looks like a container.
::: card label="2004" title="Solaris Zones" tag="before Linux" tone=blue
Full process, filesystem and network isolation, with resource pools for CPU and memory. Meiosys MetaClusters shipped checkpoint and restore around the same time, and IBM bought the company for it.
::: card label="2005" title="OpenVZ" tag="before Linux" tone=blue
Containers for Linux, delivered as a patched kernel that never made it upstream. Budget hosting companies ran on it for a decade anyway.
::: card label="2007" title="AIX WPARs" tag="before Linux" tone=blue
IBM's workload partitions bring the same idea to AIX. By now every commercial Unix has an answer, and mainline Linux still doesn't.
::: card label="2008" title="cgroups + LXC" tag="Linux primitives" tone=teal
Google's "process containers" work merges into Linux 2.6.24 as cgroups, and LXC glues cgroups and namespaces into something you can actually drive from a shell.
::: card label="2010" title="systemd-nspawn" tag="Linux primitives" tone=teal
Built to test systemd itself without rebooting a real machine. Turns out to be a perfectly decent container tool.
::: card label="2013" title="Docker" tag="the Docker years" tone=purple
dotCloud open sources its internal tooling. It runs on top of LXC, and bolts on an image format and a registry to share images through.
::: card label="2014" title="libcontainer" tag="the Docker years" tone=purple
Docker 0.9 drops LXC as the default and talks to the kernel directly through its own Go library. In December, CoreOS announces appc and rkt as a competing spec.
::: card label="2015" title="OCI + runc" tag="the Docker years" tone=purple
The truce. The Open Container Initiative forms in June, and in July libcontainer gets spun out as `runc`, the reference implementation of the OCI runtime spec.
::: card label="2017" title="containerd" tag="standards and plumbing" tone=green
Docker had split container supervision into its own daemon the year before. Now it donates containerd to the CNCF, where it graduates in 2019.
::: card label="2019" title="rkt archived" tag="things that ended" tone=pink
The CNCF archives rkt. Its ideas outlive it: pods, plugin based networking and signed images all become standard somewhere else.
::: card label="2022" title="dockershim removed" tag="things that ended" tone=pink
Kubernetes 1.24 stops talking to Docker and talks to containerd or CRI-O directly. Your images keep working because they're all OCI images anyway.
::: card label="2025" title="Docker Engine 29" tag="standards and plumbing" tone=green
The containerd image store becomes the default on new installs, and nftables shows up as an experimental firewall backend.
:::

Solaris Zones deserve a closer look, because they had a complete answer years before Linux did. Any container system has to solve five separate isolation problems: <u>process groups</u> (who can see and signal whom), the <u>filesystem</u>, the <u>network</u>, <u>CPU</u> and <u>memory</u>. Zones handled process, filesystem and network isolation in the base implementation, and leaned on Solaris resource pools to fence off CPU and memory. Then "branded zones" went one step further and isolated the userland libraries themselves, to the point where the `lx` brand could run unmodified Linux binaries on a Solaris kernel by translating their syscalls. On Linux, those five problems map onto exactly two kernel features, which is the rest of this post: namespaces handle the first three, and cgroups handle the last two.

None of this made containers popular, though. Jignesh's deck has two Google Trends charts that tell the story better than any timeline. In the first, OpenVZ, Solaris Zones, FreeBSD jails, LXC and systemd all bump along at comparable, modest levels for a decade. In the second, someone adds Docker to the comparison, and from 2013 onward the line goes nearly vertical and flattens every other line on the chart into the x axis. Same kernel features. Better user experience. That's the whole story of Docker in one graph.

### Containers versus package managers

An image has more in common with an RPM than a VM. Both are a tarball of files plus metadata about how to use them. The difference is what happens to the dependencies.

A package manager installs your app against whatever shared libraries the system has. App A wants one version of `libssl`, app B wants another, and somebody ends up in <u>dependency hell</u> pinning versions and praying. An image carries its own copy of every library it needs, so the two apps never meet. That's the trick that sold Docker to developers: it's a package manager that sidesteps the shared library problem by refusing to share.

The thing package managers always did better is answering "what's actually in here?" `rpm -qa` or `dpkg -l` tells you every installed package and version. In 2016 the answer for images was "good luck, read the Dockerfile and hope it's accurate," and there were DockerCon talks proposing metadata labels as a shipping manifest for images. In 2026 that's a solved problem, it's just called an <u>SBOM</u> (software bill of materials):

```bash
# labels the image author chose to set
docker image inspect -f '{{json .Config.Labels}}' nginx:alpine | jq

# every package actually inside the image, regardless of what the labels claim
syft nginx:alpine
```

[syft](https://github.com/anchore/syft) walks the image layers and lists every OS package, Python wheel, npm module and Go binary it can identify. The labels are what the author told you. The SBOM is what's actually there. Those two disagree more often than you'd hope, which is a fun thing to discover during an incident.

### Containers versus configuration management

Configuration management tools store your infrastructure as code: Puppet and Chef (Ruby), Ansible and Salt (Python), Terraform (Go, and now its OpenTofu fork). Most of them work by running steps against a live machine until it converges on the state you described. Run the playbook twice and you'd better hope it's idempotent.

An image flips that around. You build the artifact once, and the exact same bytes run on your laptop, in CI, and on the production cluster. Nothing converges, because nothing drifts. When something needs to change you build a new image and replace the old container entirely. That's what people mean by <u>immutable infrastructure</u>, or the more dramatic name, phoenix deploys: burn it down, let it rise from the image.

The boring advice from 2016 still holds, though. Use the configuration management tool to build and maintain the Docker hosts themselves, and let images carry the applications. Ansible is great at "make this box run Docker with these daemon settings." It's a bad way to ship your app's Python dependencies.

### Why Docker won

Speed and density were part of it. A container starts in well under a second and costs megabytes, so you can run a whole stack on a laptop that would choke on four VMs. The bigger reason was the <u>Dockerfile</u>. A dozen lines of instructions that anyone who has written a shell script can read, and the escape hatch is just `RUN` whatever you want in bash.

But the thing that made Docker hard to compete with was bundling. Every piece below existed before Docker, scattered across different tools. Docker put them behind one command:

| What Docker gives you | What's actually doing it | Where we cover it |
|---|---|---|
| Resource isolation | control groups | [Control groups](#control-groups) |
| Process, network and hostname isolation | namespaces | [Namespaces](#namespaces) |
| Filesystem isolation | `pivot_root` plus a mount namespace | [Images, layers and copy on write](#images-layers-and-copy-on-write) |
| Image management and change tracking | layered images, overlayfs | [Images, layers and copy on write](#images-layers-and-copy-on-write) |
| Sharing | registries and the distribution API | [Registries](#registries) |
| Network isolation and port publishing | Linux bridges, veth pairs, iptables | [Networking](#networking) |
| Service discovery | an embedded DNS server inside `dockerd` | [Service discovery](#service-discovery) |
| Process management | containerd, the shim and runc | [Who actually starts your container](#who-actually-starts-your-container) |

Let's open the boxes one at a time.

---

## Namespaces

*Controlling what a process can see.*

A <u>namespace</u> wraps one global system resource so that the processes inside it get their own isolated copy. Change your hostname inside a UTS namespace and the host's hostname doesn't move. Start a process in a new PID namespace and it believes it's PID 1. The 2016 post listed six namespaces. The kernel has eight now.

| Namespace | Isolates | Since | Poke at it with |
|---|---|---|---|
| `mnt` | the mount table | 2.4.19 (2002) | `wc -l /proc/mounts` |
| `uts` | hostname and domain name | 2.6.19 | `hostname` |
| `ipc` | System V IPC and POSIX message queues | 2.6.19 | `ipcs` |
| `pid` | the process ID number space | 2.6.24 | `ps aux` |
| `net` | interfaces, routes, firewall rules, sockets | 2.6.29 | `ip addr` |
| `user` | user and group IDs | 3.8 | `cat /proc/self/uid_map` |
| `cgroup` | the visible control group tree | 4.6 | `cat /proc/self/cgroup` |
| `time` | the boot and monotonic clocks | 5.6 | `cat /proc/uptime` |

The `ipc` one sounds academic until you remember that PostgreSQL leaned on System V shared memory for years. Two Postgres instances on the same host, without IPC isolation, can stomp on each other's shared memory segments. With it, each one gets its own private set. Docker doesn't use the `time` namespace by default, which is why `uptime` inside a container reports the host's uptime and makes your one-second-old container look like it's been running since last Tuesday.

Run the commands in the last column on the host, then again inside a container, and compare. Every difference is a namespace doing its job.

<figure class="img-l">
  <img src="/images/2026-11-15-docker-internals/namespaces.svg" alt="The host sees the full process tree with real PIDs and every network interface, while the container sees only its own processes renumbered from PID 1 and a single eth0, with each namespace drawn as a lens between them" loading="lazy">
  <figcaption>Figure: same processes, two views. The container's PID 1 is PID 48213 to the host</figcaption>
</figure>

### Building one by hand

You don't need Docker to make a namespace. `unshare` from util-linux will happily do it for you ([man page](https://man7.org/linux/man-pages/man1/unshare.1.html)):

```bash
sudo unshare --uts --pid --fork --mount-proc --net bash

# now inside the new namespaces
hostname not-a-container
hostname        # not-a-container, and the host's hostname didn't change
ps aux          # bash is PID 1, ps is PID 2, that's the whole world
ip addr         # just a loopback interface, and it's DOWN
exit
```

`--fork` matters for the PID namespace: the process that calls `unshare` stays in the old namespace, and only its children land in the new one. `--mount-proc` remounts `/proc` so `ps` reads the new PID namespace instead of the host's. Forget it and `ps` shows you every process on the host while insisting it's isolated, which is very confusing the first time.

Congratulations, that's most of a container. No image, no cgroup limits and no network, but the process genuinely can't see the rest of the machine.

### Looking at a real container's namespaces

Every process exposes its namespaces as symlinks under `/proc/<pid>/ns`. Two processes in the same namespace point at the same inode number:

```bash
PID=$(docker inspect -f '{{.State.Pid}}' sleepy)
sudo ls -l /proc/$PID/ns
sudo lsns -p $PID
```

`lsns` lists each namespace the process belongs to, its inode, and how many processes share it. Compare the inode numbers against `ls -l /proc/1/ns` on the host and you'll see which ones Docker gave it fresh and which it shares with the host (by default, `time`, and `user` unless you've enabled remapping).

The flip side is `nsenter`, which runs a command inside someone else's namespaces:

```bash
sudo nsenter -t $PID -n ip addr
sudo nsenter -t $PID -n ss -tlnp
```

That runs the host's `ip` and `ss` binaries inside the container's network namespace. This is the move when a container is built from a distroless image with no shell, no `ip`, no nothing, and you need to see what it's listening on during triage. Distroless images ship with nothing, including your patience. `nsenter` brings the tools from the host so the container doesn't have to.

Two more host-side tricks worth keeping in your pocket. `/proc/<pid>/root` is a live view of the container's root filesystem, as that process sees it, readable from the host without entering anything:

```bash
sudo ls /proc/$PID/root/etc
sudo cat /proc/$PID/root/etc/os-release   # Alpine, from a Debian host
```

And `/proc/<pid>/uid_map` tells you whether a user namespace is in play. `0 0 4294967295` means root in the container is root on the host. Anything else, like `0 100000 65536`, means container root is really UID 100000 on the host and can't touch anything that UID couldn't.

### Three syscalls

Everything a runtime does with namespaces goes through three syscalls ([namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html)):

- `clone()` with `CLONE_NEW*` flags creates a child process directly in fresh namespaces. This is how a container's first process is born.
- `unshare()` moves the calling process into fresh namespaces. For the PID namespace it's special: only the caller's future children land in the new one, which is why the `unshare` command needed `--fork` above.
- `setns()` joins an existing namespace through a file descriptor opened on `/proc/<pid>/ns/<type>`. This is what `docker exec` and `nsenter` do.

`setns()` has a nasty constraint that shapes how runc is built: a multithreaded process can't join a mount or user namespace. Go programs are multithreaded from the moment the runtime starts, before `main()` even runs. So runc re-executes itself as `runc init`, and a chunk of C code called `nsexec` runs from a constructor before the Go runtime spins up any threads, joins or creates the namespaces while the process is still single threaded, and only then hands control to Go. If you've ever seen `runc init` in a process listing and wondered what it was, now you know: it's runc working around its own language.

### PID 1 is special

The first process in a PID namespace gets the job of `init`, whether it wants it or not, and that comes with two behaviors that bite people constantly:

1. **Signals without handlers are ignored.** The kernel won't deliver `SIGTERM` or `SIGINT` to PID 1 unless the process installed a handler for them. Plenty of programs never do, because outside a container they never ran as PID 1. So `docker stop` sends `SIGTERM`, nothing happens, Docker waits ten seconds, and then sends `SIGKILL`. Every "why does my container take exactly ten seconds to stop" question ends here.
2. **Orphans get reparented to it.** When a process dies, its children get adopted by PID 1, which is expected to `wait()` on them when they exit. If your app doesn't, exited children pile up as zombies until the PID table fills.

Both go away with a tiny init that forwards signals and reaps children. Docker ships one, [tini](https://github.com/krallin/tini), behind a single flag:

```bash
docker run -d --init --name civilized --label lab=internals alpine sleep infinity
docker exec civilized ps
# PID 1 is /sbin/docker-init, sleep is PID 7
```

Namespaces control what a process can see. They do nothing at all about what it can consume. A process in its own PID namespace can still eat every byte of RAM on the box. For that, we need the other half.

---

## Control groups

*Controlling what a process can use.*

A <u>control group</u> (cgroup) is a set of processes the kernel tracks together. Once processes are grouped, the kernel can account for what the group uses, cap it, restrict which devices it may touch, and freeze the whole group at once.

The original post leaned on Jérôme Petazzoni's DockerCon EU 2015 talk for this section, and it's still the best forty minutes you can spend on the topic:

https://www.youtube.com/watch?v=sK5i-N34im8

### v1 versus v2

The biggest change since 2016 is the shape of the tree. In <u>cgroup v1</u>, every resource type (controller) had its own separate hierarchy. You had a `cpu` tree and a `memory` tree and a `blkio` tree, each organized however you liked, and a process sat in exactly one node of each tree. That's flexible, and it was also a mess, because nothing kept the trees consistent with each other.

<u>cgroup v2</u> has one unified tree under `/sys/fs/cgroup`. A process lives in exactly one node, and each node turns on whichever controllers it wants for its children via `cgroup.subtree_control`.

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/cgroups-tree.svg" alt="Left, cgroup v1 with separate cpu and memory hierarchies where the same PID appears in a different place in each tree. Right, cgroup v2 with a single tree under /sys/fs/cgroup where each docker container scope holds every controller" loading="lazy">
  <figcaption>Figure: v1 is one tree per resource, v2 is one tree, period</figcaption>
</figure>

Which mode you're in is decided at boot, not per process. Check yours:

```bash
stat -fc %T /sys/fs/cgroup
# cgroup2fs means v2, tmpfs means v1 or the hybrid mode
```

Docker Engine 29 formally deprecated cgroup v1 support, with a promise to keep it working until May 2029. If you're still on v1 in 2026, this is your sign.

### Finding a container's cgroup

Start a container with some limits so there's something to look at:

```bash
docker run -d --name hog --label lab=internals \
  --memory 256m --memory-reservation 128m \
  --cpus 0.5 --pids-limit 64 \
  alpine sleep infinity

PID=$(docker inspect -f '{{.State.Pid}}' hog)
cat /proc/$PID/cgroup
# 0::/system.slice/docker-3f9c...e1a7.scope
```

On v2 there's a single line, starting with `0::`. The path is relative to `/sys/fs/cgroup`, and with the systemd cgroup driver (the default on v2 hosts) every container becomes a systemd scope unit called `docker-<full id>.scope`. Everything Docker set for you is a plain file in that directory:

```bash
CG=/sys/fs/cgroup$(cut -d: -f3 /proc/$PID/cgroup)
cat $CG/memory.max     # 268435456
cat $CG/memory.low     # 134217728
cat $CG/cpu.max        # 50000 100000
cat $CG/pids.max       # 64
```

`--cpus 0.5` became "50 ms of CPU time every 100 ms." `--memory-reservation` became `memory.low`. No magic, just files. Now the controllers one by one.

#### **memory**

The memory controller does three jobs: accounting, limits and notifications.

<u>Accounting</u> happens per page, which is 4 KiB on x86_64. The kernel splits pages into two kinds, and the difference matters a lot when memory runs out:

- <u>File-backed pages</u> are data read from disk, like the page cache holding a binary or a log file. The data still exists on disk, so the kernel can drop these pages and read them back later. Cheap to reclaim.
- <u>Anonymous pages</u> are memory that doesn't correspond to any file: your heap, your stack, that 2 GB Python dictionary. The only way to reclaim them is to swap them out, and if there's no swap, the only way is to kill something.

The kernel also sorts pages onto active and inactive lists, so recently used pages stay in memory and stale ones get reclaimed first. When two groups touch the same file, the page is charged to exactly one of them, whichever faulted it in first. `memory.stat` breaks all of this down:

```bash
grep -E '^(anon|file|active_anon|inactive_file) ' $CG/memory.stat
```

<u>Limits</u> in v2 come as a ladder rather than v1's hard limit and soft limit pair:

| File | Docker flag | What happens when you cross it |
|---|---|---|
| `memory.min` | none | protected, never reclaimed |
| `memory.low` | `--memory-reservation` | reclaimed only if nothing unprotected is left |
| `memory.high` | none | the group gets throttled and reclaimed hard, but nothing dies |
| `memory.max` | `--memory` | the OOM killer picks a process in the group and kills it |
| `memory.swap.max` | `--memory-swap` | caps swap use on top of `memory.max` |

v1 also had a separate kernel memory limit, so a process couldn't dodge its limit by making the kernel allocate on its behalf. Docker's `--kernel-memory` flag for it is gone. In v2, kernel memory is simply counted inside `memory.max` along with everything else, which is what everyone wanted in the first place.

Here's the OOM killer in action:

```bash
docker run --name balloon --label lab=internals --memory 64m \
  python:3-alpine python -c "x = bytearray(200 * 1024 * 1024)"
echo $?
# 137
docker inspect -f '{{.State.OOMKilled}}' balloon
# true
```

Exit code 137 is 128 plus 9, and 9 is `SIGKILL`. It's the kernel's way of saying no without leaving a note. This is also why "one process per container" is good advice: when the group hits `memory.max`, the kernel kills a process, not necessarily the one you'd pick. Set `memory.oom.group` to 1 and it kills the whole group together instead of leaving a half-dead container behind.

<u>Notifications</u> used to be an eventfd you registered against `memory.oom_control` in v1, and you could even tell the kernel to pause the group instead of killing it, so a user space program could decide what to do: kill it, raise the limit, move it elsewhere. In v2 you watch `memory.events` instead, which counts `high`, `max`, `oom` and `oom_kill` occurrences and can be watched with inotify:

```bash
cat $CG/memory.events
```

v2 also added <u>pressure stall information</u> (PSI), which answers a better question than "how much memory is it using": how much time did the group spend stalled, waiting on memory? `memory.pressure`, `cpu.pressure` and `io.pressure` each report the share of recent time that some or all of the group's tasks were stuck:

```bash
cat $CG/memory.pressure
# some avg10=0.00 avg60=0.00 avg300=0.00 total=0
# full avg10=0.00 avg60=0.00 avg300=0.00 total=0
```

A container sitting at 90% of its memory limit with zero pressure is fine. One at 60% with `full avg10` climbing is thrashing through reclaim and about to get slow. That's the number to alert on.

The accounting isn't free. Every time the kernel hands a page to a process or takes one back, counters get updated up the tree. The overhead is small, but it's there, and it's one more reason not to nest cgroups ten levels deep for fun.

#### **hugetlb**

Accounting and limits for huge pages (2 MB or 1 GB pages instead of 4 KiB ones), mostly interesting if you run databases or DPDK workloads that ask for them. The files look like `hugetlb.2MB.max`. The original post skipped this one and, honestly, so will most of you.

#### **cpu**

In v1 this was two controllers: `cpu` for scheduling and `cpuacct` for accounting. v2 merges them:

- `cpu.stat` tracks total, user and system CPU time in microseconds. (v1's `cpuacct` also broke usage down per CPU core. v2 dropped that.)
- `cpu.weight` sets a relative share, from 1 to 10000, default 100. Docker's `--cpu-shares` gets converted onto this scale.
- `cpu.max` sets a hard cap as quota and period. `--cpus 0.5` writes `50000 100000`.

The 2016 post made a point that's still worth repeating: <u>weights are not limits</u>. A container with a tiny weight on an idle host still gets 100% of the CPU, because weights only kick in when groups compete. If you want a ceiling, that's `cpu.max`, which is what `--cpus` sets.

#### **cpuset**

Pins a group to specific CPU cores and memory nodes:

```bash
docker run -d --name pinned --label lab=internals \
  --cpuset-cpus 0-1 --cpuset-mems 0 alpine sleep infinity
```

Useful for real time workloads that hate being bounced between cores, and on <u>NUMA</u> machines where each socket has its own local memory and you want a process's CPU and RAM on the same side of the board.

#### **io**

This was `blkio` in v1. `io.max` caps bytes and operations per second per device, `io.weight` sets a relative share, and `io.stat` accounts for everything:

```bash
docker run --rm --label lab=internals \
  --device-write-bps /dev/sda:10mb alpine \
  dd if=/dev/zero of=/tmp/test bs=1M count=50 oflag=direct
```

Swap `/dev/sda` for whatever `lsblk` says your disk is called. On most cloud VMs, mine included, it's `/dev/vda`, and the limit silently does nothing if you name a device the container never writes to. With the limit in place, `dd` should report roughly 10 MB/s.

The old caveat was that blkio limits only behaved for direct I/O, because buffered writes got flushed to disk later by kernel threads that didn't belong to your group, so the bytes were never charged to you. v2 fixed this with <u>cgroup writeback</u>, which tracks dirty pages back to the group that wrote them. Throttling buffered writes works now, mostly. Different filesystems support it to different degrees, so test before you trust it.

#### **pids**

Not in the 2016 post, and it should be in everyone's. `pids.max` caps the number of processes and threads in a group, which is the entire defense against a fork bomb inside a container taking down the host:

```bash
docker exec hog sh -c 'for i in $(seq 100); do sleep 60 & done'
# sh: can't fork: Resource temporarily unavailable
```

The `--pids-limit 64` we set earlier did that. Set it on everything.

#### **net_cls and net_prio**

These v1 controllers didn't shape traffic themselves. They only <u>tagged</u> packets from a group with a class ID or a priority, and you were responsible for writing the `tc` rules that did something with the tag. They don't exist in v2. The modern replacement is attaching eBPF programs to a cgroup, or matching on the cgroup path in nftables with `socket cgroupv2`. Docker never really exposed either.

#### **devices**

Controls which device nodes a group may read, write, or create (`mknod`). This is what stops a process in a container from opening `/dev/sda` and reading the host disk directly. In v1 it was `devices.allow` and `devices.deny` files. In v2 there are no files at all: runc attaches an eBPF program to the cgroup that checks every device access against the allow list.

By default Docker allows the harmless ones like `/dev/null`, `/dev/zero`, `/dev/full`, `/dev/random`, `/dev/urandom` and the terminal devices. The 2016 reason for allowing `/dev/random` was entropy: generate keys in a container without enough entropy and you'd block forever. Since kernel 5.6, `/dev/random` no longer blocks once the pool is initialized, so that particular horror story has aged out.

The interesting ones are the devices you add on purpose:

| Device | Why you'd want it |
|---|---|
| `/dev/net/tun` | VPN clients inside a container, without touching the host's routes |
| `/dev/fuse` | FUSE filesystems like `sshfs` inside a container |
| `/dev/kvm` | running virtual machines inside a container |
| `/dev/dri`, `/dev/video*` | GPU and video access. For NVIDIA, the Container Toolkit and `--gpus all` handle it now |

```bash
docker run --rm -it --label lab=internals \
  --cap-add NET_ADMIN --device /dev/net/tun \
  alpine sh -c 'apk add -q openvpn && openvpn --version | head -1'
```

That's the start of running a Hack The Box VPN in a container so it can't rewrite your host's routing table every time you connect.

#### **freezer**

Freezes every process in a group in place, and thaws them later. In v1 that was `freezer.state`. In v2 it's `cgroup.freeze`:

```bash
docker pause hog
cat $CG/cgroup.freeze    # 1
grep frozen $CG/cgroup.events
docker unpause hog
```

Why not just send `SIGSTOP` and `SIGCONT`? Because signals are visible. The parent gets notified, a debugger attached with `ptrace` sees the stop, and a process can tell it was stopped. Freezing happens underneath the process without it ever knowing. That's what you want for batch schedulers pausing jobs, for checkpointing a process with CRIU to restore it elsewhere, and for snapshotting a misbehaving container so you can poke at it without the process noticing.

### Driving cgroups with systemd

On a systemd host, systemd owns the cgroup tree, and every service already gets its own cgroup. You set limits through unit properties instead of raw files. The 2016 syntax (`ControlGroupAttribute`) is long gone. Today it's a drop-in:

```ini
# /etc/systemd/system/nginx.service.d/limits.conf
[Service]
MemoryMax=512M
CPUWeight=50
TasksMax=200
```

Or on a running service, without touching any files:

```bash
sudo systemctl set-property --runtime nginx.service CPUWeight=50
systemctl show nginx.service -p MemoryMax -p CPUWeight
sudo systemd-run --scope -p MemoryMax=100M bash   # throwaway limited shell
```

`--runtime` makes the change temporary, gone after a reboot. Leave it off and systemd writes a persistent drop-in for you.

One warning that hasn't changed in ten years: don't do this to a container's `docker-*.scope` unit. You're going behind Docker's back, and Docker will happily put its own values back the next time the container restarts. If you want to change a running container's limits, use the front door:

```bash
docker update --memory 512m --memory-swap 1g --cpus 1 --pids-limit 128 hog
```

### The filesystem is the API

Under all of this, cgroups are just directories and files in a pseudo filesystem. That's exactly how systemd and runc apply your settings. You can do it yourself on a throwaway VM (on a systemd host this is stepping on systemd's toes, so don't do it on anything you care about):

```bash
sudo mkdir /sys/fs/cgroup/demo
echo "+memory +pids" | sudo tee /sys/fs/cgroup/cgroup.subtree_control
echo 20M | sudo tee /sys/fs/cgroup/demo/memory.max
echo $$  | sudo tee /sys/fs/cgroup/demo/cgroup.procs   # move this shell in
cat /proc/self/cgroup                                   # 0::/demo
```

`mkdir` creates a group, writing a PID into `cgroup.procs` moves a process in (v1 called this file `tasks`), and `rmdir` deletes the group once it's empty. Every limit in the [kernel's cgroup v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html) is just a file you can `cat` and `echo` into.

Between namespaces and cgroups we have a process that can't see much and can't use much. It also can't talk to anything yet. On to the plumbing.

---

## Networking

*Bridges, veth pairs, and a lot of iptables.*

Container networking on Linux is built from parts that predate Docker by a decade. A <u>Linux bridge</u> is a virtual switch inside the kernel (it's been there since 2.2, around 2000). A <u>veth pair</u> is a virtual ethernet cable with two ends: whatever goes in one comes out the other. Docker creates a bridge per network, then for every container it creates a veth pair, pushes one end into the container's network namespace and names it `eth0`, and plugs the other end into the bridge.

Traffic leaving a container gets source NAT'd (`MASQUERADE`) to the host's address on the way out. Traffic coming in on a published port gets destination NAT'd (`DNAT`) to the container's IP. All of that is iptables rules Docker writes for you, though Docker 29 can do the same with nftables if you opt in with `--firewall-backend=nftables`.

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/docker-network.svg" alt="Two user-defined bridge networks on one host. Each container connects to its bridge through a veth pair. Inbound traffic on published ports is DNAT'd by iptables and also caught by docker-proxy, outbound traffic is masqueraded, the two bridges are isolated from each other, and the embedded DNS server at 127.0.0.11 answers name lookups" loading="lazy">
  <figcaption>Figure: two networks, four containers, and the rules that keep them apart</figcaption>
</figure>

### Building the demo

I'm using [nicolaka/netshoot](https://github.com/nicolaka/netshoot) for this, an image that ships with every network tool you could want (`dig`, `curl`, `tcpdump`, `iperf`, the lot). It's the Swiss Army knife you keep in the drawer for exactly this kind of afternoon.

```bash
docker network create lab-a
docker run -dit --name web1 --network lab-a --label lab=internals -p 8081:80 nicolaka/netshoot
docker run -dit --name web2 --network lab-a --label lab=internals -p 8082:80 nicolaka/netshoot
docker ps --filter label=lab=internals
```

Now look at what Docker built. `brctl` from the old post is deprecated and probably not even installed on your box, so use `ip` and `bridge` from iproute2:

```bash
ip -br link show type bridge     # docker0, plus a br-<id> for lab-a
bridge link                      # the host ends of the veth pairs, attached to br-<id>
sudo iptables -t nat -S DOCKER   # one DNAT rule per published port
sudo iptables -t nat -S POSTROUTING | grep MASQUERADE
```

### docker-proxy

Publish a port and something on the host starts listening on it. Not just an iptables rule, an actual process:

```bash
sudo ss -ltnp | grep docker-proxy
ps -eo pid,rss,cmd | grep [d]ocker-proxy
```

That's `docker-proxy`, a small userland TCP and UDP forwarder. It exists for the cases iptables DNAT doesn't catch, mainly traffic from the host to its own published port via `localhost`, which never passes through the `PREROUTING` chain where the DNAT rule lives. It's still on by default in Docker 29.

It's cheap per port, but the cost adds up if you publish big ranges:

```bash
docker run -dit --name ranges --label lab=internals -p 9000-9049:9000-9049 nicolaka/netshoot
ps -eo pid,rss,cmd | grep [d]ocker-proxy | wc -l
```

Count what you get back on your version. Then decide whether you'd rather turn it off with `"userland-proxy": false` in `/etc/docker/daemon.json`, which makes Docker rely on the kernel's hairpin NAT for the host-to-itself case. It's faster and lighter, at the cost of a few edge cases where localhost connections behave differently. Test it on your setup before you trust it.

### Service discovery

On a user-defined network, containers find each other by name:

```bash
docker exec web1 ping -c1 web2
docker exec web1 dig web2 +short
docker exec web1 cat /etc/resolv.conf
# nameserver 127.0.0.11
```

`127.0.0.11` is Docker's <u>embedded DNS server</u>, and it has been around since Docker 1.10 in 2016. Here's the fun part: it isn't running inside your container. It runs inside `dockerd` on the host. Docker opens a listening socket inside the container's network namespace and adds NAT rules, also inside that namespace, that send port 53 on 127.0.0.11 to that socket's real port:

```bash
WPID=$(docker inspect -f '{{.State.Pid}}' web1)
sudo nsenter -t $WPID -n ss -lnup     # a listener on 127.0.0.11, and the owning process is dockerd
sudo nsenter -t $WPID -n iptables -t nat -S
```

You can give containers extra names on a network with `--network-alias`, and the embedded DNS forwards anything it doesn't know to the host's resolvers.

### Isolation between networks

Make a second network and put two more containers on it:

```bash
docker network create lab-b
docker run -dit --name web3 --network lab-b --label lab=internals nicolaka/netshoot
docker run -dit --name web4 --network lab-b --label lab=internals nicolaka/netshoot
ip -br link show type bridge     # a second br-<id> just appeared
```

Now try to reach `web3` from `web1`. Use the IP, not the name, because the name won't even resolve across networks and you want to prove the packets are blocked, not just the DNS:

```bash
WEB3=$(docker inspect -f '{{(index .NetworkSettings.Networks "lab-b").IPAddress}}' web3)
docker exec web1 ping -c2 -W1 $WEB3
# 100% packet loss
sudo iptables -S | grep -i docker
```

The drop comes from Docker's isolation rules in the filter table. The chain names have been reshuffled more than once over the years (and again in the 28 and 29 releases), so I won't pretend yours will match mine exactly. Look for rules that drop traffic going from one `br-` interface out of another.

### The default bridge is the odd one out

Containers started without `--network` land on the default `docker0` bridge, and for backwards compatibility that network gets no embedded DNS:

```bash
docker run -dit --name def1 --label lab=internals nicolaka/netshoot
docker run -dit --name def2 --label lab=internals --link def1 nicolaka/netshoot
docker exec def1 cat /etc/resolv.conf   # a copy of the host's resolvers, not 127.0.0.11
docker exec def2 cat /etc/hosts         # def1 is in here, because of --link
docker exec def1 ping -c1 def2          # bad address 'def2', links only go one way
```

`--link` is how containers found each other before 1.10. It works by writing `/etc/hosts` entries (and used to inject a pile of environment variables, which Docker 29 disabled by default and plans to remove entirely in v30). Don't build anything new on it. Make a network.

### Opening ports by hand, and why you shouldn't

You can add a port forward to a running container on the default bridge yourself:

```bash
CIP=$(docker inspect -f '{{.NetworkSettings.IPAddress}}' def1)
sudo iptables -t nat -A DOCKER -p tcp --dport 8001 -j DNAT --to-destination ${CIP}:8000
```

It works until the daemon restarts and rebuilds its chains, and then your rule is gone without a word. Recreate the container with the right `-p` instead.

And here's the one I'd underline twice if the site let me. Those DNAT rules happen in `PREROUTING`, before the `INPUT` chain where host firewalls like ufw do their filtering. So `docker run -p 5432:5432 postgres` on a box where ufw denies 5432 is <u>still reachable from the internet</u>. ufw says the port is closed. It isn't. If a service only needs to be reachable locally, bind it to localhost:

```bash
docker run -d -p 127.0.0.1:5432:5432 postgres
```

If you need real filtering in front of published ports, put your rules in the `DOCKER-USER` chain, which Docker evaluates before its own and never overwrites.

All of this is also why a lab full of default bridge containers looks like one host to a scanner: nmap sees the host's published ports, not each container's IP. If you want every container to show up as its own machine on the subnet, the way I wanted for the [nmap posts](/nmap/), you need a `macvlan` network, which gives each container its own MAC and IP directly on the physical network.

Last thing before moving on. Every container we started is sitting in its own cgroup, and you can see all of them in one tree:

```bash
systemd-cgls -u system.slice | grep -A1 docker-
```

---

## Security

*The section the 2016 post left as homework.*

The original post listed AppArmor, seccomp and capabilities, then honestly said they were subject for further study. It's been ten years. Let's study.

Namespaces and cgroups are isolation, not a security boundary on their own. The container still shares the kernel with the host, so the real question is how much of the kernel it's allowed to talk to. Docker answers that with layers, each narrowing what a process can do:

<figure class="img-l">
  <img src="/images/2026-11-15-docker-internals/security-layers.svg" alt="Concentric rings around a container process: user namespace, dropped capabilities, the seccomp syscall filter, the AppArmor or SELinux profile, no-new-privileges, and then the shared host kernel at the center that every layer is protecting" loading="lazy">
  <figcaption>Figure: every ring is a separate filter between the process and the shared kernel</figcaption>
</figure>

### Capabilities

Linux splits root's powers into about forty <u>capabilities</u> ([capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html)): `CAP_NET_ADMIN` to reconfigure networking, `CAP_SYS_ADMIN` for roughly half of everything else, `CAP_SYS_PTRACE` to debug other processes, and so on. Root inside a Docker container keeps only 14 of them by default, things like `CHOWN`, `NET_BIND_SERVICE`, `SETUID` and `KILL`.

```bash
docker run --rm --label lab=internals alpine grep Cap /proc/self/status
capsh --decode=00000000a80425fb     # decode the CapEff line from the output above
```

The good habit is to drop everything and add back only what you need:

```bash
docker run -d --name tight --label lab=internals \
  --cap-drop ALL --cap-add NET_BIND_SERVICE \
  nginx:alpine
```

`nginx:alpine` needs a little more than that to start cleanly, so expect to add `CHOWN`, `SETUID` and `SETGID` back after reading its error. That's the whole method: start from nothing, read the error, add one capability, repeat. It's tedious and it's also the most effective ten minutes of hardening you'll do this week.

### seccomp

[seccomp](https://docs.docker.com/engine/security/seccomp/) filters which <u>syscalls</u> a process can make at all. Docker's default profile disables around 44 of the 300+ syscalls, things like `bpf`, `add_key`, `clock_settime`, `kexec_load` and the kernel module loaders, mostly because they touch parts of the kernel that aren't namespaced. Check it's active and swap in your own:

```bash
docker info --format '{{.SecurityOptions}}'
docker run --rm --security-opt seccomp=./my-profile.json alpine true
```

### AppArmor and SELinux

These are mandatory access control: rules about which files, mounts and network operations a process may touch, enforced regardless of its UID. On Ubuntu and Debian, Docker loads an AppArmor profile called `docker-default` for every container. On Fedora and RHEL, it's SELinux labels, which is why bind mounts there need `:Z` or `:z`. Writing AppArmor profiles by hand is miserable, so Jess Frazelle wrote [bane](https://github.com/genuinetools/bane) to generate them from a simpler config. It hasn't seen a lot of love lately, but it's still the gentlest introduction to what a profile actually contains.

### The rest of the belt

- `--security-opt no-new-privileges` stops a process from gaining privileges through setuid binaries. Cheap, rarely breaks anything, turn it on.
- <u>User namespaces</u>, either with `userns-remap` in the daemon config or by running Docker in [rootless mode](https://docs.docker.com/engine/security/rootless/), map root in the container to an unprivileged user on the host. If something escapes, it escapes as nobody.
- `--privileged` turns off nearly all of the above in one flag: every capability, no seccomp, no AppArmor, every device. Treat it like handing someone your root password.
- `/var/run/docker.sock` deserves its own warning. Anyone who can write to that socket can tell the daemon to start a privileged container with the host's filesystem mounted inside. Mounting it into a container, or adding a user to the `docker` group, is giving away root.

How each of those layers fails in practice is a whole post on its own, and it's the next one.

### Three shapes of container

Mix and match which namespaces a process gets, and you get three distinct shapes of container:

<figure class="img-l">
  <img src="/images/2026-11-15-docker-internals/container-types.svg" alt="Three panels: a system container that shares nearly every host namespace and only gets its own cgroup, an application container with its own namespaces for everything, and a pod where several containers share network, IPC and UTS namespaces held open by a pause container while each keeps its own filesystem" loading="lazy">
  <figcaption>Figure: same building blocks, three different floor plans</figcaption>
</figure>

- A <u>system container</u> shares the host's PID, network, IPC and UTS namespaces and only lives in its own cgroup. Monitoring agents run like this, because they need to see the whole box. In Docker that's `--pid host --network host --ipc host --uts host`.
- An <u>application container</u> gets its own namespace for everything. This is the default for `docker run`.
- A <u>pod</u> is a group of containers sharing network, IPC and UTS namespaces (so they reach each other on `localhost`) while each keeps its own filesystem.

In 2016 the original post called pods on Docker suboptimal, because the only way to keep shared namespaces alive was to start a do-nothing container first and attach everything else to it. That workaround didn't go away. It became the standard. Every Kubernetes pod today starts with a `pause` container whose only job is to hold the namespaces open. You can build one with plain Docker:

```bash
docker run -d --name pod-infra --label lab=internals registry.k8s.io/pause:3.10
docker run -d --name pod-web --label lab=internals \
  --network container:pod-infra --ipc container:pod-infra nginx:alpine
docker run --rm --label lab=internals \
  --network container:pod-infra nicolaka/netshoot curl -s localhost | head -4
```

The `pause` binary is a few hundred lines of C that calls `pause()` in a loop and reaps zombies. It is, by a wide margin, the most deployed program that does nothing.

---

## Images, layers and copy on write

*Every container is a stack of tracing paper.*

### Registries

Images live in <u>registries</u>, which are Docker's distribution layer. You push and pull through a well defined HTTP API, and the choices boil down to three:

- **Public, hosted.** Docker Hub is the default the CLI talks to, and home of the official images. Anonymous pulls are rate limited these days, so log in on CI. Alternatives: Quay, GitHub Container Registry, and the cloud providers' own (ECR, Artifact Registry, ACR).
- **Commercial, self-hosted.** Docker Trusted Registry was the 2016 answer. Docker sold its enterprise business to Mirantis in 2019 and it lives on as Mirantis Secure Registry. The open source answer with the same features (access control, replication, vulnerability scanning) is [Harbor](https://goharbor.io/), a graduated CNCF project.
- **Open source, roll your own.** The registry Docker originally wrote, now [CNCF Distribution](https://github.com/distribution/distribution). Fully functional, no web UI, no access control beyond what you bolt on.

The last one takes about thirty seconds:

```bash
docker run -d --name reg --label lab=internals -p 127.0.0.1:5000:5000 registry:3
docker tag alpine:latest localhost:5000/alpine:lab
docker push localhost:5000/alpine:lab
curl -s localhost:5000/v2/_catalog
# {"repositories":["alpine"]}
```

### Layers

An image is an ordered list of read-only <u>layers</u>, each a tarball of filesystem changes, plus a config blob describing how to run it. Every layer is <u>content addressed</u> by its sha256 digest, so two images built on the same base share those layers on disk and over the wire. You only download what you don't already have.

The clearest way to see where layers come from is to build one. Here's a deliberately naive Dockerfile:

```dockerfile
FROM debian:trixie-slim
RUN apt-get update
RUN apt-get install -y --no-install-recommends nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
docker build -t localhost:5000/naive-nginx:lab .
docker history localhost:5000/naive-nginx:lab
```

`docker history` lists one row per instruction, newest at the top, with a size for each. The `FROM` base is the big one. Each `RUN` adds a layer holding exactly the files that command changed, so the `apt-get update` row is several megabytes of package lists that nobody will ever need at runtime, frozen into the image forever. The `EXPOSE` and `CMD` rows show 0 B, because they only change the config blob and add no filesystem layer at all. Merge the two `RUN` lines and clean up the apt lists in the same step, and that dead weight disappears:

```dockerfile
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx \
 && rm -rf /var/lib/apt/lists/*
```

It has to be the same step. Deleting the lists in a later `RUN` just hides them behind a whiteout, as we're about to see, and the bytes still ship with the image.

Push it and the registry receives each layer separately, by digest:

```bash
docker push localhost:5000/naive-nginx:lab
docker image inspect -f '{{json .RootFS.Layers}}' localhost:5000/naive-nginx:lab | jq
```

Push a second image built on the same `debian:trixie-slim` base and the push output says "Layer already exists" for the shared ones. That deduplication is the reason layers exist at all.

When a container starts, the runtime stacks those layers into one root filesystem and makes it the container's `/`. The 2016 post said Docker uses `chroot` for this. runc actually uses <u>`pivot_root`</u>, and the difference matters. `chroot` only changes how paths are resolved for one process, and a process with `CAP_SYS_CHROOT` can walk right back out of it with a second `chroot` and a few `cd ..` calls. `pivot_root` swaps the root mount of the entire mount namespace and then unmounts the old one, so there's no old root left to walk back to.

### Copy on write

Before Docker, creating an LXC container usually meant copying the entire root filesystem. Slow, and every container paid for its own full copy on disk. Docker's big idea was to never copy the image at all. Each container gets the shared, read-only image layers underneath and one thin writable layer on top, the <u>container layer</u>. Every write, edit and delete goes into that top layer. Start a hundred containers from one image and you have one copy of the image and a hundred tiny diffs.

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/image-layers.svg" alt="Three containers each with their own thin writable layer, all stacked on the same shared read-only image layers. On the right, an overlay2 mount showing lowerdir, upperdir, workdir and merged, with a copy-up when a file from a lower layer is modified and a whiteout file when one is deleted" loading="lazy">
  <figcaption>Figure: shared layers at the bottom, one thin writable layer per container on top</figcaption>
</figure>

A union filesystem gives you four things here:

1. **Layering.** Several directories stacked and presented as one tree.
2. **Copy on write.** A file from a lower layer gets copied up into the writable layer only at the moment you modify it.
3. **Caching.** Identical files from shared layers share page cache too, so a hundred containers running the same binary use one copy of it in RAM.
4. **Diffing.** Since every change lives in the top layer, "what changed in this container" is just "what's in the top layer."

Let's watch it happen. The default storage driver everywhere today is <u>overlay2</u>, built on the kernel's overlayfs:

```bash
docker run -d --name scratchpad --label lab=internals nginx:alpine
SPID=$(docker inspect -f '{{.State.Pid}}' scratchpad)
sudo findmnt -N $SPID -no OPTIONS / | tr , '\n' | grep dir=
```

That prints the four pieces of an overlay mount: `lowerdir` (the image layers, colon separated, read-only), `upperdir` (the container layer), `workdir` (scratch space overlayfs needs for atomic operations), and the merged result, which is what the container sees as `/`. If you're on a fresh Docker 29 install using the containerd image store, those paths live under `/var/lib/containerd` instead of `/var/lib/docker/overlay2`, and `docker inspect`'s `GraphDriver` section may come back nearly empty. `findmnt` asks the kernel directly, so it doesn't care which store you're on.

Now change something:

```bash
docker exec scratchpad sh -c 'echo hi > /tmp/hello && rm /etc/nginx/conf.d/default.conf'
docker diff scratchpad
# C /etc/nginx/conf.d
# D /etc/nginx/conf.d/default.conf
# C /tmp
# A /tmp/hello

UPPER=$(sudo findmnt -N $SPID -no OPTIONS / | tr , '\n' | sed -n 's/^upperdir=//p')
sudo ls -la $UPPER/etc/nginx/conf.d/
# c--------- 1 root root 0, 0 ... default.conf
```

The deleted file didn't disappear from the image. It can't, the image is read-only. Instead overlayfs dropped a <u>whiteout</u> into the upper layer: a character device with device number 0,0 that means "pretend this file doesn't exist." That's also why deleting a big file in a later Dockerfile `RUN` step never makes the image smaller. The file is still sitting in the earlier layer, just hidden by a whiteout.

Copy up has a cost worth knowing. Modify one byte of a 2 GB file from a lower layer and overlayfs copies all 2 GB up first. That's why databases and anything else that rewrites big files belong on a <u>volume</u>, which bypasses the union filesystem entirely.

### Storage drivers, then and now

The 2016 post had a tidy pros and cons table for picking a storage driver. The short version of the update is that the decision got made for you:

| Driver | 2016 | 2026 |
|---|---|---|
| `aufs` | Ubuntu's default, never merged into the mainline kernel | deprecated in 19.03, removed in 24.0 |
| `devicemapper` | RHEL's default, needed direct-lvm to be production worthy | deprecated in 18.09, removed in 25.0 |
| `overlay` | "the future," but burned through inodes with heavy container churn | deprecated in 18.09, removed in 24.0 |
| `overlay2` | didn't exist yet | the default everywhere. Fixed the inode problem by supporting many lower layers natively |
| `btrfs`, `zfs` | build pools, next-gen distros | still supported if your root filesystem is one of them |
| containerd snapshotters | not a thing | the default for new Docker 29 installs, using overlayfs underneath. Graph drivers are deprecated |

If you're running anything other than overlay2 or the containerd overlayfs snapshotter in 2026, you probably know exactly why, and I'm not going to argue with you.

---

## Volumes

*The part of a container that survives `docker rm`.*

The container layer has two problems for anything that matters. It dies with the container, and it's slow for heavy writes because of copy up. <u>Volumes</u> solve both by mounting something from outside the union filesystem straight into the container's mount namespace. There are three kinds:

<figure class="img-l">
  <img src="/images/2026-11-15-docker-internals/volumes.svg" alt="A container's root filesystem is an overlay mount, with three other mounts beside it that bypass overlayfs: a bind mount of a host directory, a named volume stored under /var/lib/docker/volumes, and a tmpfs mount that lives in RAM" loading="lazy">
  <figcaption>Figure: three ways around the union filesystem</figcaption>
</figure>

- A <u>bind mount</u> maps any host path into the container: `-v /srv/pgdata:/var/lib/postgresql`. The host owns the path, Docker just mounts it.
- A <u>named volume</u> is a directory Docker manages for you, under `/var/lib/docker/volumes/<name>/_data` with the default `local` driver: `-v pgdata:/var/lib/postgresql`. Docker 1.9 is where volumes became first class objects with their own `docker volume` commands, and this is the kind you should reach for by default.
- A <u>tmpfs mount</u> lives in RAM and vanishes when the container stops: `--tmpfs /run:size=16m`.

You can see that they really do sidestep overlayfs. They show up as separate mounts in the container's mount namespace, sitting on top of the overlay root:

```bash
docker volume create --label lab=internals scratchvol
docker run -d --name mounty --label lab=internals \
  -v scratchvol:/data --tmpfs /cache:size=8m alpine sleep infinity
sudo findmnt -N $(docker inspect -f '{{.State.Pid}}' mounty) -o TARGET,SOURCE,FSTYPE | grep -E 'overlay|/data|/cache'
docker volume inspect -f '{{.Mountpoint}}' scratchvol
```

### The VOLUME instruction

A `VOLUME /var/lib/postgresql` line in a Dockerfile tells Docker "this path should never live in the container layer." If you don't mount anything there yourself, Docker creates an <u>anonymous volume</u> for it on every `docker run`. Those outlive `docker rm` unless you used `--rm`, and they have 64 character hex names, which is why `docker volume ls` on any machine older than a month looks like a ransom note.

Volumes are also not part of the image. `docker commit`, `docker export`, `docker push` and `docker pull` all skip whatever is mounted, by design. If your "backup" plan is committing the container, it is not a backup plan.

### Mount options worth knowing

```bash
# read only, so the container can't write back to the host
-v /srv/config:/etc/app:ro

# SELinux: relabel the content so the container is allowed to read it
-v /srv/pgdata:/var/lib/postgresql:Z    # private label, this container only
-v /srv/shared:/shared:z                # shared label, any container
```

The `:Z` and `:z` suffixes matter on Fedora and RHEL. Without them, SELinux blocks the container from touching the files no matter what the Unix permissions say, and the error looks exactly like a permissions bug. In 2016 you'd fix that by hand with `chcon -Rt svirt_sandbox_file_t /srv/pgdata`. The type is called `container_file_t` now, and the suffix does the relabel for you. Don't put `:Z` on a system directory like `/home` or `/usr`, because it will happily relabel the whole thing for one container and break the host.

Single file bind mounts (`-v /srv/nginx.conf:/etc/nginx/nginx.conf`) carry a sharp edge. A bind mount pins an <u>inode</u>, not a path. Lots of editors, depending on settings, save by writing a new file and renaming it over the old one. That's a new inode, and the container keeps seeing the old one until it restarts. You edit the config, reload nginx, nothing changes, and you lose twenty minutes questioning your sanity. Mount the directory instead of the file.

`-v` versus `--mount`: they do the same thing, but `--mount type=bind,src=...,dst=...` is explicit and refuses to run if the host path doesn't exist. `-v` will silently create a missing host path as an empty directory owned by root, which is how a typo in a path turns into a database starting up on an empty data directory.

Bind mounts are also `rprivate` by default, meaning mounts created later on the host under that path don't show up inside the container. If you need them to (mounting a USB drive under a shared directory, say), that's the `:rshared` propagation option.

### Sharing, and data that leaves the host

`--volumes-from other-container` mounts every volume of another container into this one. In 2015 that powered the "data-only container" pattern, a container that existed only to hold volumes for others. Named volumes made it obsolete, but the flag still works.

The 2016 answer for storage beyond one host was `--volume-driver` and a third party plugin. Most of those plugins are gone. The built-in `local` driver can mount NFS or CIFS directly, which covers a lot of cases:

```bash
docker volume create --driver local --label lab=internals \
  --opt type=nfs --opt o=addr=10.0.0.20,rw,nfsvers=4.1 \
  --opt device=:/exports/pgdata nfsdata
```

For anything bigger, orchestrators took over the problem: Kubernetes uses CSI drivers to attach cloud disks to whichever node the pod lands on.

The opposite of all this is `--read-only`, which mounts the container layer itself read-only. Pair it with a tmpfs for the paths that genuinely need to be writable and you get a container that can't be modified at runtime, which is a lovely property for anything internet facing:

```bash
docker run --rm --read-only --tmpfs /tmp:size=16m --label lab=internals alpine \
  sh -c 'touch /etc/nope 2>&1; touch /tmp/fine && echo "/tmp is writable"'
# touch: /etc/nope: Read-only file system
# /tmp is writable
```

---

## Runtimes

*Docker was never the only way to start one.*

Everything up to this point has been kernel features. A container runtime is just the program that calls them in the right order. Docker's is runc, but the original post took a tour of the alternatives, and they're worth knowing because each one shows you the same kernel features from a different angle.

### LXC

Docker ran on top of LXC until version 0.9 replaced it with libcontainer, and the LXC driver was dropped entirely in 1.10. LXC itself is very much alive ([linuxcontainers.org](https://linuxcontainers.org/lxc/introduction/)), and it leans toward <u>system containers</u>: a full init system and a whole distro inside, closer to a lightweight VM than to Docker's one-process-per-container model.

```bash
sudo apt install lxc
sudo lxc-checkconfig                    # what your kernel supports
sudo lxc-create -n box -t download -- -d alpine -r 3.22 -a amd64
sudo lxc-start -n box
sudo lxc-ls --fancy
sudo lxc-attach -n box -- cat /etc/os-release
sudo lxc-stop -n box && sudo lxc-destroy -n box
```

The image server only keeps recent releases, so if 3.22 has rotated out by the time you read this, run `lxc-create -t download -- --list` and pick whatever's there. There's also `lxc-freeze` (the freezer cgroup), `lxc-snapshot`, `lxc-console` (exit with Ctrl+a q) and `lxc-top` for live cgroup usage.

The friendlier daemon on top of LXC, LXD, had a messier decade. Canonical pulled it in house in 2023, and the community forked it as [Incus](https://linuxcontainers.org/incus/), which is where most of the original LXD team went:

```bash
incus launch images:debian/13 box
incus exec box -- bash
```

### systemd-nspawn

Originally written to test systemd itself without rebooting a real machine, nspawn turned into the most minimal "the OS already has containers built in" option. rkt used it to run containers, and if you have systemd you already have it. The manager on top is `machinectl` ([docs](https://www.freedesktop.org/software/systemd/man/latest/systemd-nspawn.html)).

```bash
# build a Debian root filesystem where machinectl looks for machines
sudo debootstrap --include=systemd,dbus trixie /var/lib/machines/trixie http://deb.debian.org/debian

# run one command inside it, here to set a root password
sudo systemd-nspawn -D /var/lib/machines/trixie passwd

# boot it properly, with a host directory bind mounted in
sudo systemd-nspawn -bD /var/lib/machines/trixie --bind /srv/share:/mnt/share
```

`-b` boots the container's own systemd as PID 1 and drops you at its login prompt. Press Ctrl+] three times quickly to get out. For something that runs in the background, let `machinectl` manage it:

```bash
sudo machinectl start trixie
machinectl list
machinectl status trixie
sudo machinectl login trixie

# or skip the login entirely and walk into its namespaces
LEADER=$(machinectl show trixie -p Leader --value)
sudo nsenter -t $LEADER -m -u -i -n -p
```

That last `nsenter` is the same trick from the namespaces section. It works on any container, from any runtime, because they're all just processes with namespaces.

If you want to go one step further and build a runtime yourself, [rubber-docker](https://github.com/Fewbytes/rubber-docker) is a workshop that walks you through writing one in Python, one syscall at a time. It's the best way I know to make this whole post stick.

### runc

runc is libcontainer spun out of Docker, donated to the OCI, and turned into the <u>reference implementation</u> of the OCI runtime spec. Docker, containerd, Podman and Kubernetes all end up calling it (or a drop-in replacement) to actually create the process. It has no daemon, no image management, no networking. It takes a <u>bundle</u> (a root filesystem plus a `config.json`) and runs it. Install it from your distro or grab a static binary from [GitHub releases](https://github.com/opencontainers/runc/releases).

Running a container with nothing but runc, using Docker only to get a root filesystem:

```bash
mkdir -p ~/oci/busybox/rootfs && cd ~/oci/busybox

# flatten an image into a plain directory
CID=$(docker create --label lab=internals busybox)
docker export $CID | tar -C rootfs -xf -

runc spec            # writes a default config.json
sudo runc run demo   # create and start, attached to your terminal
```

You're now in a busybox shell that Docker knows nothing about. `ps` shows two processes. Exit, and it's gone. Take a minute to appreciate everything Docker was doing for you: pulling, unpacking, networking, logging, restart policies. runc does exactly one thing.

One thing changed since 2016: back then `runc start` created and ran a container in one go. Now that's `runc run`, and the lifecycle is split into separate steps (`runc create`, then `runc start`), which is how higher level tools use it. The full command list: `create`, `start`, `run`, `exec`, `ps`, `state`, `list`, `pause`, `resume`, `kill`, `delete`, `update`, `events`, `checkpoint`, `restore`, `spec`, `features`.

You don't need Docker to get a rootfs either. `debootstrap` builds one, as in the nspawn example, and [skopeo](https://github.com/containers/skopeo) plus [umoci](https://github.com/opencontainers/umoci) pull a real image straight from a registry into an OCI bundle, `config.json` included:

```bash
skopeo copy docker://docker.io/library/alpine:latest oci:alpine:latest
sudo umoci unpack --image alpine:latest bundle
sudo runc run -b bundle demo2
```

`config.json` also supports <u>hooks</u>: binaries runc calls at points in the lifecycle (`createRuntime`, `createContainer`, `startContainer`, `poststart`, `poststop`). Each hook gets the container's state, including its PID, as JSON on stdin. This is where you'd create a veth pair, plug it into a bridge, and write the iptables rules yourself, in other words do Docker's networking by hand:

```json
"hooks": {
  "createRuntime": [
    { "path": "/usr/local/bin/lab-netns.sh", "args": ["lab-netns.sh", "br-lab"] }
  ]
}
```

runc isn't the only OCI runtime anymore. [crun](https://github.com/containers/crun) is a faster one written in C and is the default for Podman on Fedora and RHEL. [youki](https://github.com/youki-dev/youki) is one in Rust. [gVisor](https://gvisor.dev/)'s `runsc` puts a user space kernel between the container and yours, and [Kata Containers](https://katacontainers.io/) runs each one in a tiny VM. Since they all speak the same spec, swapping is one flag: `docker run --runtime runsc ...`.

### Who actually starts your container

So when you type `docker run`, what actually happens? The 2016 post saw containerd coming as an alpha. It shipped, and the call chain today looks like this:

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/runtime-chain.svg" alt="The docker CLI sends HTTP over /var/run/docker.sock to dockerd, which calls containerd over gRPC, which starts containerd-shim-runc-v2, which runs runc. runc sets up namespaces, cgroups and the rootfs, starts the process and exits, leaving the shim as the container process's parent" loading="lazy">
  <figcaption>Figure: five programs, and only one of them is still around once the container is up</figcaption>
</figure>

1. The `docker` CLI sends an HTTP request over the Unix socket at `/var/run/docker.sock`.
2. `dockerd` handles the high level stuff: images, networks, volumes, the API.
3. It hands the container to `containerd` over gRPC.
4. containerd starts a <u>shim</u>, `containerd-shim-runc-v2`, one per container.
5. The shim runs `runc`, which builds the namespaces, cgroup and root filesystem, starts your process, and then <u>exits</u>.

The shim stays behind as the container's parent. It holds stdin and stdout, collects the exit code, and means the container doesn't care if `dockerd` or `containerd` restart. That's what makes `"live-restore": true` in `daemon.json` possible, upgrading the daemon without killing your containers. You can see the family tree:

```bash
PID=$(docker inspect -f '{{.State.Pid}}' sleepy)
pstree -s -p $PID
# systemd(1)───containerd-shim(2817)───sleep(48213)

sudo ctr -n moby containers ls   # containerd's own view, Docker uses the "moby" namespace
sudo ctr -n moby tasks ls
```

No `dockerd` in that tree, and no `runc` either. Podman does the same thing without a daemon at all: its equivalent of the shim is called `conmon`. Kubernetes skips Docker entirely and talks straight to containerd or CRI-O.

---

## Talking to the daemon

*Everything the CLI does, you can do with curl.*

The `docker` CLI is just an HTTP client. The [Engine API](https://docs.docker.com/reference/api/engine/) lives on that Unix socket, and you can talk to it directly:

```bash
curl -s --unix-socket /var/run/docker.sock http://localhost/version | jq
curl -s --unix-socket /var/run/docker.sock \
  'http://localhost/containers/json?filters={"label":["lab=internals"]}' | jq '.[].Names'
```

Docker 29 raised the minimum API version to 1.44, so very old clients and libraries will get rejected with an error telling you exactly that. Upgrade the client rather than lowering the minimum.

### Events

The interesting part of the API for anyone building on top of Docker is the <u>event stream</u>. Every state change for containers, images, networks and volumes gets emitted as an event:

<figure class="img-l">
  <img src="/images/2026-11-15-docker-internals/container-lifecycle.svg" alt="Container lifecycle state machine: created, running, paused, exited and removed, with the events emitted on each transition: create, start, pause, unpause, kill, die, oom, stop, restart and destroy" loading="lazy">
  <figcaption>Figure: every arrow in this diagram shows up in docker events</figcaption>
</figure>

```bash
docker events --filter label=lab=internals --format '{{json .}}'
```

Run that in one terminal, then `docker restart sleepy` in another, and watch `kill`, `die`, `stop`, `start` and `restart` scroll past.

If you do detection work, there's a free detection hiding in here. Every `docker exec` emits an `exec_start` event with the command in it:

```bash
docker events --filter type=container --filter event=exec_start \
  --format '{{.TimeNano}} {{.Actor.Attributes.name}} {{.Action}}'
# 1763193612438121000 web1 exec_start: sh -c id; cat /etc/shadow
```

Somebody popping a shell inside a production container is rarely good news, and here it is, handed to you by the daemon in one line of JSON.

The 2016 examples of tools built on events were docker-gen, which rewrote Nginx configs from container metadata, and Interlock, which did dynamic load balancing on Swarm. [docker-gen](https://github.com/nginx-proxy/docker-gen) is still around, powering nginx-proxy. Interlock is long archived. The tool that really took the idea mainstream is [Traefik](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/), which watches events and reconfigures its routing from container labels as containers come and go. For monitoring, `docker stats` reads from the same API (`/containers/<id>/stats`), and [cAdvisor](https://github.com/google/cadvisor) still does the job of exporting cgroup stats for every container to Prometheus.

### Registry notifications

The registry can send its own events: a <u>webhook</u> on every push, pull or delete. In Distribution it's a few lines in the config:

```yaml
notifications:
  endpoints:
    - name: lab-hook
      url: http://10.0.0.5:9000/hook
      timeout: 1s
      threshold: 5
      backoff: 10s
```

Each notification is a JSON envelope with the repository, tag, digest and who did it. That's the whole mechanism behind "push to the registry, the server redeploys itself": a small service catches the webhook, pulls the new tag, and replaces the running container. The 2016 example of this, Conduit, is gone, but every CD pipeline that reacts to an image push does the same dance. Docker Hub has its own webhooks with the same idea.

### Compose events

Compose has its own event stream too, scoped to the services in your project:

```bash
docker compose events --json
```

Pair it with a small dispatcher and you have per-service hooks without any extra tooling. Mine looks for an executable named after the action and runs it with the service name:

```bash
#!/usr/bin/env bash
# compose-hooks.sh: run ./hooks/<action>.sh <service> for every compose event
set -uo pipefail

docker compose events --json | while read -r event; do
  action=$(jq -r '.action' <<<"$event")
  service=$(jq -r '.service' <<<"$event")
  hook="./hooks/${action}.sh"
  if [[ -x "$hook" ]]; then
    "$hook" "$service" "$event"
  fi
done
```

Drop a `hooks/die.sh` that pings you on Discord, and you've got crash alerts for your homelab in about ten lines. Before you build your own orchestrator out of this, though, check whether Traefik, Watchtower-style updaters or Kubernetes already do what you want. They usually do.

---

## The format wars

*Spoiler: everyone agreed to agree.*

When the original post was written, it looked like containers might split into incompatible camps. Docker had the users. CoreOS had a spec. Everyone else had opinions. Here's how that played out.

### appc and rkt

CoreOS announced <u>appc</u> in December 2014, a spec that took Docker's ideas and tried to fix what they saw as gaps:

- **Image format (ACI).** A root filesystem plus a manifest, initially modeled on Docker's format. The notable difference: an ACI had to declare every mount point it needed up front, so you could read the manifest and know exactly what volumes to provide. Docker let you mount anything anywhere, which is flexible but means the image can't tell you what it expects. Manifests could also use labels to declare things like the kernel the image required, since containers share the host kernel.
- **Signing.** Every image came with a detached GPG signature that the runtime verified before running anything. Crude, but it was there by default, which is more than Docker could say in 2015.
- **Discovery.** No default registry. An image name like `example.com/app` resolved through meta tags served at that domain over HTTPS, so you could host images anywhere, even over BitTorrent, without a central authority.
- **Runtime.** It defined the <u>pod</u> as the unit of execution: several apps in one shared environment, each with its own restart policy. Plus volumes, resource "isolators" (cgroup settings that had to be declared), logging, and networking through plugins.
- **Tooling.** Deliberately boring. An ACI is a tarball, so `tar`, `gzip` and `gpg` were enough to build and sign one. `actool` handled building and validation, and `docker2aci` converted Docker images.

<u>rkt</u> was the runtime that implemented it, in three stages. Stage 0 fetched, verified and unpacked the image. Stage 1 set up the execution environment, by default with systemd-nspawn, with a KVM flavor for VM isolation. Stage 2 was your actual app. There was no long running daemon: the container's processes sat directly under the cgroup rkt created, which was a real point of difference from Docker at the time. Brandon Philips, CoreOS's CTO at the time, walks through the whole design in his [appc slides from MesosCon 2015](https://speakerdeck.com/philips/appc-plus-mesos-at-mesoscon-2015), including how it compared to the OCI runtime format that was about to replace it.

rkt was archived by the CNCF in 2019. But look at that list again. Pods became Kubernetes. The networking plugin model became <u>CNI</u>, which started life inside rkt and is now the networking standard for every Kubernetes cluster. Mandatory signing became sigstore. appc lost and still won.

### The Open Container Initiative

The <u>OCI</u> formed in June 2015, with Docker donating its image format and runc, and the appc maintainers joining to merge the best of both. In 2016 it only covered the runtime. It now has three specs:

| Spec | What it defines | 1.0 |
|---|---|---|
| [runtime-spec](https://github.com/opencontainers/runtime-spec) | the bundle and `config.json`, and how a runtime must run it | July 2017 |
| [image-spec](https://github.com/opencontainers/image-spec) | manifests, layers, configs, indexes for multi-arch images | July 2017 |
| [distribution-spec](https://github.com/opencontainers/distribution-spec) | the registry HTTP API for push and pull | May 2021 |

Image-spec 1.1 (2024) added <u>artifacts</u> and the referrers API, which lets a registry store things like SBOMs and signatures alongside the image they describe. That's the long answer to the 2016 question of how to know what's inside an image and who made it.

Because everything speaks OCI, the format wars ended quietly. An image built with `docker build` runs on containerd, CRI-O, Podman or a bare runc bundle without anyone converting anything.

### containerd

The 2016 post installed containerd 0.0.5 from a GitHub release and called it the future plumbing of Docker Engine. It was right. containerd became the supervisor between `dockerd` and runc, then a standalone runtime in its own right. It went to the CNCF in 2017, graduated in 2019, shipped 2.0 in late 2024, and as of Docker 29 it manages the images on new installs too. Its own CLI, `ctr`, is deliberately low level. For a friendlier one, [nerdctl](https://github.com/containerd/nerdctl) gives you Docker's command syntax on top of containerd with no `dockerd` at all.

### Signing, then and now

appc signed with detached GPG signatures. Docker answered with Notary, an implementation of <u>The Update Framework</u> (TUF): a signed index of everything in a repository, a bit like an apt or yum repo's metadata. Both have mostly given way to [Sigstore](https://www.sigstore.dev/)'s `cosign` and the Notary Project's `notation`, which store signatures in the registry as OCI artifacts. Kubernetes signs all of its release images with cosign, so you can check one right now:

```bash
cosign verify registry.k8s.io/kube-apiserver-amd64:v1.33.0 \
  --certificate-identity krel-trust@k8s-releng-prod.iam.gserviceaccount.com \
  --certificate-oidc-issuer https://accounts.google.com | jq '.[0].critical.identity'
```

No GPG keyring to manage, no key to lose. The signature is tied to an identity and logged in a public transparency log, so anyone can check who signed what, and when.

---

## Putting it together: PostgreSQL in a container

*Every abstraction in this post, stress tested by one stubborn database.*

Jignesh's deck spends its second half on running PostgreSQL in Docker, and it's a good choice of case study. A database cares about everything this post covered: memory accounting, shared memory and IPC, disk layout, process trees, networking. Here's the same walkthrough, redone for 2026, with the internals pointed out as we go.

<figure class="img-feat">
  <img src="/images/2026-11-15-docker-internals/postgres-layout.svg" alt="A PostgreSQL container with its postmaster and background processes inside a cgroup with memory, CPU and PID limits. The container's memory budget is split into shared buffers, backend work memory, page cache and /dev/shm. Separate volumes hold the data directory, the write ahead log and the WAL archive, and a metrics exporter shares its network namespace like a pod" loading="lazy">
  <figcaption>Figure: one database, every section of this post in a single diagram</figcaption>
</figure>

### The quick version

```bash
docker network create --label lab=internals pgnet
docker volume create --label lab=internals pgdata
printf 'lab-only-password\n' > pg_pass && chmod 600 pg_pass

docker run -d --name pg --label lab=internals --network pgnet \
  -v pgdata:/var/lib/postgresql \
  -v "$PWD/pg_pass:/run/secrets/pg_pass:ro" \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/pg_pass \
  postgres:18

docker ps --filter name=pg
docker logs pg | tail -5     # initdb output, then "database system is ready to accept connections"
docker inspect -f '{{json .Mounts}}' pg | jq
```

Three things in there that the 2016 version did differently, on purpose.

**The password comes from a file.** The usual `-e POSTGRES_PASSWORD=...` puts the password into the container's config, where `docker inspect` shows it to anyone who can reach the Docker socket, and into `/proc/<pid>/environ` on the host. The official image reads `*_FILE` variants of its settings, so the secret only ever exists as a read-only bind mount.

**The volume goes on `/var/lib/postgresql`, not `/var/lib/postgresql/data`.** Starting with Postgres 18, the official image moved its `VOLUME` up a level and keeps the data in a version-numbered directory beneath it, so a future `pg_upgrade` can see the old and new data directories on the same mount. Mount the old path on an 18 image and it refuses to start. Every Compose file copied from a pre-2025 blog post now breaks in exactly this way.

**There's no `--link`.** The deck linked an app container to the database with `--link mycontainer:ds2db`. A user-defined network does the same job with real DNS:

```bash
docker run --rm --label lab=internals --network pgnet \
  -e PGPASSWORD="$(cat pg_pass)" postgres:18 \
  psql -h pg -U postgres -c 'select version();'
```

The image's Dockerfile says `EXPOSE 5432`, and that line doesn't open anything. `EXPOSE` is documentation: it records the port in the image config so `-P` knows what to publish, and that's all. Other containers on `pgnet` can reach 5432 because they share a bridge, not because of `EXPOSE`. Clients outside Docker need `-p`, and after the ufw story from the networking section, you know to bind it to localhost unless you mean it. The production layout further down does exactly that, and `docker port` confirms where it landed.

### Looking at it from the host

```bash
docker stats --no-stream pg
docker top pg
```

`docker top` lists the postmaster and its children: `checkpointer`, `background writer`, `walwriter`, `autovacuum launcher`, `logical replication launcher`, plus the I/O workers new in 18. Look at the UID column. On my box it says `999`. In Jignesh's 2016 deck, on a CentOS host, the exact same column said `polkitd`.

That's not a typo, it's namespaces. Without a user namespace, the kernel only knows the process runs as UID 999, the `postgres` user inside the image. `docker top` resolves that number against the host's `/etc/passwd`, and on that CentOS box UID 999 happened to belong to polkit. The container's idea of who it is and the host's idea are two different files that happen to share a number. That mismatch is also why bind-mounted data directories end up owned by some random host user, and why user namespaces exist.

The systemd view tells the same story from the cgroup side:

```bash
systemd-cgls -u system.slice | grep -A8 "docker-$(docker inspect -f '{{.Id}}' pg)"
systemd-cgtop -m -n 1 | grep docker-
```

`systemd-cgls` shows the container's scope with every Postgres process inside it. Up under `docker.service`, separately, sit `dockerd` and any `docker-proxy` processes for published ports. `systemd-cgtop` gives you per-cgroup CPU, memory and I/O, and that memory number holds the first surprise.

### Memory, again

By default the container can use all of the host's memory, and it can see all of it too: `free` or `/proc/meminfo` inside a container reports the host's totals, because `/proc/meminfo` isn't namespaced. Postgres will happily size itself for a 64 GB host while sharing that host with forty other containers. So set a limit, and then remember two things.

<u>The page cache counts.</u> Remember file-backed pages from the memory controller section? Postgres reads data through the kernel page cache, and every one of those pages is charged to the container's cgroup. A database doing nothing but reads will drift up toward its limit and sit there. That's healthy, those pages are cheap to reclaim, but it makes `docker stats` look alarming and fools anyone alerting on raw usage. Alert on `memory.pressure` or `oom_kill` in `memory.events` instead.

<u>Nothing tunes itself to the limit.</u> The image ships Postgres with its stock `shared_buffers` of 128 MB whether you give it 512 MB or 64 GB, and `effective_cache_size` should describe the container's memory, not the host's. Pass settings as arguments after the image name and they go straight to the `postgres` process.

### Shared memory, the long way round

This one has history. Up to 9.2, Postgres kept `shared_buffers` in one big System V shared memory segment, and the kernel's default `kernel.shmmax` was far too small for any real configuration. Raising it meant a sysctl on the host, or a privileged container, which is how a lot of people learned to type `--privileged` without thinking. Jignesh wrote up exactly that problem at the time. Postgres 9.3 moved the main buffer pool to anonymous `mmap` and kept only a tiny System V segment, and the problem went away. The `kernel.shm*` sysctls live in the IPC namespace these days anyway, so `--sysctl kernel.shmmax=...` works without any extra privilege.

The modern version of the same headache is `/dev/shm`. Docker gives every container a 64 MB tmpfs there. Postgres puts its dynamic shared memory for parallel queries in `/dev/shm`, and a big parallel hash join blows straight through 64 MB with `could not resize shared memory segment ... No space left on device`. The fix is one flag: `--shm-size`.

The last memory gotcha is what an OOM kill looks like. If one backend crosses `memory.max` and gets `SIGKILL`ed, the postmaster can't trust shared memory anymore. It terminates every other backend, runs crash recovery from the WAL, and comes back. One runaway query becomes every connection dropped at once. Leave headroom between `shared_buffers` plus all the per-connection `work_mem` and the container limit.

### A layout for something you'd actually run

The deck's checklist for a production image holds up well: proper memory limits, tuned shared memory, separate volumes for the different kinds of data, extensions, replication and monitoring. With current flags:

```bash
docker volume create --label lab=internals pgprod-data
docker volume create --label lab=internals pgprod-wal
docker volume create --label lab=internals pgprod-archive

docker run -d --name pg-prod --label lab=internals --network pgnet \
  --memory 4g --memory-reservation 3g --shm-size 1g \
  --cpus 2 --pids-limit 512 \
  -p 127.0.0.1:5432:5432 \
  -v pgprod-data:/var/lib/postgresql \
  -v pgprod-wal:/pgwal \
  -v pgprod-archive:/pgarchive \
  -v "$PWD/pg_pass:/run/secrets/pg_pass:ro" \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/pg_pass \
  -e POSTGRES_INITDB_WALDIR=/pgwal \
  postgres:18 \
    -c shared_buffers=1GB \
    -c effective_cache_size=2560MB \
    -c archive_mode=on \
    -c archive_command='test ! -f /pgarchive/%f && cp %p /pgarchive/%f'

docker port pg-prod
# 5432/tcp -> 127.0.0.1:5432
```

`--memory-reservation 3g` is the `memory.low` protection from the cgroups section: under host memory pressure, the kernel reclaims from everyone else before it touches the database's first 3 GB. `effective_cache_size` is set to what's left of the 4 GB after `shared_buffers`, since that's all the page cache this container can ever hold.

Here's what each volume is for:

- **Data directory.** The tables themselves.
- **Write ahead log.** `pg_xlog` in the 2016 deck, renamed `pg_wal` in Postgres 10 because too many people saw a directory called "log" filling the disk and deleted it. WAL writes are sequential and latency sensitive, so on real hardware this goes on a different disk than the data.
- **WAL archive.** Every completed WAL segment gets copied here, which, with a base backup from `pg_basebackup`, gives you <u>point in time recovery</u>. Tablespaces and a backup directory would each get their own volume the same way.

For extensions, build on top of the official image. It already has the PostgreSQL apt repository configured, so most extensions are one package away:

```dockerfile
FROM postgres:18
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-pgvector \
 && rm -rf /var/lib/apt/lists/*
```

And for monitoring, the "favorite monitoring agent" from the deck becomes a sidecar that joins the database's network namespace, exactly like the pod from the security section:

```bash
docker run -d --name pg-metrics --label lab=internals \
  --network container:pg-prod \
  -e DATA_SOURCE_NAME="postgresql://postgres:$(cat pg_pass)@localhost:5432/postgres?sslmode=disable" \
  quay.io/prometheuscommunity/postgres-exporter
```

Yes, that puts a password in an environment variable three sections after I told you not to. It's a lab. Do as I say.

Replication, failover and backup scheduling are where hand-rolled `docker run` commands stop scaling. In 2016 the answer was "build a more custom image." In 2026 it's usually a Kubernetes operator like [CloudNativePG](https://cloudnative-pg.io/), which runs everything above, in a pod per instance, and handles the replicas for you. Underneath it's still a process in a cgroup with some namespaces and a few volumes. Nothing about the internals changed. Someone just automated the typing.

---

## exit 0

*Cleaning up after ourselves, because I said we would.*

Remember the label?

```bash
docker rm -f $(docker ps -aq --filter label=lab=internals)
docker volume rm $(docker volume ls -q --filter label=lab=internals)
docker network rm lab-a lab-b pgnet
sudo rmdir /sys/fs/cgroup/demo 2>/dev/null
rm -f pg_pass
```

Every container and volume from this post, gone in two lines. That's the label paying for itself.

So, back to the opening question. What is a container? It's a process. It has a handful of namespaces so it can't see much, a cgroup so it can't use much, an overlay mount pretending to be its root filesystem, a veth pair and some iptables rules pretending to be its network card, a capability set and a seccomp filter limiting what it can ask the kernel for, and a shim babysitting it after runc has already left the building. That's a bunch of kernel features standing on each other's shoulders in a trench coat, and Docker is the one who taught them to walk in a straight line.

Next up is the fun part: everything that happens when one of those layers isn't there. Huge thanks to the Docker Saigon crew for the original. Ten years later, it's still the best map of this territory I've found, it just needed new street names.

---

## References

*Everything this post leaned on, in one place.*

**The posts and talks this one is built on**

- Docker Saigon, [Docker Internals](https://docker-saigon.github.io/post/Docker-Internals/) (February 2016). The original, and the outline for this post.
- Jignesh Shah, [PostgreSQL and Linux Containers](https://www.slideshare.net/jkshah/postgresql-and-linux-containers), SF Bay Area PostgreSQL User Group. The source for the history, the volumes material and the PostgreSQL case study.
- Jérôme Petazzoni, [Cgroups, namespaces, and beyond: what are containers made from?](https://www.youtube.com/watch?v=sK5i-N34im8), DockerCon EU 2015.
- Brandon Philips, [appc + mesos](https://speakerdeck.com/philips/appc-plus-mesos-at-mesoscon-2015), MesosCon 2015.
- Rami Rosen, [Resource management: Linux kernel Namespaces and cgroups](http://www.haifux.org/lectures/299/netLec7.pdf) and [Linux Containers and the Future Cloud](http://www.haifux.org/lectures/320/netLec8_final.pdf), Haifux lectures. Kernel-level walkthroughs of how both features are implemented.

**Kernel and system documentation**

- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html), [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) and [unshare(1)](https://man7.org/linux/man-pages/man1/unshare.1.html) manual pages.
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html), the kernel admin guide.
- [systemd](https://systemd.io/) and [systemd-nspawn](https://www.freedesktop.org/software/systemd/man/latest/systemd-nspawn.html).
- [linuxcontainers.org](https://linuxcontainers.org/) for [LXC](https://linuxcontainers.org/lxc/introduction/), [Incus](https://linuxcontainers.org/incus/) and LXCFS, the project that makes `/proc/meminfo` tell containers the truth.

**Docker**

- [Docker Engine v29: Foundational Updates for the Future](https://www.docker.com/blog/docker-engine-version-29/), for the containerd image store, nftables and the API minimum.
- [Deprecated Docker Engine features](https://docs.docker.com/engine/deprecated/), for when each storage driver, cgroup v1 and legacy links were retired.
- [Seccomp security profiles](https://docs.docker.com/engine/security/seccomp/), [Rootless mode](https://docs.docker.com/engine/security/rootless/) and the [Engine API](https://docs.docker.com/reference/api/engine/).
- [docker-library/postgres issue 1370](https://github.com/docker-library/postgres/issues/1370), on the Postgres 18 volume path change.

**Specs and runtimes**

- The OCI [runtime](https://github.com/opencontainers/runtime-spec), [image](https://github.com/opencontainers/image-spec) and [distribution](https://github.com/opencontainers/distribution-spec) specs.
- [runc](https://github.com/opencontainers/runc/releases), [crun](https://github.com/containers/crun), [youki](https://github.com/youki-dev/youki), [gVisor](https://gvisor.dev/) and [Kata Containers](https://katacontainers.io/).
- [CNCF Distribution](https://github.com/distribution/distribution), [Harbor](https://goharbor.io/) and [Sigstore](https://www.sigstore.dev/).

**Tools used in the demos**

- [netshoot](https://github.com/nicolaka/netshoot), [syft](https://github.com/anchore/syft), [tini](https://github.com/krallin/tini), [skopeo](https://github.com/containers/skopeo), [umoci](https://github.com/opencontainers/umoci), [nerdctl](https://github.com/containerd/nerdctl), [bane](https://github.com/genuinetools/bane), [cAdvisor](https://github.com/google/cadvisor), [docker-gen](https://github.com/nginx-proxy/docker-gen), [Traefik](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/) and [CloudNativePG](https://cloudnative-pg.io/).
- [rubber-docker](https://github.com/Fewbytes/rubber-docker), if you want to build your own runtime and make all of this stick for good.
