
---

## 🧠 The CPU Industry — Power, Architecture & Supply Chain


---

### Why Is This Industry So Concentrated?

Before naming players, understand *why* only a handful of companies exist at the top.

**The barriers are unlike almost any other industry:**

- **R&D Cost** — Designing a competitive CPU architecture costs **billions of dollars** and takes **4–6 years** per generation
- **Fabrication Cost** — Building a single modern chip fabrication plant (fab) costs **$10–20 billion+**
- **Physics** — You're engineering at the scale of **atoms**. A transistor node at 3nm means features just ~15 silicon atoms wide. The margin for error is essentially zero
- **Knowledge Compounding** — Decades of accumulated engineering knowledge, patents, and tooling that can't be bought or replicated quickly
- **Talent Scarcity** — The number of engineers in the world who can design competitive CPUs is genuinely tiny — measured in thousands, not millions

The result: this is arguably the **highest barrier to entry industry on Earth**.

---

## 🏛️ The Two Fundamental CPU Architectures

This is the most important concept — because it's not just about hardware. CPU architecture creates a **hard contract** that all software must speak.

An **ISA (Instruction Set Architecture)** is the agreed language between software and hardware. It defines what instructions a CPU can understand — ADD, LOAD, JUMP, etc. — and how they're encoded in binary.

Software compiled for one ISA **will not run** on another. This is the interlock.

### The Two Dominant ISAs:

---

### 🔵 x86-64 (Also called AMD64 or Intel 64)

- Born in **1978** with Intel's 8086 chip
- Extended to 64-bit by **AMD** in 2003 (hence AMD64) — Intel then adopted it
- **CISC** — Complex Instruction Set Computing. Has thousands of instructions, some very specialized
- Dominant in: **Desktops, Laptops, Servers, Data Centers**
- The entire Windows and Linux desktop software ecosystem is compiled for x86-64
- Only **Intel and AMD** are legally licensed to make x86-64 CPUs (via a cross-licensing agreement from the 1970s–80s). This duopoly is legally enforced, not just technical

---

### 🟢 ARM (Advanced RISC Machine)

- Born in **1985** in Cambridge, UK
- **RISC** — Reduced Instruction Set Computing. Fewer, simpler instructions. More efficient, less power hungry
- Dominant in: **Smartphones, Tablets, Embedded devices, and rapidly taking over Laptops/Servers**
- Apple Silicon (M1/M2/M3/M4), Qualcomm Snapdragon, Samsung Exynos — all ARM
- The business model is unique: **ARM Holdings doesn't make chips**. It designs the ISA and microarchitecture blueprints and **licenses them** to other companies
- This is why dozens of companies can make ARM chips — they all paid for the license

---

### CISC vs RISC — The Philosophy Difference

| | CISC (x86) | RISC (ARM) |
|---|---|---|
| Instructions | Many, complex | Few, simple |
| Philosophy | Hardware does heavy lifting | Software does heavy lifting |
| Power use | Higher | Lower |
| Performance/watt | Lower | Higher |
| Historically better at | Raw desktop/server performance | Mobile, embedded |
| Today | Gap is closing fast |  |

**The dirty secret of modern x86:** Intel/AMD CPUs actually translate x86 instructions into internal RISC-like micro-ops before executing them. So modern x86 is CISC on the outside, RISC-ish on the inside.

---

### Other ISAs Worth Knowing:

**RISC-V** — The open-source ISA. No licensing fees. Anyone can build a RISC-V CPU. Gaining massive momentum in embedded, data centers, and geopolitically motivated designs (China especially). Not yet competitive at the high end but watch this space — it's the most strategically important ISA development of the 2020s.

**MIPS / PowerPC** — Older RISC ISAs. PowerPC lives on in game consoles (PS3/Xbox 360 era). Largely legacy now.

---

## 🌍 The Global Players — Mapped by Role

The CPU industry splits into distinct roles. Very few companies span multiple roles.

---

### 🔴 Fabless Chip Designers
*They design chips but own NO factories. They outsource manufacturing.*

**Intel** *(partially — they also have their own fabs)*
- The most dominant x86 CPU company for decades
- Makes CPUs for desktops (Core i-series), laptops, and servers (Xeon)
- Struggling recently — their manufacturing fell behind TSMC

**AMD (Advanced Micro Devices)**
- x86 license holder, x86-64 co-creator
- Designs CPUs (Ryzen for consumer, EPYC for server) and GPUs (Radeon)
- Fabless since 2009 — outsources all manufacturing to TSMC
- Has dramatically gained ground on Intel in the last 5 years

**Apple**
- Designs their own ARM-based chips (M-series for Mac, A-series for iPhone/iPad)
- Fabless — manufactured by TSMC
- Apple Silicon (M1 in 2020) shocked the industry — better performance per watt than anything Intel had

**Qualcomm**
- ARM chips for smartphones (Snapdragon) and increasingly laptops (Snapdragon X Elite)
- Also makes modems, Wi-Fi chips, automotive processors
- Fabless — manufactured by TSMC and Samsung

**NVIDIA**
- Dominates GPU market. Now making ARM-based CPUs (Grace CPU for data centers)
- Fabless — manufactured by TSMC and Samsung

**MediaTek**
- ARM chips, primarily for mid-range smartphones and smart TVs
- Largest smartphone chip supplier by volume
- Fabless — manufactured by TSMC

---

### 🟠 Integrated Device Manufacturers (IDMs)
*They design AND manufacture their own chips*

**Intel**
- The only major x86 CPU maker that still runs its own fabs (partially)
- Has struggled to keep up with TSMC's manufacturing leadership
- Now pursuing "Intel Foundry" — trying to manufacture chips for others too

**Samsung**
- Designs their own ARM chips (Exynos) AND runs major fabs
- Second largest foundry in the world after TSMC

---

### 🟡 Pure-Play Foundries
*They ONLY manufacture. They design nothing.*

**TSMC (Taiwan Semiconductor Manufacturing Company)**
- The single most strategically important company in the entire tech world
- Manufactures chips for Apple, AMD, NVIDIA, Qualcomm, MediaTek, and hundreds more
- Operates the world's most advanced nodes: 3nm, 2nm (coming 2025–26)
- ~**90%+ of the world's most advanced chips** are made here
- Located in Taiwan — this is why Taiwan is a geopolitical flashpoint

**Samsung Foundry**
- Second largest foundry
- Manufactures for Qualcomm, NVIDIA, IBM and their own Exynos chips

**GlobalFoundries**
- Spun off from AMD in 2009
- Makes mature nodes (12nm and above) — not cutting edge but essential for automotive, aerospace, industrial chips
- Key for chips that don't need bleeding-edge but need reliability

**SMIC (Semiconductor Manufacturing International Corporation)**
- China's largest foundry
- Restricted from getting cutting-edge equipment due to US export controls
- Currently stuck at ~7nm equivalent — trying to catch up

---

### 🟢 Equipment Makers
*They make the machines that make the chips. The most invisible and most critical.*

**ASML (Netherlands)**
- Makes **EUV (Extreme Ultraviolet Lithography)** machines — the only machines on Earth that can print circuits at 7nm and below
- **There is no alternative.** Every advanced chip from TSMC, Samsung, and Intel is made using ASML's EUV machines
- A single EUV machine costs **~$200 million**, weighs 180 tons, and contains parts from over 5,000 suppliers
- ASML is arguably the single most irreplaceable company in the entire tech supply chain

**Applied Materials, Lam Research, KLA (USA)**
- Make deposition, etching, and inspection equipment used in fabs
- Also subject to export controls to China

**Tokyo Electron (Japan)**
- Major fab equipment maker, especially for cleaning and photolithography

---

### 🔵 Materials & Chemicals

**Shin-Etsu, SUMCO (Japan)**
- Make ultra-pure **silicon wafers** — the base substrate chips are built on
- Japan dominates ~60% of the silicon wafer market

**JSR, Shin-Etsu, TOK (Japan)**
- Make **photoresists** — the light-sensitive chemicals used in lithography to print circuits
- Japan controls ~90% of the global photoresist supply

**Entegris, DuPont (USA)**
- Specialty chemicals and materials for chip manufacturing

---

## 🏭 The CPU Manufacturing Process — Step by Step

```
1. SILICON PURIFICATION
   Sand (SiO₂) → purified to 99.9999999% pure silicon
   Melted and grown into cylindrical ingots (Czochralski process)
        ↓
2. WAFER SLICING
   Ingots sliced into thin circular wafers (~300mm diameter)
   Polished to atomic-level flatness
        ↓
3. CIRCUIT DESIGN (happens years before, in EDA software)
   Engineers use EDA tools (Cadence, Synopsys, Mentor)
   to design billions of transistors
   Output: GDSII file — the blueprint sent to the fab
        ↓
4. PHOTOLITHOGRAPHY (done dozens of times, layer by layer)
   Wafer coated with photoresist (light-sensitive chemical)
   EUV machine shines extreme UV light (13.5nm wavelength)
   through a mask (stencil of the circuit pattern)
   onto the wafer
   Light hardens the photoresist in the pattern shape
        ↓
5. ETCHING
   Chemicals remove the unhardened photoresist
   leaving the circuit pattern
        ↓
6. DOPING / ION IMPLANTATION
   Ions (boron, phosphorus) fired into silicon
   to change electrical properties — creating
   N-type and P-type regions = transistors
        ↓
7. DEPOSITION
   Thin films of metal (copper, tungsten) deposited
   to form the wiring interconnects between transistors
        ↓
8. REPEAT 40–100 TIMES
   A modern chip has 10–15+ layers of circuitry
   Each layer requires its own lithography + etch cycle
        ↓
9. TESTING (Wafer Level)
   Each chip die on the wafer is probed and tested
   Failed dies are marked
        ↓
10. DICING
    Wafer cut into individual chips (dies)
        ↓
11. PACKAGING
    Die mounted in a package (the green board + pins you see)
    Tiny gold/copper wires connect die to package pins
    Modern: Advanced packaging (chiplets, 3D stacking)
        ↓
12. FINAL TESTING
    Every chip tested at multiple temperatures and voltages
    Binned by performance — best chips sold as top-tier SKUs
    Slightly defective chips sold as lower-tier (some cores disabled)
        ↓
13. SHIPPED to OEMs (Dell, Apple, etc.) or retail
```

---

## 🧩 Chiplets — The Modern Revolution

For decades, a CPU was one monolithic die. Now companies are splitting chips into **chiplets** — separate smaller dies that connect together in one package.

**Why?**
- Smaller dies have higher **yield** (fewer defects per die)
- Different parts of a chip can be made on different processes — e.g., AMD makes CPU cores on TSMC 3nm but the I/O die on 6nm (cheaper)
- Enables much larger effective chip sizes

AMD's Ryzen, Intel's latest CPUs, and Apple's M-series Ultra chips all use chiplet/multi-die approaches.

---

## 🔒 The Geopolitical Interlock

The CPU supply chain is the most geopolitically sensitive technology chain on Earth:

```
Design software (EDA)    → USA (Cadence, Synopsys)
ISA licenses             → USA (x86: Intel/AMD) / UK (ARM Holdings, now SoftBank Japan)
Chip design              → USA, Taiwan, South Korea, Europe
EUV lithography machines → Netherlands (ASML) exclusively
Silicon wafers           → Japan (Shin-Etsu, SUMCO)
Photoresists/chemicals   → Japan (~90% control)
Advanced manufacturing   → Taiwan (TSMC, ~90% of cutting edge)
Assembly/Packaging       → Taiwan, South Korea, Malaysia, China

US export controls block China from:
- EUV machines (via ASML + US pressure on Netherlands)
- Advanced EDA software
- Sub-7nm manufacturing equipment
```

This is why **RISC-V** is China's strategic bet — an ISA with no US licensing dependency.

---

## 🗺️ The Complete Mental Model

```
IDEA → CPU Architecture (ISA: x86 or ARM or RISC-V)
              ↓
       Chip Design (Fabless: AMD, Apple, Qualcomm)
       using EDA Software (Cadence, Synopsys)
              ↓
       Sent to Foundry (TSMC / Samsung)
       using Equipment (ASML EUV machines)
       on Materials (Japanese silicon wafers + photoresists)
              ↓
       Manufactured (40–100 layer photolithography process)
              ↓
       Packaged + Tested + Binned
              ↓
       Shipped to OEMs (Apple, Dell, HP, etc.)
              ↓
       Placed in Device → Ships to You
              ↓
       OS + Software compiled for that ISA runs on it
```

---

This is why disrupting the CPU industry is nearly impossible — it's not one moat, it's **a chain of interlocking moats** spanning multiple countries, decades of R&D, and physics itself.
