
---

## 💻 How Code Actually Works — Execution, Concurrency & Everything In Between


---

### The Foundation First: What Happens When You "Run Code"?

Before concurrency, you need to understand what a single thread of execution actually IS at the machine level.

---

## 🔄 Layer 1 — From Source Code to CPU Instructions

Your high-level code goes through a transformation pipeline before the CPU ever sees it.

---

### Path A — Compiled Languages (C, C++, Rust, Go)

```
Your Source Code (.c / .rs / .go)
        ↓
PREPROCESSOR
Handles #include, #define, macros
Produces pure source code
        ↓
COMPILER FRONTEND
Lexing → breaks code into tokens
Parsing → builds Abstract Syntax Tree (AST)
Semantic Analysis → type checking, scope validation
        ↓
INTERMEDIATE REPRESENTATION (IR)
e.g. LLVM IR — a platform-neutral form of your code
Optimizations happen here (dead code elimination,
inlining, loop unrolling)
        ↓
COMPILER BACKEND
Translates IR to target CPU's machine code
Handles register allocation, instruction selection
        ↓
OBJECT FILE (.o)
Machine code but with unresolved references
(calls to functions in other files/libraries)
        ↓
LINKER
Combines all .o files + libraries
Resolves all references
Produces final EXECUTABLE binary
        ↓
CPU EXECUTES IT DIRECTLY
```

The binary contains raw x86-64 or ARM instructions the CPU natively understands. No translation at runtime. This is why compiled languages are fast.

---

### Path B — Interpreted Languages (Python, Ruby, early PHP)

```
Your Source Code (.py)
        ↓
INTERPRETER reads line by line (or statement by statement)
        ↓
Parses to AST
        ↓
Executes AST nodes directly
OR
Compiles to bytecode first, then interprets bytecode
        ↓
Interpreter (itself a compiled C program) runs on CPU
```

Python actually compiles to **bytecode** (.pyc files) first, then the **CPython interpreter** (a C program) reads and executes that bytecode. You never see raw machine code.

**Why slower?** The interpreter itself is doing work on every instruction — translating bytecode → machine actions at runtime.

---

### Path C — JIT Compiled (Java, C#, JavaScript V8, PyPy)

The clever middle ground.

```
Your Source Code
        ↓
Compiled to BYTECODE (Java → .class files, JS → AST)
        ↓
VIRTUAL MACHINE runs the bytecode
        ↓
JIT COMPILER watches which code runs HOT (frequently)
        ↓
Compiles HOT paths directly to native machine code AT RUNTIME
        ↓
Next time that code runs → executes as native machine code
```

**Java's JVM, V8 (Node.js/Chrome), .NET CLR** all do this. Over time, a JIT-compiled program can approach compiled language performance for hot code paths. Cold code (rarely executed) stays interpreted.

---

### What the CPU Actually Does — The Execution Loop

Every CPU core runs this loop billions of times per second:

```
FETCH     → Read next instruction from memory (or cache)
DECODE    → Figure out what the instruction means
EXECUTE   → Actually do it (add, compare, jump, load, store)
WRITEBACK → Store the result (to register or memory)
```

**Registers** are the CPU's own tiny ultra-fast storage — a modern x86 CPU has ~16 general-purpose registers (RAX, RBX, RCX... each 64-bit). All computation happens in registers. Data moves between registers and RAM constantly.

**The Call Stack:**
Every function call creates a **stack frame** in memory:

```
main() calls fetchUser() calls parseJSON()

Stack grows downward:
┌─────────────────┐  ← Stack top
│ parseJSON frame │     local vars, return address
├─────────────────┤
│ fetchUser frame │     local vars, return address
├─────────────────┤
│   main frame    │     local vars, return address
└─────────────────┘  ← Stack bottom
```

When parseJSON returns → its frame is popped, execution resumes in fetchUser. Stack overflow = recursion so deep the stack runs out of memory.

---

## ⚡ Layer 2 — The Process & Thread Model

Now we build concurrency on top of this foundation.

---

### Process — The Full Isolated Unit

```
PROCESS
├── Virtual address space (its own view of RAM)
├── Code segment (the compiled instructions)
├── Data segment (global variables)
├── Heap (dynamically allocated memory — malloc/new)
├── Stack (function calls, local variables)
├── File descriptors (open files, sockets, pipes)
├── PID (process ID)
└── One or more THREADS
```

Processes are **fully isolated**. Process A cannot read Process B's memory. If one crashes, others are unaffected. Communication between processes requires explicit mechanisms (IPC).

---

### Thread — Execution Within a Process

A thread is the actual unit of execution. Every process has at least one (the main thread). Additional threads share the process's memory space but have their own:
- **Stack** (each thread has its own call stack)
- **Program Counter** (where in the code it currently is)
- **Register state**

```
PROCESS
├── Shared: heap, globals, file descriptors, code
├── Thread 1: own stack + registers + program counter
├── Thread 2: own stack + registers + program counter
└── Thread 3: own stack + registers + program counter
```

Threads are **lightweight** — creating a thread is much cheaper than creating a process. But sharing memory means they can step on each other (race conditions).

---

## 🌊 Layer 3 — All Execution Models, Deep & Complete

---

### 1. 🔵 Single-Threaded Synchronous (The Baseline)

```
Task A ──────────────►
                      Task B ──────────────►
                                            Task C ──►
Timeline: ═══════════════════════════════════════════►
```

One thing at a time, in order. Simple, predictable. No parallelism.

```python
# Python synchronous
data = fetch_from_db()      # blocks here until done
result = process(data)      # then runs this
save(result)                # then this
```

**When it's fine:** Simple scripts, CLI tools, anything where tasks are sequential by nature.
**When it breaks:** Any task that waits on I/O (network, disk) wastes CPU time sitting idle.

---

### 2. 🟡 Concurrency vs Parallelism — The Critical Distinction

Before going further — these are **NOT the same thing:**

**Concurrency** — Multiple tasks are IN PROGRESS at the same time. They may take turns on the same CPU. About *dealing* with multiple things.

**Parallelism** — Multiple tasks are EXECUTING simultaneously on multiple CPU cores. About *doing* multiple things at the literal same instant.

```
CONCURRENCY (1 core, switching):
Core 1: ══A══╗  ══B══╗  ══A══╗  ══B══►
             ╚══B══╝       ╚══A══╝

PARALLELISM (2 cores, simultaneous):
Core 1: ══════════════A══════════════►
Core 2: ══════════════B══════════════►
```

You can have:
- Concurrency without parallelism (async on 1 core)
- Parallelism without concurrency (independent batch jobs)
- Both together (async tasks spread across multiple cores)

---

### 3. 🟢 Multithreading

Multiple threads within one process, potentially running on multiple cores simultaneously.

```
PROCESS
├── Thread 1 → Core 1 (executing task A)
├── Thread 2 → Core 2 (executing task B)
└── Thread 3 → Core 3 (executing task C)
```

**The OS Scheduler** decides which thread runs on which core and when. This is **preemptive** — the OS can interrupt a thread mid-execution and switch to another.

**In Java:**
```java
Thread t = new Thread(() -> {
    System.out.println("Running in thread: " 
        + Thread.currentThread().getName());
});
t.start(); // OS creates a real OS thread
```

**In Python:** `threading` module creates OS threads BUT the **GIL (Global Interpreter Lock)** prevents true parallel execution of Python bytecode. Two Python threads cannot run Python code simultaneously — they take turns. (I/O still benefits though — GIL is released during I/O waits.)

**In C/C++/Rust/Java/Go:** True parallel multithreading, no GIL equivalent.

---

### ☠️ The Dark Side of Shared Memory — Race Conditions

When two threads access the same data simultaneously, chaos happens:

```
counter = 0

Thread 1:                    Thread 2:
READ counter (gets 0)
                             READ counter (gets 0)
ADD 1 → 1
WRITE counter = 1
                             ADD 1 → 1
                             WRITE counter = 1

Result: counter = 1   ← WRONG, should be 2
```

Both threads read before either wrote. This is a **race condition**.

**Solutions:**

**Mutex (Mutual Exclusion Lock):**
```
Thread 1 acquires lock →
    reads, modifies, writes counter
Thread 1 releases lock

Thread 2 acquires lock (was waiting) →
    reads, modifies, writes counter
Thread 2 releases lock
```
Only one thread in the **critical section** at a time.

**Semaphore:** Like a mutex but allows N threads simultaneously (e.g. max 5 DB connections).

**Deadlock:** Thread 1 holds Lock A, wants Lock B. Thread 2 holds Lock B, wants Lock A. Both wait forever. Classic bug.

```bash
# Linux: see threads of a process
ps -T -p PID
cat /proc/PID/status | grep Threads
```

---

### 4. 🔴 Async / Event-Driven (Single-Threaded Concurrency)

The insight: most of a server's time is spent **waiting** — waiting for a DB query, waiting for a network response. During that wait, the CPU is idle.

**Async** = instead of blocking and waiting, register a callback/continuation and go do other work.

**The Event Loop:**

```
EVENT LOOP (single thread, Node.js / Python asyncio)

    ┌─────────────────────────────────┐
    │  Check event queue              │
    │  Is there work ready?           │
    └────────────┬────────────────────┘
                 │
         ┌───────▼────────┐
         │  Execute task  │
         │  until it hits │
         │  an await/I-O  │
         └───────┬────────┘
                 │
         ┌───────▼────────────────────────┐
         │  Register callback with OS     │
         │  (epoll/kqueue — OS will notify│
         │  when I/O is ready)            │
         └───────┬────────────────────────┘
                 │
         ┌───────▼────────┐
         │  Pick next     │
         │  ready task    │
         │  from queue    │
         └───────┬────────┘
                 │
                 └──────► (loop continues)
```

**Node.js example:**
```javascript
// This does NOT block the thread:
const data = await fetch('https://api.example.com/users');
// While waiting for network, event loop runs other tasks
const result = await db.query('SELECT * FROM orders');
// Again — doesn't block, other work happens during wait
console.log(data, result);
```

**Python asyncio:**
```python
async def main():
    # Both requests fired simultaneously, not sequentially
    users, orders = await asyncio.gather(
        fetch_users(),
        fetch_orders()
    )
```

**Under the hood — how the OS enables this:**
Linux's `epoll` system call lets one thread monitor thousands of file descriptors (sockets, files) simultaneously. The OS notifies the event loop when any of them are ready. This is how Node.js handles 10,000 simultaneous connections on one thread.

---

### 5. 🟣 Multiprocessing

Instead of multiple threads in one process, spawn multiple **separate processes**.

Each process = full isolation, own memory space, own Python interpreter (solves GIL problem).

```python
# Python multiprocessing — true parallelism for CPU work
from multiprocessing import Pool

def crunch(n):
    return n ** 2

with Pool(8) as p:          # 8 worker processes
    results = p.map(crunch, range(1000))
```

**Communication between processes (IPC):**
- **Pipes** — one-way byte stream between processes
- **Message Queues** — structured messages
- **Shared Memory** — mapped memory region both processes access
- **Sockets** — communicate over network (even on same machine)
- **Signals** — simple notifications (SIGTERM, SIGKILL)

```bash
# Linux IPC tools
ipcs        # show active shared memory, queues, semaphores
pipe        # ls | grep txt  ← the | IS a pipe
```

---

### 6. 🔵 Green Threads / Fibers / Coroutines

A layer between OS threads and async callbacks — **user-space scheduled** lightweight threads.

The runtime (not the OS) manages scheduling. Can have **millions** of them because they're just heap objects, not OS resources.

**Go Goroutines** — the best example:
```go
// Spawn 100,000 goroutines trivially
for i := 0; i < 100000; i++ {
    go func() {
        // concurrent work here
    }()
}
```

Go's runtime has its own scheduler (M:N threading — maps M goroutines onto N OS threads). When a goroutine blocks on I/O, the Go scheduler moves another goroutine onto that OS thread. Brilliant design.

**Python generators / coroutines** — `yield` and `async/await` are coroutines under the hood.

---

### 7. 🟠 The Actor Model

Instead of shared memory + locks, actors communicate only via **message passing**. Each actor has a mailbox. No shared state.

**Erlang/Elixir** — built on this model. WhatsApp ran millions of simultaneous connections on very few servers using Erlang actors.

```elixir
# Elixir — spawn an actor (process)
pid = spawn(fn -> receive do
  {:hello, name} -> IO.puts("Hello #{name}")
end end)

send(pid, {:hello, "world"})
```

---

### 8. ⚪ GPU Parallelism (SIMD / SIMT)

A completely different execution model. Not for logic-heavy code — for **doing the same operation on massive data arrays simultaneously**.

```
CPU: 8 cores doing 8 different things
GPU: 10,000 cores all doing the SAME thing on different data

Matrix multiplication row 1   → Core 1
Matrix multiplication row 2   → Core 2
...
Matrix multiplication row 10000 → Core 10000
All simultaneously.
```

This is why GPUs train neural networks. Every neuron's gradient calculation is independent — perfect for SIMT (Single Instruction Multiple Thread).

---

## 🗺️ The Execution Model Decision Map

```
What kind of task do you have?

Is it WAITING on I/O most of the time?
(network requests, DB queries, file reads)
        ↓ YES
    Use ASYNC / Event Loop
    (Node.js, Python asyncio, async Rust)
    One thread handling thousands of concurrent waits

Is it CPU-HEAVY computation?
(image processing, ML, compression, simulations)
        ↓ YES
    Use MULTIPROCESSING or TRUE MULTITHREADING
    (Python multiprocessing, Go goroutines,
     Java threads, Rust threads)
    Spread work across all CPU cores

Is it MASSIVE parallel math on arrays?
(neural networks, graphics, simulations)
        ↓ YES
    Use GPU PARALLELISM
    (CUDA, OpenCL, PyTorch, JAX)

Do you need ISOLATION between tasks?
(security, crash containment)
        ↓ YES
    Use MULTIPROCESSING or CONTAINERS
    Separate address spaces

Do you need MILLIONS of concurrent tasks?
(massive server, game engine, telecom)
        ↓ YES
    Use GREEN THREADS / ACTOR MODEL
    (Go goroutines, Erlang/Elixir actors)
```

---

## 🔄 How It All Maps to the OS/Kernel Layer

```
YOUR CODE
    │
    ├── spawn thread    → kernel creates OS thread → scheduler assigns to core
    ├── spawn process   → kernel fork() syscall → new address space
    ├── await I/O       → kernel epoll/kqueue → event loop notified when ready
    ├── malloc()        → kernel brk()/mmap() → virtual memory page allocated
    ├── open file       → kernel VFS → driver → storage hardware
    └── send()          → kernel network stack → NIC → wire
```

Every execution model — async, threads, processes — is ultimately built on kernel primitives: **syscalls, scheduling, virtual memory, and I/O notification mechanisms.**

---

## 🗺️ Full Mental Model

```
SOURCE CODE
    ↓ (compiler / interpreter / JIT)
MACHINE CODE / BYTECODE
    ↓
PROCESS (isolated memory space)
    ↓
THREADS (units of execution, share process memory)
    ↓
OS SCHEDULER (assigns threads to CPU cores)
    ↓
CPU CORES (fetch → decode → execute → writeback)
    ↓
L1/L2/L3 CACHE → RAM → NVMe (memory hierarchy)

CONCURRENCY MODELS on top of this:
├── Sync         → one thread, sequential
├── Multithreaded → multiple OS threads, shared memory
├── Async        → one thread, event loop, epoll
├── Multiprocess → multiple isolated processes
├── Green threads → user-space scheduled (Go, Erlang)
└── GPU parallel  → SIMT on thousands of cores
```

---

