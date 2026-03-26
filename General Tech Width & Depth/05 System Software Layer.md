
---

## 💾 The Software Stack — From Power Button to Running OS


---

### The Big Picture First

```
YOU PRESS POWER BUTTON
        ↓
BIOS/UEFI       ← firmware, lives on motherboard chip
        ↓
BOOTLOADER      ← tiny program that finds and loads the OS
        ↓
KERNEL          ← the core of the OS, takes over hardware
        ↓
INIT SYSTEM     ← starts all background services
        ↓
USER SPACE      ← your shell, desktop, apps
```

Each layer **hands control** to the next. Let's go through each.

---

## ⚡ Layer 1 — BIOS / UEFI

### What it is:
**Firmware** — software permanently stored on a small chip on your motherboard (a flash ROM chip). It is the very first code your CPU executes after power on. It exists before any OS, before any storage is read.

**BIOS** (Basic Input/Output System) — the original, from the 1980s. 16-bit, text UI, limited to booting from drives under 2TB.

**UEFI** (Unified Extensible Firmware Interface) — the modern replacement. 32/64-bit, graphical UI, supports drives over 2TB, faster boot, Secure Boot capability. All modern machines use UEFI. Still colloquially called "BIOS."

---

### What it does — **POST (Power-On Self Test):**

```
Power on
    ↓
CPU starts executing from a hardcoded memory address
(where the UEFI firmware lives)
    ↓
POST begins:
  - Is RAM present and working?
  - Are storage devices detected?
  - Is GPU responding?
  - Are all buses (PCIe, USB) operational?
    ↓
If hardware check fails → beep codes or error screen
If all good → hand off to Bootloader
```

### Other UEFI responsibilities:
- Holds hardware configuration (boot order, fan curves, overclocking settings, time)
- **Secure Boot** — cryptographically verifies the bootloader hasn't been tampered with
- Provides runtime services the OS can call early in boot
- On Linux: stored settings in NVRAM, accessible via `/sys/firmware/efi/`

---

## 🥾 Layer 2 — The Bootloader

### What it is:
A small program whose **only job** is to find the OS kernel on storage and load it into RAM.

UEFI reads the **ESP (EFI System Partition)** — a small FAT32 partition on your drive — and executes the bootloader stored there.

### The most important Linux bootloader: **GRUB2**
(Grand Unified Bootloader)

```
UEFI loads GRUB from ESP partition
    ↓
GRUB reads its config file (/boot/grub/grub.cfg)
    ↓
Shows boot menu (if multiple OSes exist)
    ↓
Loads the Linux Kernel image into RAM
(the vmlinuz file in /boot/)
    ↓
Loads initramfs into RAM
(temporary mini root filesystem)
    ↓
Hands control to the Kernel
```

### What is initramfs?
A temporary minimal filesystem loaded into RAM. The kernel needs *some* filesystem to work with before it can mount the real root filesystem on disk. initramfs contains just enough drivers and tools to:
- Load storage drivers
- Decrypt drives (if encrypted)
- Mount the real root filesystem
- Then hand off to the real OS

---

## 🧠 Layer 3 — The Kernel

This is where things get deep. The kernel is the **core of the OS** — the bridge between all software and all hardware.

### The Kernel's Fundamental Job:
**Manage and protect every resource** — CPU time, RAM, storage, network, devices — and give processes **controlled, safe access** to them.

No program ever touches hardware directly. Everything goes through the kernel.

---

### Kernel Space vs User Space

This is the most important OS concept:

```
┌─────────────────────────────────────┐
│           USER SPACE                │
│  Your apps, shell, browser, IDE     │
│  Run with limited privileges        │
│  Cannot directly touch hardware     │
├─────────────────────────────────────┤
│  SYSTEM CALL INTERFACE (syscalls)   │  ← the border crossing
├─────────────────────────────────────┤
│           KERNEL SPACE              │
│  Full hardware access               │
│  Manages CPU, RAM, devices, FS      │
│  Runs with full CPU privileges      │
└─────────────────────────────────────┘
         HARDWARE
```

When your app needs hardware — reading a file, sending a network packet, allocating memory — it makes a **system call** (syscall). This triggers a controlled switch from user space into kernel space, the kernel does the work, returns the result, switches back.

On Linux you can trace every syscall a program makes:
```bash
strace ls    # shows every syscall the 'ls' command makes
```

---

### The Kernel's Core Subsystems:

---

#### 🔧 1. Process Management

The kernel creates, schedules, and kills processes.

**What is a process?**
A running instance of a program. Contains:
- Its own virtual address space in RAM
- One or more threads
- File descriptors (open files, sockets)
- State (running, sleeping, stopped, zombie)

**What is a thread?**
A unit of execution within a process. Multiple threads share the same memory space but execute independently.

**The Scheduler:**
Your CPU has say 8 cores. You might have 300 processes running. The scheduler decides which process runs on which core and for how long.

Linux uses **CFS — Completely Fair Scheduler:**
- Tracks how much CPU time each process has received
- Always runs the process that has received the *least* CPU time relative to others
- Each process gets a tiny **time slice** (milliseconds), then gets preempted
- Higher priority processes (nice values) get larger slices

```bash
# Linux process management:
ps aux              # list all running processes
top / htop          # live process viewer
nice -n 10 command  # run with lower priority
kill -9 PID         # forcefully terminate process
/proc/PID/          # directory containing everything about a process
```

**Process states in Linux:**
```
R — Running (on CPU right now)
S — Sleeping (waiting for something, interruptible)
D — Uninterruptible sleep (waiting for I/O, can't be killed)
Z — Zombie (finished but parent hasn't collected exit status)
T — Stopped
```

---

#### 🗃️ 2. Memory Management

The kernel manages all RAM. No process can access memory it hasn't been given.

**Virtual Memory:**
Every process sees its own **private virtual address space** — as if it owns all the RAM on the machine. The kernel (via hardware MMU — Memory Management Unit) translates these virtual addresses to real physical RAM addresses.

```
Process A thinks it's at address 0x00007fff...
Process B thinks it's at address 0x00007fff...
    ↓
MMU + Kernel translate both to DIFFERENT physical RAM locations
    ↓
Processes are completely isolated — A cannot read B's memory
```

**Pages:**
RAM is divided into fixed-size chunks called **pages** (typically 4KB). Virtual memory is managed page by page.

**Page Faults:**
When a process accesses a virtual address that isn't yet backed by physical RAM, the CPU triggers a **page fault** — the kernel then allocates a physical page and maps it. This is normal and happens constantly.

**Swap:**
When RAM fills up, the kernel moves infrequently used pages to disk (swap partition or swap file). Accessing swapped pages is slow — but prevents crashes.

```bash
# Linux memory:
free -h                    # RAM and swap usage
/proc/meminfo              # detailed memory stats
vmstat                     # virtual memory statistics
cat /proc/PID/maps         # virtual memory map of a process
```

---

#### 📁 3. The Virtual File System (VFS)

One of Linux's most elegant designs. Linux represents **everything** as a file — not just files, but devices, processes, sockets, kernel state.

**VFS** is an abstraction layer that provides one unified interface for all of them, regardless of the actual filesystem underneath (ext4, NTFS, btrfs, tmpfs...).

```
Your program calls: open("/dev/sda", ...)
                         ↓
                       VFS
                         ↓
            Routes to the correct driver
            (block device driver, ext4, etc.)
```

**Linux filesystem hierarchy:**
```
/           ← root, everything starts here
├── bin/    ← essential binaries (ls, cp, bash)
├── boot/   ← kernel image, GRUB files
├── dev/    ← device files (hard drives, terminals, /dev/null)
├── etc/    ← system configuration files
├── home/   ← user home directories
├── lib/    ← shared libraries
├── proc/   ← virtual FS: live kernel and process info
├── sys/    ← virtual FS: hardware and driver info
├── tmp/    ← temporary files (cleared on reboot)
├── usr/    ← user programs and libraries
└── var/    ← logs, databases, variable data
```

`/proc` and `/sys` are not real disk directories — they're **virtual filesystems** generated live by the kernel. Reading `/proc/cpuinfo` doesn't read a file — it asks the kernel to generate CPU information on the fly.

```bash
cat /proc/cpuinfo       # CPU details, live from kernel
cat /proc/meminfo       # Memory details
cat /proc/net/dev       # Network interface stats
ls /dev/                # Every device on your system as a file
```

---

#### 🔌 4. Device Drivers

The kernel contains thousands of **drivers** — code that knows how to talk to specific hardware (GPU, NIC, USB controller, SSD).

When you plug in a USB drive:
```
Hardware signals interrupt to CPU
        ↓
Kernel's interrupt handler fires
        ↓
USB driver recognizes the device
        ↓
Storage driver mounts it as a block device
        ↓
VFS makes it accessible at /dev/sdb or similar
        ↓
You see it appear in your file manager
```

Linux drivers live in `/lib/modules/$(uname -r)/`

```bash
lsmod           # list loaded kernel modules (drivers)
modprobe nvidia # load the NVIDIA driver module
dmesg           # kernel message log — shows driver activity
uname -r        # current kernel version
```

---

#### 🌐 5. Network Stack

The kernel implements the entire TCP/IP stack we discussed. All network communication — your browser, your dev server, your SSH connection — goes through the kernel's network subsystem.

```bash
ss -tulnp       # show all open ports and listening processes
ip addr         # show network interfaces and IPs
ip route        # show routing table
/proc/net/      # live network stats from kernel
```

---

#### 🔐 6. Security & Permissions

Linux uses a **Unix permission model**:
- Every file has an owner (user + group)
- Three permission sets: owner, group, others
- Each can have read (r), write (w), execute (x)

```bash
ls -la          # show file permissions
chmod 755 file  # set permissions
chown user file # change owner
```

Beyond basic permissions, Linux has:
- **Capabilities** — fine-grained privilege splitting (instead of all-or-nothing root)
- **SELinux / AppArmor** — mandatory access control, restricts what processes can do even as root
- **Namespaces** — isolate processes from seeing each other's resources (foundation of containers/Docker)
- **cgroups** — limit CPU/RAM/IO a process or group can use (also Docker's foundation)

---

## ⚙️ Layer 4 — Init System (systemd)

After the kernel boots, it starts **exactly one process** with PID 1. On modern Linux, this is **systemd**.

systemd's job: start everything else.

```
Kernel hands control to systemd (PID 1)
        ↓
systemd reads unit files (/etc/systemd/system/)
        ↓
Starts services in parallel (networking, audio, display, login)
        ↓
Mounts filesystems listed in /etc/fstab
        ↓
Starts display manager (if desktop)
        ↓
Presents login screen
```

```bash
systemctl status nginx          # check a service
systemctl start/stop/restart    # control services
systemctl enable nginx          # start on boot
journalctl -u nginx             # view service logs
systemd-analyze blame           # see what slowed boot
```

---

## 🖥️ Layer 5 — User Space

Everything above the kernel. Now in safe, unprivileged territory.

**Shell** — `bash`, `zsh`. A program that reads your commands and executes them. Talks to the kernel via syscalls.

**Desktop Environment** — GNOME, KDE. A collection of programs providing windows, taskbar, file manager.

**Your Applications** — your IDE, browser, terminal. All making syscalls into the kernel to do anything useful.

---

## 🔄 The Complete Boot Flow — Linux, Start to Finish

```
POWER ON
    ↓
CPU executes UEFI firmware from ROM chip
    ↓
POST — hardware self-test
    ↓
UEFI reads EFI System Partition
    ↓
GRUB loads → shows boot menu
    ↓
GRUB loads /boot/vmlinuz (kernel) + initramfs into RAM
    ↓
Kernel decompresses itself
    ↓
Kernel initializes CPU, RAM, core subsystems
    ↓
Kernel mounts initramfs as temporary root
    ↓
initramfs loads storage drivers, decrypts drive if needed
    ↓
Kernel mounts real root filesystem (your SSD, ext4/btrfs)
    ↓
Kernel starts PID 1: systemd
    ↓
systemd starts all services in parallel
    ↓
Display manager starts → Login screen appears
    ↓
You log in → Shell / Desktop environment launches
    ↓
You open terminal → bash starts
    ↓
You run your app → process created, kernel manages it
```

---

## 🗺️ Full Layer Map with Linux Examples

```
┌──────────────────────────────────────────────┐
│  USER SPACE                                  │
│  bash, your IDE, browser, docker             │
│  /home/you/  /usr/bin/  /etc/                │
├──────────────────────────────────────────────┤
│  INIT SYSTEM — systemd (PID 1)               │
│  /etc/systemd/  journalctl  systemctl        │
├──────────────────────────────────────────────┤
│  SYSCALL INTERFACE                           │
│  strace, /proc/, /sys/                       │
├──────────────────────────────────────────────┤
│  KERNEL                                      │
│  Process mgmt   → /proc/  ps  top            │
│  Memory mgmt    → /proc/meminfo  free        │
│  VFS            → /dev/  /proc/  /sys/       │
│  Device drivers → lsmod  dmesg               │
│  Network stack  → ss  ip  /proc/net/         │
│  Security       → chmod  namespaces  cgroups │
├──────────────────────────────────────────────┤
│  BOOTLOADER — GRUB2                          │
│  /boot/grub/  /boot/vmlinuz  initramfs       │
├──────────────────────────────────────────────┤
│  UEFI FIRMWARE                               │
│  /sys/firmware/efi/  Secure Boot             │
├──────────────────────────────────────────────┤
│  HARDWARE                                    │
│  CPU  RAM  NVMe  NIC  GPU                    │
└──────────────────────────────────────────────┘
```

---
