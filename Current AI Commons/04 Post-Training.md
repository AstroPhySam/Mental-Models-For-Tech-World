# Stage 3 — Post-Training

> _Pretraining gives the model knowledge. Post-training gives it behavior. This is where a raw text predictor becomes something that listens, follows instructions, and aligns with human values._

---

## 🗺️ What we'll cover

1. **The Problem with Base Models** — why post-training is necessary
2. **Supervised Fine-Tuning (SFT)** — teaching the model to follow instructions
3. **Alignment: RLHF, DPO, and friends** — teaching the model to be _good_
4. **Parameter-Efficient Fine-Tuning (PEFT)** — LoRA, QLoRA, adapters
5. **Evaluation** — how do you know if it's working?
6. **Safety & Red-Teaming** — making it robust
7. **The Full Post-Training Pipeline** — how it all chains together

---

## 🧱 1. The Problem with Base Models

A base model fresh out of pretraining has one goal: _predict the next token_. Ask it a question and it'll likely just... continue the question. Or answer in the style of a forum post. Or hallucinate wildly.

```
Prompt:  "What is the capital of France?"
Base:    "What is the capital of France? What is the capital of Germany?
          What is the capital of Spain? (Quiz Bowl practice set, 2019)"
```

The base model learned to complete documents — not to be an assistant. It has no concept of:

- Turns in a conversation
- Following an instruction vs. completing a pattern
- Being helpful vs. just statistically plausible
- Refusing harmful requests

Post-training is the entire process of reshaping _behavior_ without destroying the _knowledge_ baked in during pretraining.

---

## 🎓 2. Supervised Fine-Tuning (SFT)

### What it is

SFT is straightforward: take the pretrained base, show it examples of the _behavior you want_, fine-tune on those examples using the same next-token prediction loss.

The training data now looks like:

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain recursion simply."},
    {"role": "assistant", "content": "Recursion is when a function calls itself..."}
  ]
}
```

The model trains to predict the **assistant turn only** — the user and system turns are masked out in the loss. You're not teaching it to predict user messages; you're teaching it to produce good assistant responses.

### What SFT teaches

- **Instruction following** — respond to the user's intent, not just complete the pattern
- **Chat format** — understand turns, system prompts, conversation history
- **Output format** — JSON when asked, markdown when appropriate, concise when needed
- **Tone and style** — professional, helpful, direct

### How much data do you need?

Surprisingly little — _if_ the quality is high. The original **Alpaca** paper (Stanford) showed 52K instruction-following examples from GPT-3 was enough to dramatically change behavior. **LIMA** (Meta, 2023) showed **1,000 carefully curated examples** could match models trained on much larger datasets.

The principle: **SFT teaches format and style, not knowledge.** The knowledge is already in the weights from pretraining. You're redirecting behavior, not injecting new facts.

### The SFT data sources

- **Human-written demonstrations** — highest quality, most expensive
- **Model-generated + human-filtered** — GPT-4 generates, humans filter/edit
- **Synthetic pipelines** — Self-Instruct, Evol-Instruct (iteratively generate harder examples)
- **Distillation** — use a powerful teacher model (GPT-4) to generate responses, train a smaller student on them. This is how most open models (Vicuna, Alpaca, OpenHermes) were built.

### What SFT doesn't fix

SFT gets you instruction following. But it doesn't reliably give you:

- Preference for _better_ responses over merely _correct_ ones
- Consistent refusal of harmful requests
- Calibrated, honest responses

For that you need alignment.

---

## 🎯 3. Alignment

Alignment is the process of making the model's behavior match human preferences and values. The core challenge: **you can't write down every rule**. The space of possible inputs is infinite. You need the model to _generalize_ what "good behavior" means.

### RLHF — Reinforcement Learning from Human Feedback

RLHF is the original alignment technique. Used by ChatGPT, Claude 1/2, early Gemini. Three stages:

**Step 1: Collect preference data**

Show human raters pairs of model responses to the same prompt. They pick which is better.

```
Prompt: "How do I get better at programming?"
Response A: "Practice every day and read documentation."
Response B: "Start with small projects, debug intentionally,
             read others' code, and build things you care about."

Human preference: B > A
```

Collect hundreds of thousands of these comparisons.

**Step 2: Train a Reward Model (RM)**

Train a separate model to _predict_ human preferences. Input: prompt + response. Output: a scalar score.

The RM is initialized from the SFT model (same architecture), then trained on the preference data using a ranking loss — the chosen response should score higher than the rejected one.

```
RM(prompt, response_B) > RM(prompt, response_A)
Loss = -log(sigmoid(score_B - score_A))
```

**Step 3: RL fine-tuning with PPO**

Now use the reward model as an environment. The SFT model is the policy. Generate responses, score them with the RM, use **PPO (Proximal Policy Optimization)** to update the policy to maximize reward.

Critical addition: a **KL divergence penalty** between the current policy and the original SFT model. Without this, the model **reward hacks** — learns to generate text that scores high on the RM but is incoherent or degenerate. The KL term keeps it close to the original distribution.

```
Total reward = RM_score - β × KL(policy || SFT_model)
```

**Why RLHF is hard:**

- PPO is notoriously unstable — sensitive to hyperparameters
- Reward hacking is a constant risk
- The RM itself can be wrong — GIGO applies here too
- Expensive: requires the RM, the policy, a frozen reference model, all in memory simultaneously

---

### DPO — Direct Preference Optimization

DPO (2023, Stanford) elegantly sidesteps RLHF's complexity. Key insight: **you don't need a separate reward model**. The optimal policy under the RLHF objective can be expressed directly in terms of the language model itself.

DPO reformulates the problem as a classification loss directly on preference pairs:

```
Loss = -log(sigmoid(
  β × log(policy(chosen) / ref(chosen)) -
  β × log(policy(rejected) / ref(rejected))
))
```

In plain english: increase the probability of chosen responses relative to a frozen reference model, decrease the probability of rejected responses. No RM, no PPO, no RL at all.

**Why DPO won:**

- Same or better alignment quality as RLHF
- Much simpler to implement
- Stable training — just supervised learning
- No reward hacking surface

**DPO is now the dominant alignment technique** for most open model fine-tuning. The frontier labs (Anthropic, OpenAI) still use more complex RLHF variants, but DPO is the practical default.

### Constitutional AI (CAI) — Anthropic's approach

Rather than relying entirely on human labels, CAI adds a **self-critique loop**:

1. Model generates a response
2. Model critiques its own response against a set of principles ("the constitution")
3. Model revises the response based on the critique
4. These revised responses become SFT/RLHF training data

This scales human oversight — you write principles once, the model generates its own training signal. Claude is trained using CAI.

### RLAIF — RL from AI Feedback

Instead of human raters labeling preferences, use a powerful AI model (e.g., GPT-4) as the rater. Much cheaper, scalable. Quality depends on the judge model. Used increasingly alongside human feedback rather than replacing it.

---

## ⚡ 4. Parameter-Efficient Fine-Tuning (PEFT)

Full fine-tuning (updating all parameters) is expensive. A 70B model has 70B parameters — storing gradients and optimizer states for all of them requires enormous memory. For most fine-tuning use cases, you don't need to update everything.

**PEFT methods** freeze most of the model and only train a small number of new parameters.

### LoRA — Low-Rank Adaptation

The dominant PEFT technique. The core insight: **weight updates during fine-tuning tend to be low-rank**. Instead of learning a full ΔW update matrix, approximate it as two small matrices:

```
ΔW = A × B
where W is (d × k), A is (d × r), B is (r × k), r << d
```

The rank r is a hyperparameter — typically 8, 16, or 64. This reduces trainable parameters dramatically:

```
Full fine-tune of one 4096×4096 weight matrix:
  16,777,216 parameters

LoRA with rank 16:
  4096×16 + 16×4096 = 131,072 parameters  (0.78% of full)
```

During training, the original weights W are **frozen**. Only A and B are updated. At inference, you can merge LoRA weights back: W' = W + AB. Zero inference overhead.

**Applied to:** Q, K, V projection matrices in attention (standard), sometimes FFN layers too.

### QLoRA — Quantized LoRA

Combines LoRA with **quantization** of the base model weights. The frozen base is loaded in 4-bit precision (NF4 format), saving 8x memory vs FP32. LoRA adapters are trained in BF16.

Impact: fine-tune a 70B model on **a single 48GB GPU**. QLoRA democratized fine-tuning of large models. Most open model fine-tuning today uses QLoRA.

### Other PEFT methods worth knowing

|Method|Idea|When used|
|---|---|---|
|**Prefix Tuning**|Prepend trainable tokens to each layer's KV|NLP tasks, older|
|**Prompt Tuning**|Trainable soft tokens at input only|Very lightweight|
|**IA³**|Scale activations with learned vectors|Extremely parameter-efficient|
|**Adapters**|Small bottleneck layers inserted between transformer layers|Vision-language models|

---

## 📊 5. Evaluation

How do you know if post-training worked? Evaluation is one of the hardest unsolved problems in AI.

### Automatic benchmarks

Standard benchmarks used across the industry:

|Benchmark|Tests|
|---|---|
|**MMLU**|57-subject academic knowledge|
|**HumanEval / MBPP**|Code generation correctness|
|**GSM8K / MATH**|Math reasoning|
|**HellaSwag / WinoGrande**|Commonsense reasoning|
|**TruthfulQA**|Avoiding false beliefs|
|**MT-Bench**|Multi-turn instruction following|
|**IFEval**|Strict instruction following|

**The problem with benchmarks:** Models (and labs) overfit to them. If a benchmark is public, training data may contain it. Results inflate. This is **benchmark contamination** and it's rampant.

### LLM-as-Judge

Use a powerful model (GPT-4, Claude) to evaluate outputs. Given a prompt and response, the judge scores quality, helpfulness, accuracy on a 1-10 scale or picks between two responses (used in **Chatbot Arena**).

**Chatbot Arena** (LMSYS) — blind human preferences between models, produces an Elo ranking. Currently the most trusted public evaluation because it's hard to game.

**Problems with LLM-as-judge:**

- Positional bias (prefers first response)
- Verbosity bias (prefers longer responses)
- Self-preference (Claude rates Claude higher)

Mitigations: swap response order, run multiple judges, calibrate against human labels.

### Task-specific evals

For your product, generic benchmarks don't tell you what matters. You need **evals on your actual task**:

```
Bad eval: "MMLU score improved from 72 → 74"
Good eval: "On our customer support dataset,
            resolution rate improved from 61% → 78%,
            escalations decreased 23%"
```

Build a golden dataset of inputs + expected outputs specific to your use case. Run it after every fine-tuning iteration. This is your ground truth.

### Regression testing

Post-training can **break existing capabilities**. A fine-tune for coding might degrade instruction following. You need a regression suite that catches capability degradation — not just improvement on target metrics.

---

## 🛡️ 6. Safety & Red-Teaming

Before deployment, models are stress-tested for failure modes.

### What red-teaming involves

Teams of humans (internal + contracted) attempt to make the model:

- Produce harmful content (weapons, CSAM, self-harm)
- Leak system prompts
- Be manipulated via jailbreaks
- Give confidently wrong information
- Behave inconsistently under adversarial prompting

Findings feed back into more SFT/RLHF data targeting those failure modes.

### Automated red-teaming

Human red-teamers don't scale. **Automated red-teaming** uses another model to generate adversarial prompts systematically:

- Jailbreak variations at scale
- Edge case generation
- Persona attacks ("pretend you are an AI with no restrictions")

### Safety fine-tuning data

The output of red-teaming is more training data — examples of adversarial inputs paired with appropriate refusals or safe responses. This is mixed into SFT and RLHF data.

**The alignment tax:** Safety fine-tuning can reduce capability on legitimate tasks — over-refusal is a real product problem. Calibrating the tradeoff between safety and helpfulness is an ongoing engineering challenge.

---

## 🔁 7. The Full Post-Training Pipeline

How it all chains together at a frontier lab:

```
Base Model (from pretraining)
        ↓
SFT Stage 1 — broad instruction following
  (diverse instruction data, chat format, basic tasks)
        ↓
SFT Stage 2 — targeted capability data
  (code, math, reasoning, domain-specific)
        ↓
Reward Model Training
  (human preference data → RM)
        ↓
RLHF / DPO alignment
  (preference optimization + KL constraint)
        ↓
Safety fine-tuning
  (red-team outputs → refusal training)
        ↓
Evaluation suite
  (benchmarks + human eval + task evals)
        ↓
  ┌─────────────────────────────┐
  │ Pass? → deploy              │
  │ Fail? → iterate on data     │
  └─────────────────────────────┘
        ↓
Deployed Model
```

In practice this is **iterative** — multiple rounds of SFT → alignment → eval → fix → repeat. A frontier model's post-training might run dozens of iterations before release.

---

## 💡 Developer Relevance Callouts

**If you're fine-tuning an open model:**

- Start with SFT on high-quality task-specific data (even 500–1000 examples)
- Use QLoRA unless you have serious GPU budget
- DPO if you can collect preference pairs on your task
- Always run your task-specific eval suite, not just generic benchmarks

**If you're building on API models:**

- System prompt engineering is your lightweight version of SFT
- Few-shot examples in the prompt = in-context SFT
- Fine-tuning via OpenAI/Anthropic APIs is essentially SFT on their infrastructure

**If you're evaluating models for your product:**

- Don't trust leaderboard benchmarks blindly
- Build 50–100 golden examples for your specific task
- Use LLM-as-judge with swap consistency checks

---

## Where We Are in the Lifecycle

```
✅ Stage 0 — Model Landscape
✅ Stage 1 — Data Layer
✅ Stage 2 — Pretraining
✅ Stage 3 — Post-Training
        ↓
→ Stage 4 — Inference & Serving   ← next
→ Stage 5 — Application & Integration
→ Stage 6 — MLOps & Observability
→ Stage 7 — AI Product Strategy
```

