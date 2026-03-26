# Stage 2 — Pretraining

> _This is where the model learns everything it will ever "know" about the world. Pretraining is the most compute-intensive, expensive, and infrastructure-heavy stage in the entire lifecycle._

---

## 🗺️ What we'll cover

1. **The Pretraining Objective** — what the model is actually learning
2. **The Transformer Architecture** — in enough depth to reason about training
3. **Training Infrastructure** — the hardware and distributed systems layer
4. **Training Dynamics** — what happens during a training run
5. **Scaling Laws** — the science of how to spend compute
6. **Checkpointing & Recovery** — keeping a multi-month run alive
7. **The Cost Reality** — what pretraining actually costs

---

## 🎯 1. The Pretraining Objective

Everything starts here. The entire pretraining process optimizes one deceptively simple objective:

> **Given the previous tokens, predict the next token.**

That's it. This is called **Causal Language Modeling (CLM)** or **next-token prediction**.

Formally, the model learns to maximize:

```
P(token_t | token_1, token_2, ..., token_{t-1})
```

Across billions of examples. The loss function is **cross-entropy** between the model's predicted probability distribution over the vocabulary and the actual next token.

### Why this objective is so powerful

It sounds trivial — just predict the next word. But think about what you need to _know_ to do this well across the entire internet:

- To predict the next word in a Python snippet → you need to understand code
- To predict the next word in a scientific paper → you need to understand reasoning
- To predict the next word in a conversation → you need to understand intent
- To predict the next word in a news article → you need world knowledge

The model is never explicitly taught any of these things. They all emerge as _instrumental capabilities_ needed to minimize prediction loss across a diverse corpus. **This is the magic of pretraining** — one objective, trained at scale, produces a general-purpose world model.

---

## 🏗️ 2. The Transformer — Deep Enough to Reason About Training

You need to understand the architecture well enough to understand _why_ training decisions are made the way they are.

### The full forward pass

```
Input tokens (integer IDs)
        ↓
Token Embedding + Positional Encoding
        ↓
[Transformer Block] × N layers
  ├── LayerNorm
  ├── Multi-Head Self-Attention
  │     ├── Q, K, V projections
  │     ├── Scaled dot-product attention
  │     └── Output projection
  ├── Residual connection
  ├── LayerNorm
  ├── Feed-Forward Network (FFN)
  │     └── Linear → Activation → Linear
  └── Residual connection
        ↓
Final LayerNorm
        ↓
LM Head (Linear projection → vocabulary size)
        ↓
Softmax → probability over next token
```

### The components that matter for training

**Embeddings:** Each token ID maps to a learned dense vector (e.g., 4096 dimensions for LLaMA 3 8B). The model starts knowing nothing — these are random initialized and learned entirely from training.

**Self-Attention:** The core operation. Every token produces a Query, Key, and Value vector. Attention scores = Q·Kᵀ / √d. Softmax normalizes scores. Output = weighted sum of Values. With causal masking, token t can only attend to tokens ≤ t.

**Multi-Head:** Run H attention heads in parallel with different projections, concatenate outputs. Each head can learn to attend to different kinds of relationships.

**FFN:** Two linear layers with a nonlinearity between them. Wider than the model dimension (typically 4x). Stores "factual knowledge" — research suggests facts are encoded here, attention handles routing/composition.

**Residual connections:** Every block adds its output to its input. Critical for training stability — gradients flow directly back through the residual stream, bypassing blocks entirely. Without this, very deep networks fail to train.

**LayerNorm:** Normalizes activations within each layer. Modern models use **RMSNorm** (simpler, slightly faster). Keeps activation magnitudes stable throughout training.

### Model size = these numbers multiplied out

A model's parameter count is determined by:

- Vocabulary size × embedding dimension
- Per layer: attention projection matrices (4 × d²) + FFN matrices (8 × d²)
- Number of layers

LLaMA 3 8B: 32 layers, 4096 hidden dim, 32 attention heads → ~8B parameters.

---

## ⚙️ 3. Training Infrastructure

This is where pretraining becomes a _distributed systems_ problem. A single GPU can't hold a 70B parameter model, let alone train it on trillions of tokens. You need a cluster — and coordinating that cluster is non-trivial.

### The hardware

**GPUs** are the dominant training hardware:

- **NVIDIA H100** — current gold standard. 80GB HBM3 memory, 3.35 TB/s memory bandwidth, NVLink for GPU-to-GPU communication
- **NVIDIA A100** — previous gen, still widely used
- **Google TPU v5** — Google's custom silicon, used for Gemini training
- **AMD MI300X** — emerging, used by some cloud providers

Pretraining runs happen on **clusters of hundreds to thousands of GPUs** connected via high-speed interconnects (NVLink within a node, InfiniBand between nodes).

### The three axes of parallelism

Training a large model requires splitting work across GPUs. There are three orthogonal ways to do this:

**Data Parallelism (DP)** Each GPU holds a _full copy_ of the model. Different GPUs process different batches. Gradients are averaged (all-reduce) across GPUs after each step.

Simple to implement, but doesn't help if the model doesn't _fit_ on one GPU.

```
GPU 0: batch_0 → gradients_0 ─┐
GPU 1: batch_1 → gradients_1 ─┼─ all-reduce → averaged gradients → update all
GPU 2: batch_2 → gradients_2 ─┘
```

**Tensor Parallelism (TP)** Split individual layers _across_ GPUs. The attention heads or FFN matrices are sharded — each GPU computes part of each layer, communication happens within each forward pass.

Requires fast interconnects (NVLink). Megatron-LM pioneered this.

**Pipeline Parallelism (PP)** Split layers _sequentially_ across GPUs. GPU 0 runs layers 1-8, GPU 1 runs layers 9-16, etc. Data flows like an assembly line.

Challenge: GPUs sit idle waiting for the previous stage. **Micro-batching** keeps the pipeline filled — feed multiple micro-batches so each GPU is always computing.

### ZeRO — the memory efficiency breakthrough

**ZeRO (Zero Redundancy Optimizer)** from DeepSpeed solves the problem that data parallelism wastes memory by replicating the full model on each GPU.

ZeRO partitions across GPUs:

- **ZeRO-1:** Partition optimizer states only
- **ZeRO-2:** Partition optimizer states + gradients
- **ZeRO-3 / FSDP:** Partition optimizer states + gradients + model parameters

With ZeRO-3 / **FSDP (Fully Sharded Data Parallel)** — PyTorch's native implementation — each GPU only holds a _shard_ of the parameters, gathering them on-demand during forward/backward pass. Memory per GPU scales with 1/N GPUs.

**This is how you train a 70B model on a cluster of GPUs that individually can't hold 70B parameters.**

### Mixed Precision Training

Storing parameters as FP32 (32-bit floats) doubles memory vs FP16. **Mixed precision** runs:

- Forward pass & gradients in **BF16** (16-bit, better numerical range than FP16)
- Master copy of weights in FP32 for stable optimizer updates
- Loss scaling to prevent underflow

Result: ~2x memory reduction, ~2x throughput — essentially free performance.

**BF16 vs FP16:** BF16 has the same exponent range as FP32 (just truncated mantissa), making it numerically safer. FP16 can overflow. Modern training uses BF16 almost universally.

### The interconnect hierarchy

```
Within a node (8 GPUs):
  NVLink — 600 GB/s bidirectional, fast enough for tensor parallelism

Between nodes:
  InfiniBand (HDR/NDR) — 200-400 Gb/s, used for data parallel all-reduce
  This is the bottleneck — cross-node communication is the limiting factor
  for large cluster efficiency
```

**This is why tensor parallelism stays within a node** (needs NVLink speed) **while data/pipeline parallelism spans nodes** (tolerates InfiniBand latency).

---

## 📈 4. Training Dynamics

### The optimizer

**AdamW** is the universal choice. Adam maintains per-parameter running averages of gradients (momentum) and squared gradients (adaptive learning rate). The W is weight decay — L2 regularization applied correctly (not to the adaptive term).

Why AdamW works so well: it handles the fact that different parameters have different gradient scales — embeddings get tiny gradients, some FFN weights get large ones. Adam normalizes per-parameter.

### Learning rate schedule

The learning rate follows a schedule across training:

```
Warmup phase (first ~1-2K steps):
  LR ramps linearly from 0 → peak LR
  Prevents instability from large updates on random weights

Cosine decay (bulk of training):
  LR decays following a cosine curve from peak → ~10% of peak
  Smooth, well-behaved

Final cooldown:
  Some runs do an aggressive decay to near-zero at the end
```

Peak LR is carefully tuned — too high → training instability (loss spikes), too low → slow convergence.

### Gradient clipping

Clip the global gradient norm to a maximum value (typically 1.0). Prevents any single bad batch from causing a catastrophic weight update. Essential for stability.

### Loss curves and what they tell you

During a healthy training run:

- Training loss decreases **smoothly and predictably** — roughly as a power law vs compute
- Loss spikes indicate bad batches, data corruption, or LR too high
- Plateau indicates LR needs decay, or data quality problem
- Divergence (loss goes up) → something is wrong, checkpoint and investigate

**Loss spikes** are common — often from a corrupted document or abnormally long sequence. The run usually recovers. Persistent spikes require intervention.

---

## 📐 5. Scaling Laws

This is the science that made modern AI possible — and directly informs how every pretraining budget is spent.

### The Kaplan scaling laws (OpenAI, 2020)

Loss scales predictably as a power law with:

- Number of parameters (N)
- Amount of training data (D)
- Amount of compute (C = 6ND approximately)

Each scales independently, and there are diminishing returns to each.

### The Chinchilla laws (DeepMind, 2022)

The Kaplan laws suggested scaling parameters >>> data. Chinchilla showed this was **wrong** — models were being overtrained on too little data.

The Chinchilla finding:

> **For a given compute budget, the optimal strategy is to scale model size and training tokens roughly equally.**

Specifically: train for approximately **20 tokens per parameter**.

A 70B model → train on ~1.4T tokens optimally for compute efficiency.

**This changed everything.** GPT-3 (175B) was undertrained by this metric. LLaMA 2 deliberately trained smaller models on more data. LLaMA 3 8B was trained on 15T tokens — far beyond Chinchilla optimal for compute efficiency, but optimized for **inference cost** (a smaller, better model is cheaper to serve).

### The inference-time correction

Chinchilla optimizes for _training compute efficiency_. But in production, **you run inference billions of times**. A smaller, overtrained model that fits on fewer GPUs can be far more economical at scale even if it cost more to train.

This is why the industry has shifted toward: **train smaller models longer** — LLaMA 3, Mistral, Phi-3 all follow this.

---

## 💾 6. Checkpointing & Recovery

A pretraining run for a frontier model takes **months**. Hardware failures are not edge cases — they are certainties at this scale.

### What a checkpoint contains

- Model weights (full precision)
- Optimizer states (AdamW momentum terms — 2x model size!)
- Learning rate schedule position
- Data loader state (which tokens have been seen)
- Random number generator states

Total checkpoint size can be **3-5x model parameter count** due to optimizer states.

### Checkpoint frequency

Save every N steps (e.g., every 1000 steps = every few hours). On failure, roll back to last checkpoint and resume. Losing a few hours of compute on a multi-month run is acceptable.

**Async checkpointing** — write checkpoint to storage in background while training continues, so saving doesn't stall the GPUs.

### Fault tolerance

At 1000+ GPU scale, a GPU failing mid-run is routine. **Elastic training** frameworks (like PyTorch's elastic launch) can restart the job on the remaining nodes, reload the checkpoint, and continue.

---

## 💰 7. The Cost Reality

This grounds everything in the real world:

|Model|Estimated Training Compute|Approximate Cost|
|---|---|---|
|LLaMA 3 8B|~1×10²³ FLOPs|~$400K|
|LLaMA 3 70B|~6×10²⁴ FLOPs|~$2–4M|
|GPT-4 (est.)|~2×10²⁵ FLOPs|~$50–100M|
|Gemini Ultra (est.)|~5×10²⁵ FLOPs|~$100M+|

For context: a single H100 GPU delivers ~2×10¹⁵ FLOPs/second at BF16. Training GPT-4 scale would take one H100 roughly **30,000 years**. You need ~10,000 H100s running for ~3 months.

**This is why pretraining is a lab-scale activity.** As a product engineer, you will almost never pretrain from scratch. You will:

- Use open pretrained models (LLaMA, Mistral, Falcon)
- Use API access to closed models (GPT-4, Claude, Gemini)
- Fine-tune on top of pretrained bases (Stage 3)

Understanding pretraining still matters because:

- It explains _why_ models have the capabilities and failure modes they do
- It informs which base model to choose for your use case
- Continued pretraining (domain adaptation) on a pretrained base is increasingly common and affordable

---

## 🔁 How Pretraining Connects to the Lifecycle

```
Data Layer (Stage 1)
  → tokenized, packed shards in object storage
        ↓
Pretraining (Stage 2)
  → base model checkpoint
  → can generate text, has world knowledge, but:
     - not instruction-following
     - not aligned to human preferences
     - not safe
        ↓
Post-Training (Stage 3) ← next
  → turns the base model into a usable product
```

The base model that comes out of pretraining is powerful but raw — it'll complete text, not follow instructions. That transformation happens in Stage 3.

---
