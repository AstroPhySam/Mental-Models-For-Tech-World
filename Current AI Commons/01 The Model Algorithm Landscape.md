# Stage 0 — The Model Algorithm Landscape

### **How to read this**

Every architecture below answers: _What problem does it solve? What's the core idea? Where is it used today?_

---

## 🧱 1. The Transformer

**The dominant paradigm. Everything converges here.**

**Core idea:** Instead of processing sequences step-by-step (like RNNs), the Transformer looks at the _entire sequence at once_ and lets every token "attend" to every other token simultaneously. This is the **self-attention mechanism** — each token asks: _"which other tokens in this sequence are most relevant to understanding me?"_

The formula at the heart of it:

> Attention(Q, K, V) = softmax(QKᵀ / √d) · V

In plain english: every token casts a query, every other token has a key. Dot products tell you relevance scores. Those scores weight a value vector you sum up. That's one attention head. Stack many heads, add feed-forward layers, repeat N times — that's a Transformer.

**Why it won:** Parallelizable (unlike RNNs), scales with compute and data, generalizes across modalities.

**Industry usage:** GPT-4, Claude, Gemini, LLaMA, BERT, Whisper, Stable Diffusion's text encoder — it's everywhere.

---

## 🔤 2. Transformer Variants — The Family Tree

The Transformer is a base. What you do with it splits into three families:

### **2a. Decoder-only (Autoregressive)**

> Predict the next token, left to right. That's it.

Each token only attends to tokens _before_ it (causal masking). During training, you feed it text and ask it to predict the next word at every position simultaneously. At inference, you generate one token at a time.

**Why it dominates language:** Simple objective, scales incredibly well, emergent capabilities appear at scale.

**Examples:** GPT-4, Claude, LLaMA, Mistral, Gemini, Grok — virtually every frontier LLM.

---

### **2b. Encoder-only**

> Read the whole sequence bidirectionally, produce rich representations.

No causal masking — every token attends to every other token. Trained with **Masked Language Modeling** (MLM): randomly mask tokens, predict them. Great at _understanding_, not generation.

**Examples:** BERT, RoBERTa, sentence-transformers (used for embeddings/RAG).

**Industry usage:** Search ranking, semantic similarity, classification, embeddings in RAG pipelines.

---

### **2c. Encoder-Decoder (Seq2Seq)**

> Encode the input fully, then decode an output sequence.

Encoder reads the full input bidirectionally. Decoder generates output autoregressively, attending to the encoder's representation via **cross-attention**.

**Examples:** T5, BART, mT5, Whisper (audio encoder → text decoder).

**Industry usage:** Translation, summarization, speech-to-text, document QA.

---

## 🔁 3. RNNs / LSTMs / GRUs

**The predecessors. Mostly dethroned — but not dead.**

**Core idea:** Process sequences token-by-token, maintaining a hidden state that acts as "memory." LSTMs added gates (input, forget, output) to control what to remember vs. discard — solving the vanishing gradient problem of vanilla RNNs.

**Why they lost to Transformers:** Can't parallelize training (sequential dependency), struggle with very long-range dependencies.

**Where they survive:** Edge/embedded devices (tiny footprint), time-series forecasting, some audio processing pipelines, legacy production systems.

---

## 🔀 4. State Space Models (SSMs) — Mamba & friends

**The serious Transformer challenger for long sequences.**

**Core idea:** Instead of attention (which is O(n²) in sequence length), SSMs model sequences through a linear recurrence with a structured state matrix. At training time they're parallelizable like Transformers; at inference they run like a recurrence — O(1) memory per step.

**Why it matters:** Attention's quadratic cost makes very long contexts (100K+ tokens) expensive. SSMs scale linearly.

**Mamba** (2023) is the breakthrough here — selective state spaces that learn _what_ to remember dynamically.

**Industry usage:** Still emerging. Being explored for long-document processing, genomics (very long sequences), audio. Hybrid Mamba-Transformer architectures (like Jamba by AI21) are being productionized.

**Bet level:** 🔥 High — this is the architecture most likely to challenge Transformer dominance in specific domains.

---

## 🌀 5. Diffusion Models

**The dominant paradigm for generation of images, audio, video.**

**Core idea:** Train a model to _reverse_ a gradual noising process. Start with pure noise, iteratively denoise toward a clean sample. The model learns to predict the noise at each step conditioned on a prompt.

**Why it works:** The iterative denoising gives the model many "steps" to refine output — much higher quality than single-pass generation for perceptual data.

**Examples:** Stable Diffusion, DALL·E 3, Sora (video), MusicGen, Udio (audio).

**Industry usage:** Image generation, video generation, audio synthesis, drug molecule design, protein structure generation.

**Bet level:** 🔥 Dominant for non-language modalities.

---

## 🎮 6. Reinforcement Learning (RL) & RLHF

**Not a standalone architecture — a training paradigm layered on top.**

**Core idea:** An agent takes actions, receives rewards, learns a policy that maximizes cumulative reward. In the LLM context, **RLHF** (Reinforcement Learning from Human Feedback) uses human preference data to train a reward model, then fine-tunes the LLM with PPO to maximize that reward.

**DPO** (Direct Preference Optimization) is a cleaner recent alternative — skips the reward model entirely, optimizes preferences directly.

**Industry usage:** The alignment layer of every frontier model (GPT-4, Claude, Gemini all use this). Also: game-playing agents (AlphaGo/AlphaZero), robotics, recommendation systems.

---

## 🧩 7. Mixture of Experts (MoE)

**Not a new architecture — a scaling strategy.**

**Core idea:** Instead of every token passing through the same dense feed-forward layers, you have N "expert" sub-networks and a **router** that selects a small subset (e.g., top-2 of 8) per token. You get a much larger _total_ parameter count with the same _active_ compute per token.

**Why it matters for products:** Better capability-per-FLOP. You can have a 140B parameter model that runs at the cost of a 22B dense model.

**Examples:** Mixtral 8x7B, GPT-4 (rumored), Gemini 1.5.

**Industry usage:** Frontier model training, cost-efficient serving of large models.

**Bet level:** 🔥 Already mainstream at the frontier.

---

## 📐 8. Graph Neural Networks (GNNs)

**For structured, relational data — where Transformers are overkill.**

**Core idea:** Data isn't always sequences or grids. Molecules, social networks, knowledge graphs are _graphs_. GNNs propagate information along edges — each node aggregates messages from its neighbors, iteratively building richer representations.

**Industry usage:** Drug discovery (molecular property prediction), fraud detection (transaction graphs), recommendation systems (Pinterest's PinSage, Uber's maps), chip design (Google used GNNs to design TPU floor plans).

**Bet level:** Medium — dominant in its niche, not a general-purpose contender.

---

## 🧬 9. CNNs (Convolutional Neural Networks)

**The old vision king — still alive in specific contexts.**

**Core idea:** Learnable filters slide over an input (image, audio spectrogram) detecting local patterns — edges, textures, shapes — hierarchically. Extremely parameter-efficient for spatially structured data.

**Why they're less dominant now:** Vision Transformers (ViT) have largely taken over at scale. But CNNs are still faster, cheaper, and more interpretable at smaller scales.

**Industry usage:** Mobile vision (on-device object detection, face unlock), real-time video processing, audio classification, medical imaging.

**Bet level:** Steady — not going away, but not the frontier.

---

## 🧠 10. Emerging / Frontier Bets

|Architecture|Core Idea|Why Watch|
|---|---|---|
|**Vision Transformers (ViT)**|Patch images into tokens, run a Transformer|Dominant in frontier vision models|
|**Multimodal Transformers**|Single model, multiple token types (text, image, audio)|GPT-4o, Gemini — the product direction|
|**World Models**|Learn a compressed model of environment dynamics|Robotics, game AI, planning (Genie, DreamerV3)|
|**Neural ODEs**|Continuous-depth networks|Scientific ML, time-series|
|**Test-Time Compute / Reasoning Models**|Spend more compute _at inference_ (chain-of-thought, search)|o1, o3, DeepSeek-R1 — the current frontier race|

---

## The Betting Summary

```
🔥 Highest bet (learn deeply):
   Decoder-only Transformer → LLMs (the core of everything)
   Diffusion Models → all generative media
   MoE → how frontier models scale
   RLHF/DPO → how models become products
   SSMs (Mamba) → the emerging challenger

📈 Worth understanding well:
   Encoder-only → embeddings, RAG, search
   Encoder-Decoder → translation, speech, summarization
   GNNs → structured/relational domains
   ViT + Multimodal → where the product frontier is going

📚 Know it exists:
   RNNs/LSTMs → legacy, edge
   CNNs → mobile, real-time, medical
   Test-time compute → active research frontier
```

---

