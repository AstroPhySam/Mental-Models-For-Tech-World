# Stage 4 — Inference & Serving

> _Training is a one-time cost. Inference is forever. Every user request, every token generated, every millisecond of latency — this is where AI products live or die on cost and performance._

---

## 🗺️ What we'll cover

1. **The Inference Problem** — why serving is fundamentally different from training
2. **The Transformer Inference Loop** — what actually happens token by token
3. **KV Cache** — the most important optimization in inference
4. **Batching Strategies** — how you serve many users at once
5. **Quantization** — making models smaller and faster
6. **Speculative Decoding** — a clever trick to go faster
7. **Serving Frameworks** — vLLM, TensorRT-LLM, Triton
8. **Deployment Architectures** — how it all runs in production
9. **Cost Modeling** — the economics of inference

---

## 🧱 1. The Inference Problem

Training and inference feel similar on the surface — both run the transformer forward pass. But they're fundamentally different workloads:

| Training            | Inference                              |                                     |
| ------------------- | -------------------------------------- | ----------------------------------- |
| Batch size          | Large (512–4096 sequences)             | Small (1 to a few sequences)        |
| Sequence processing | All tokens in parallel                 | One new token at a time             |
| Memory pressure     | Weights + gradients + optimizer states | Weights + KV cache                  |
| Compute pattern     | Compute-bound                          | **Memory-bandwidth-bound**          |
| Optimization goal   | Throughput (tokens/sec/GPU)            | Latency + throughput simultaneously |

That last row is the critical insight. During training you're doing massive matrix multiplications — the GPU's compute units are the bottleneck. During inference, the matrix multiplications are tiny (one token at a time) — you're mostly just **reading weights from memory** to multiply against a single vector. The GPU sits mostly idle while waiting for data from HBM.

This is why **memory bandwidth** — not raw compute — is the primary constraint in LLM inference.

---

## 🔄 2. The Transformer Inference Loop

To understand every optimization, you need to understand exactly what happens when you generate text.

### Two phases: Prefill and Decode

**Prefill phase:** Process the entire input prompt in one forward pass. All input tokens are processed in parallel (like training). This is compute-intensive — a long prompt means a big matrix multiply.

```
Input: "Explain how transformers work in simple terms"
         ↓
All tokens processed simultaneously
         ↓
Produces: KV cache for all input tokens + first output token logits
```

**Decode phase:** Generate output tokens one at a time. Each step:

1. Take the last generated token
2. Run one forward pass of the full model
3. Produce probability distribution over vocabulary
4. Sample next token
5. Repeat until EOS or max length

```
Step 1: token_1 → forward pass → token_2
Step 2: token_2 → forward pass → token_3
Step 3: token_3 → forward pass → token_4
...
```

Each decode step runs the **entire model** — all N layers, all attention heads, all FFN weights — just to produce one token. For a 70B model, that's reading ~140GB of weights from GPU memory per token. At H100 memory bandwidth of 3.35 TB/s, that's ~42ms per token maximum — before any compute overhead.

This is the **memory bandwidth wall** — and every major inference optimization attacks it.

---

## 💾 3. KV Cache — The Most Important Optimization

### The problem without caching

In the attention mechanism, every token attends to every previous token. At decode step T, to compute attention for the new token, you need K (key) and V (value) vectors for all T-1 previous tokens.

Without caching, you'd recompute K and V for every previous token at every decode step. Step 100 would recompute 99 tokens worth of K and V. **Quadratic cost.**

### The KV cache solution

After computing K and V vectors for a token, **cache them**. Never recompute.

```
Prefill: compute K,V for all input tokens → store in KV cache
Decode step 1: compute K,V for token_1 → append to cache
               attention uses cached K,V for all previous tokens
Decode step 2: compute K,V for token_2 → append to cache
               ...and so on
```

Each decode step only computes K and V for **one new token**, then reads the full cache for attention. Linear cost per step.

### KV cache memory cost

Here's the catch: the KV cache is **large**.

For each token, you store K and V vectors for every layer and every attention head:

```
KV cache size per token =
  2 (K and V) × num_layers × num_heads × head_dim × bytes_per_element

LLaMA 3 70B example:
  2 × 80 layers × 8 KV heads × 128 head_dim × 2 bytes (BF16)
  = 327,680 bytes per token ≈ 320 KB per token

At 4096 token context: 320 KB × 4096 = 1.28 GB
At 32K token context: 320 KB × 32768 = 10 GB
```

**This is why long context is expensive.** The KV cache grows linearly with sequence length and eats into the GPU memory you could use for batching more requests.

### GQA — Grouped Query Attention

Modern models use **Grouped Query Attention** to reduce KV cache size. Instead of one K,V head per Q head, multiple Q heads share a single K,V head.

```
Multi-Head Attention (MHA): 32 Q heads, 32 K heads, 32 V heads
Grouped Query Attention (GQA): 32 Q heads, 8 K heads, 8 V heads
                                4x smaller KV cache
```

LLaMA 3, Mistral, Gemma all use GQA. It's now standard.

---

## 📦 4. Batching Strategies

Serving one request at a time wastes GPU utilization — while one request is in the decode phase (memory-bound, low compute), the GPU's compute units are idle. **Batching** multiple requests together amortizes the weight-reading cost across many requests simultaneously.

### Static batching

Naive approach: wait for B requests, batch them together, run until all complete.

Problem: requests have different lengths. Short requests finish early but must wait for the longest request in the batch. GPU sits idle on "ghost" tokens.

```
Request 1: ████░░░░░░  (finishes at step 4, waits until step 10)
Request 2: ██████████  (runs full length)
Request 3: ██░░░░░░░░  (finishes at step 2, waits until step 10)
```

### Continuous batching (iteration-level scheduling)

The breakthrough that modern serving is built on. Instead of batching at the request level, batch at the **iteration level** — every decode step, fill the batch with whatever requests are available.

When a request finishes, immediately slot in a new waiting request. The batch is never idle waiting for slow requests.

```
Step 1: [Req1, Req2, Req3]
Step 2: [Req1, Req2, Req3]
Step 3: [Req1, Req2, Req4]  ← Req3 finished, Req4 slotted in immediately
Step 4: [Req1, Req5, Req4]  ← Req2 finished, Req5 slotted in
```

**This is the core innovation in vLLM** and the reason throughput improved 10-20x over naive serving. Every production inference server uses continuous batching.

### PagedAttention — virtual memory for KV cache

KV cache memory management has a classic fragmentation problem. You don't know how long a response will be upfront, so you can't pre-allocate exactly the right amount of memory. Over-allocate and you waste memory. Under-allocate and you crash mid-generation.

**PagedAttention** (vLLM's core contribution) applies OS virtual memory concepts to KV cache:

- Divide KV cache into fixed-size **pages** (like memory pages)
- Each request gets a **page table** mapping logical positions to physical pages
- Pages are allocated on-demand as the sequence grows
- Pages can be **shared** — if two requests have the same prefix (e.g., same system prompt), their KV cache pages can be physically shared

```
Logical KV cache:   [0-15][16-31][32-47]...
Physical pages:     [page_7][page_2][page_15]...  (non-contiguous, no fragmentation)
```

Result: near-zero KV cache fragmentation, much higher GPU memory utilization, higher throughput.

---

## 🗜️ 5. Quantization

The other major attack on the memory bandwidth wall: **make the weights smaller**.

### Why quantization works

Model weights are stored as floating point numbers. BF16 = 2 bytes per parameter. If you can represent weights with fewer bits without destroying accuracy, you:

- Read less data from memory per token → faster decode
- Fit larger models (or larger batches) in the same GPU memory

### Post-Training Quantization (PTQ)

Quantize after training — no retraining required.

**INT8 (W8A8):** Weights and activations in 8-bit integers. ~2x memory reduction, minimal quality loss for most tasks. Used widely in production.

**INT4 / NF4 (W4A16):** Weights in 4-bit, activations in 16-bit. ~4x memory reduction. Some quality loss, especially on tasks requiring precision. QLoRA uses NF4 for the frozen base model.

**GPTQ:** Calibration-based PTQ — uses a small dataset to minimize quantization error layer by layer. Better quality than naive rounding. Standard for W4 quantization.

**AWQ (Activation-aware Weight Quantization):** Observes that some weights are more important than others (those corresponding to large activations). Protect those weights from aggressive quantization. Better quality than GPTQ especially at W4.

### Quantization tradeoffs

```
Precision    Memory     Speed      Quality
FP32         100%       1x         Baseline
BF16         50%        ~1.5x      ~FP32
INT8         25%        ~2x        Minimal loss
INT4         12.5%      ~3-4x      Noticeable on hard tasks
```

**The practical sweet spot:** W4A16 (AWQ or GPTQ) for memory-constrained deployment, INT8 for quality-sensitive production serving.

### Quantization-Aware Training (QAT)

Train the model with simulated quantization from the start — the model learns to be robust to lower precision. Better quality than PTQ at the same bit width but requires retraining. Used by some frontier labs for their production models.

---

## 🚀 6. Speculative Decoding

A clever algorithmic trick to get more tokens per second without changing model quality.

### The insight

Decode is slow because each token requires a full forward pass of the large model. But most tokens in a sequence are **predictable** — common words, continuations of phrases. What if a small fast model could guess multiple tokens ahead, and the big model just _verifies_ them in parallel?

### How it works

1. A small **draft model** (e.g., 7B) autoregressively generates K candidate tokens (e.g., 5) very quickly
2. The large **target model** runs one forward pass processing all K tokens in parallel
3. The target model verifies each draft token — accepts if its probability is high enough, rejects otherwise
4. On rejection, use the target model's token at that position and discard the rest
5. Repeat

```
Draft model generates:     ["The", "cat", "sat", "on", "the"]
Target model verifies:      ✓      ✓      ✓      ✗
                                                  ↑ rejects "on", uses its own token
Result: 3 tokens accepted in one target model forward pass
```

### The speedup

If the draft model's acceptance rate is high (sequences are predictable), you get K tokens for the cost of ~1 target model forward pass. Real-world speedups: **2-3x** on typical text generation.

**Cost:** You need to run two models. The draft model must be from the same model family (same tokenizer, similar distribution). Storage and memory overhead for the draft model.

**Where it shines:** Code generation (highly predictable), document completion, tasks with repetitive structure.

---

## 🛠️ 7. Serving Frameworks

### vLLM

The dominant open-source inference server. Built by UC Berkeley, now a major project.

Core contributions: PagedAttention + continuous batching. Also supports tensor parallelism (multi-GPU), quantization (GPTQ, AWQ, INT8), speculative decoding, and almost every major open model (LLaMA, Mistral, Qwen, Falcon, etc.).

```python
from vllm import LLM, SamplingParams

llm = LLM(model="meta-llama/Meta-Llama-3-8B-Instruct",
          tensor_parallel_size=2,
          quantization="awq")

outputs = llm.generate(
    ["Explain transformers simply"],
    SamplingParams(temperature=0.7, max_tokens=512)
)
```

**Use when:** Serving open models, need flexibility, research/production balance.

### TensorRT-LLM

NVIDIA's inference optimization library. Compiles models into highly optimized TensorRT engines — kernel fusion, custom CUDA kernels, aggressive quantization.

Higher peak throughput than vLLM for NVIDIA hardware. More complex setup, less flexibility. Used in high-performance production deployments at scale.

**Use when:** Maximum throughput on NVIDIA hardware, latency-critical production.

### Triton Inference Server

NVIDIA's model serving framework — not to be confused with OpenAI's Triton compiler. Handles multi-model serving, request queuing, health checks, metrics. Often sits above TensorRT-LLM as the serving layer.

### Ollama

Local serving for developers. Dead-simple setup, runs quantized models on consumer hardware (including Apple Silicon). Not production-grade but excellent for development.

### SGLang

Emerging framework from Stanford focused on **structured generation** — efficiently handling complex prompting patterns, multi-call workflows, constrained decoding (JSON mode). Faster than vLLM for agentic workloads.

### API providers

For most product teams: **don't run your own inference**. Use:

- **OpenAI API** — GPT-4o, o1, o3
- **Anthropic API** — Claude Sonnet, Opus, Haiku
- **Together AI / Fireworks AI** — open models (LLaMA, Mistral) served at scale
- **AWS Bedrock / Google Vertex AI** — cloud-native, compliance-friendly

---

## 🏗️ 8. Deployment Architectures

### Single GPU serving

Small models (≤13B at INT4) fit on a single GPU. Simplest setup. vLLM or Ollama. Good for: internal tools, low-traffic APIs.

### Multi-GPU tensor parallelism

For models that don't fit on one GPU. Tensor parallel splits layers across GPUs within a node. vLLM handles this with `tensor_parallel_size=N`.

```
LLaMA 3 70B at BF16 = 140 GB
4× A100 80GB = 320 GB available → fits with tensor_parallel_size=4
```

### Multi-node serving

Very large models (>200B) or very high throughput requirements. Combine tensor parallelism within nodes with pipeline or data parallelism across nodes. Complex to operate — this is what frontier API providers run.

### Autoscaling

Production deployments autoscale based on request queue depth:

- **Scale up:** spin up more inference replicas when queue grows
- **Scale down:** terminate idle replicas to save cost
- Kubernetes + custom operators (Ray Serve, BentoML) handle this

```
Traffic spike → queue builds up → K8s spins up new vLLM pods
               → load balancer distributes requests
Traffic drops → pods idle → K8s terminates excess pods
```

### Prefill-Decode disaggregation

Advanced architecture used at frontier scale. Split the cluster into:

- **Prefill workers** — optimized for compute-intensive prompt processing
- **Decode workers** — optimized for memory-bandwidth-intensive token generation

Route each phase to the right hardware. Reduces interference between long-prompt and high-throughput workloads.

---

## 💰 9. Cost Modeling

Understanding inference economics is critical for product decisions.

### The fundamental unit: tokens

Everything is priced in tokens. Current market rates (approximate):

|Model|Input (per 1M tokens)|Output (per 1M tokens)|
|---|---|---|
|GPT-4o|$2.50|$10.00|
|Claude Sonnet|$3.00|$15.00|
|LLaMA 3 70B (Together AI)|$0.90|$0.90|
|LLaMA 3 8B (Together AI)|$0.20|$0.20|

Output tokens are more expensive than input — they require sequential decode steps. Input can be processed in one parallel prefill pass.

### Self-hosting economics

When does running your own inference beat API costs?

```
H100 GPU: ~$2-3/hour on cloud (spot), ~$3-4/hour on-demand
LLaMA 3 70B on 4× H100: ~$10-12/hour
Throughput: ~5,000-10,000 output tokens/second with good batching

Cost per 1M output tokens:
  $10/hour ÷ (7,500 tok/sec × 3600 sec/hr) ÷ 1M
  = $10 ÷ 27,000M tokens/hr ÷ 1M
  ≈ $0.37 per 1M tokens

vs. API: $0.90 per 1M tokens (Together AI) or $15 (Claude Sonnet)
```

**Self-hosting wins when:** High volume, predictable traffic, cost sensitivity, data privacy requirements.

**API wins when:** Low/unpredictable volume, no ML ops capacity, need frontier model quality.

### Latency vs. throughput tradeoff

These are in tension:

- **Minimize latency** → small batch sizes, prioritize time-to-first-token, fewer requests per GPU
- **Maximize throughput** → large batches, pack GPUs full, accept higher per-request latency

Most products need both — fast enough for interactive use, efficient enough to be affordable. The knobs:

- **Max batch size** — higher = better throughput, higher latency
- **Max queue time** — how long to wait before dispatching a batch
- **Chunked prefill** — interleave prefill and decode to reduce time-to-first-token for new requests

---

## 🔁 How Inference Connects to the Lifecycle

```
✅ Stage 0 — Model Landscape
✅ Stage 1 — Data Layer
✅ Stage 2 — Pretraining
✅ Stage 3 — Post-Training
✅ Stage 4 — Inference & Serving
        ↓
→ Stage 5 — Application & Integration  ← next
   (RAG, agents, prompt engineering,
    the actual product layer)
→ Stage 6 — MLOps & Observability
→ Stage 7 — AI Product Strategy
```

---
