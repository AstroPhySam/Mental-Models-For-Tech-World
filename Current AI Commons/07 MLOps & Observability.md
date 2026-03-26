# Stage 6 — MLOps & Observability

> _You've built the model, served it, and wrapped it in a product. Now: how do you know it's working? How do you ship changes safely? How do you keep it healthy at 3am when you're asleep? This is the operational backbone of AI products._

---

## 🗺️ What we'll cover

1. **Why MLOps is Different from DevOps** — the unique challenges
2. **Experiment Tracking** — managing the chaos of ML iteration
3. **Model Registry & Versioning** — knowing what's in production
4. **CI/CD for ML** — shipping model changes safely
5. **Production Monitoring** — the full observability stack for LLM apps
6. **Drift Detection** — catching degradation before users do
7. **LLM-Specific Observability** — traces, evals, cost dashboards
8. **A/B Testing & Experimentation** — making decisions with data
9. **The Full MLOps Stack** — how it all wires together

---

## ⚡ 1. Why MLOps is Different from DevOps

Traditional software has a simple invariant: **same code + same input = same output**. Testing is deterministic. Deployment is binary — it works or it doesn't.

ML breaks every one of these assumptions:

|DevOps assumption|How ML breaks it|
|---|---|
|Code is the artifact|**Model weights + code + data** are all artifacts|
|Tests are deterministic|Model outputs are probabilistic — no exact expected output|
|Bugs are in code|Bugs can be in **data**, weights, prompts, or their interaction|
|Deploy once, monitor uptime|Model behavior **drifts** even without code changes|
|Rollback = redeploy old code|Rollback means **old weights + old prompt + old data pipeline**|
|Performance is latency/errors|Performance is also **output quality** — harder to measure|

This is why MLOps exists as a discipline separate from DevOps. The tooling, the mental models, and the failure modes are fundamentally different.

---

## 📊 2. Experiment Tracking

### The problem

ML development is inherently experimental. You run dozens of training runs, prompt variations, RAG configurations, fine-tuning experiments. Without tracking, you lose:

- Which hyperparameters produced that good result last Tuesday
- Whether the new chunking strategy actually improved retrieval
- What the baseline was before you started optimizing

### What to track

Every experiment should log:

```
Inputs:
  - Hyperparameters (LR, batch size, LoRA rank, chunk size, temperature)
  - Dataset version + hash
  - Base model version
  - Code commit hash
  - Prompt version

Outputs:
  - Loss curves (train + val)
  - Evaluation metrics (task-specific + benchmarks)
  - Generated samples
  - Artifacts (model checkpoint, tokenizer)

Metadata:
  - Run timestamp, duration, cost
  - Hardware used
  - Tags and notes
```

### Tools

**Weights & Biases (W&B):** The dominant experiment tracker. Rich UI, automatic artifact versioning, hyperparameter sweep management, team collaboration. Integrates with PyTorch, HuggingFace, LangChain natively.

```python
import wandb

wandb.init(project="llm-finetune", config={
    "model": "llama-3-8b",
    "lora_rank": 16,
    "learning_rate": 2e-4,
    "dataset_version": "v3.2"
})

# Logs automatically during training
wandb.log({"train_loss": loss, "val_loss": val_loss, "step": step})

# Log eval results
wandb.log({"task_accuracy": 0.847, "avg_latency_ms": 312})
```

**MLflow:** Open-source, self-hostable. Slightly less polished UI than W&B but no vendor lock-in. Good for enterprises with data residency requirements.

**TensorBoard:** Google's original. Good for training curves, less good for experiment comparison and collaboration.

**Comet ML:** Strong for LLM-specific tracking — prompt versioning, LLM output logging built-in.

### Hyperparameter sweeps

Instead of manually trying combinations, define a search space and let the tracker run automated sweeps:

```python
sweep_config = {
    "method": "bayes",  # Bayesian optimization
    "metric": {"name": "val_loss", "goal": "minimize"},
    "parameters": {
        "lora_rank": {"values": [8, 16, 32, 64]},
        "learning_rate": {"min": 1e-5, "max": 1e-3, "distribution": "log_uniform"},
        "batch_size": {"values": [4, 8, 16]}
    }
}
sweep_id = wandb.sweep(sweep_config, project="llm-finetune")
wandb.agent(sweep_id, train_function, count=20)
```

Bayesian optimization directs the search toward promising regions — much more efficient than grid or random search.

---

## 🗄️ 3. Model Registry & Versioning

### The problem

Without a registry, models are files on someone's laptop or unnamed blobs in S3. You can't answer: "What model is in production right now? What was the model we deployed before last week's incident? What's the difference between model v2 and v3?"

### What a model registry does

A model registry is a **versioned, metadata-rich catalog** of model artifacts:

```
Model: customer-support-assistant
├── v1.0  │ base: llama-3-8b │ trained: 2024-01-15 │ status: archived
├── v2.0  │ base: llama-3-8b │ trained: 2024-02-20 │ status: production
├── v2.1  │ base: llama-3-8b │ trained: 2024-03-01 │ status: staging
└── v3.0  │ base: llama-3-70b│ trained: 2024-03-10 │ status: development
```

Each version stores:

- Model weights + tokenizer
- Training run ID (links back to experiment tracker)
- Dataset version used
- Evaluation results
- Deployment history
- Lineage (which model was it fine-tuned from?)

### For LLM API products

If you're using GPT-4 or Claude via API, your "model" is:

- The specific API model version (e.g., `claude-sonnet-4-20250514`)
- Your system prompt (version controlled in Git)
- Your RAG pipeline configuration
- Your prompt templates

**Version all of these together.** A "deployment" is a specific combination of model version + prompt version + pipeline config.

```yaml
# deployment-v2.3.yaml
model: claude-sonnet-4-20250514
system_prompt: prompts/system_v4.txt
rag_config:
  chunk_size: 512
  overlap: 64
  embedding_model: text-embedding-3-large
  top_k: 5
  reranker: cohere-rerank-v3
temperature: 0.3
max_tokens: 1024
```

### Tools

**MLflow Model Registry:** Built into MLflow, good for custom/fine-tuned models. **W&B Artifacts + Registry:** Tight integration with experiment tracking. **HuggingFace Hub:** Defacto registry for open models — versioned, public or private. **Custom in S3/GCS:** Many teams just use object storage with a metadata database. Simple, flexible, no vendor lock-in.

---

## 🚀 4. CI/CD for ML

### The ML deployment pipeline

ML CI/CD extends traditional CI/CD with model-specific gates:

```
Code change (prompt, pipeline, fine-tune config)
        ↓
Unit tests
  (prompt template renders correctly, pipeline code runs,
   schema validation passes)
        ↓
Evaluation suite (automated)
  (run golden eval set, check metrics meet thresholds)
        ↓
Regression check
  (no capability degradation vs. current production)
        ↓
Shadow deployment
  (run new version in parallel with prod, log outputs, don't serve to users)
        ↓
Canary deployment
  (route 5% of traffic to new version, monitor metrics)
        ↓
Full rollout
  (100% traffic, old version on standby for rollback)
```

### Evaluation gates

The key difference from software CI: **you need automated evals as a quality gate**, not just tests.

```python
# In your CI pipeline
def eval_gate(model_version, threshold=0.85):
    results = run_eval_suite(
        model=model_version,
        dataset="golden_eval_v3",
        metrics=["task_accuracy", "format_compliance", "refusal_rate"]
    )

    if results["task_accuracy"] < threshold:
        raise EvalFailure(f"Accuracy {results['task_accuracy']} below threshold {threshold}")

    if results["task_accuracy"] < current_prod_accuracy - 0.02:
        raise RegressionFailure("Accuracy regressed vs. production")

    return results
```

### Prompt versioning in Git

Prompts are code. Version them like code:

```
prompts/
├── system_v1.txt       # archived
├── system_v2.txt       # archived
├── system_v3.txt       # production
├── system_v4.txt       # staging
└── templates/
    ├── rag_context.j2
    ├── tool_result.j2
    └── error_handler.j2
```

Diff prompts in PRs. Review prompt changes like code reviews. Tag prompt versions alongside model versions in deployments.

### Rollback strategy

When something goes wrong in production:

```
Immediate (< 5 min): route traffic back to previous deployment config
                     (flip load balancer, no redeployment needed)

Short-term: investigate root cause using traces and eval results

Fix: update prompt/pipeline/model, run through full CI/CD pipeline again
```

Rollback must be **instantaneous** for LLM apps — you're usually just swapping a config pointer, not redeploying weights (unless you self-host).

---

## 📡 5. Production Monitoring

### The four pillars of LLM observability

Traditional monitoring: latency, errors, throughput. LLM monitoring adds a fourth pillar: **output quality**.

```
1. System health     — is it up? is it fast?
2. Cost efficiency   — how much am I spending?
3. Usage patterns    — what are users actually doing?
4. Output quality    — is it giving good answers?
```

Most teams get pillar 1 easily (standard infra monitoring), struggle with pillar 4 (hard to measure automatically).

### System health metrics

Standard SRE metrics, nothing ML-specific:

```
Latency:
  - Time to first token (TTFT) — user perception of speed
  - Time per output token (TPOT) — generation speed
  - Total request latency (p50, p95, p99)

Throughput:
  - Requests per second
  - Tokens per second (input + output)

Errors:
  - 4xx rate (bad requests, rate limits)
  - 5xx rate (server errors, timeouts)
  - Retry rate

Availability:
  - Uptime percentage
  - Error budget consumption
```

### Cost metrics

LLM cost is token-driven — you need granular visibility:

```
Per request:
  - Input tokens
  - Output tokens
  - Total cost (input_tokens × input_price + output_tokens × output_price)

Aggregated:
  - Cost per user
  - Cost per feature/endpoint
  - Daily/monthly spend
  - Cost per successful task completion (efficiency metric)

Anomalies:
  - Sudden spike in token usage (prompt injection? runaway agent?)
  - Unusually long outputs (model going verbose?)
  - High cost users
```

Token cost spikes are often the first signal of something wrong — a bad prompt change causing verbose outputs, or an injection attack generating massive responses.

### Usage analytics

Understanding _what users are doing_ with your product:

```
- Query volume by time of day/week
- Most common query types/intents
- Tool call frequency by tool
- RAG retrieval hit rate (did we find relevant context?)
- Conversation length distribution
- Session abandonment points
- Feature usage breakdown
```

---

## 🔍 6. LLM-Specific Observability — Tracing

### The problem with black-box LLM calls

A single user-facing response might involve:

- 2 LLM calls (query rewrite + generation)
- 3 retrieval steps
- 1 reranking call
- 2 tool executions

When the response is bad, which step failed? Without tracing, you can't tell.

### LLM tracing

**Traces** capture the full execution tree of an LLM request — every model call, retrieval step, tool execution, and their inputs/outputs, latencies, and token counts.

```
Trace: user_query_abc123
├── query_rewrite (12ms, 45 tokens)
│   ├── input: "what did we discuss last time"
│   └── output: "previous conversation history customer support"
├── retrieval (89ms)
│   ├── embedding (23ms)
│   ├── vector_search (41ms, 20 results)
│   └── reranking (25ms, 5 results)
├── llm_call (1.2s, 1847 tokens)
│   ├── input: [system_prompt + context + query]
│   ├── tool_call: get_order_status(order_id="12345")
│   │   └── result: {"status": "shipped", "eta": "2024-03-15"}
│   └── output: "Your order #12345 shipped and arrives March 15th"
└── total: 1.4s, $0.0023
```

### Tracing tools

**LangSmith** (LangChain): Deep integration with LangChain ecosystem. Automatic tracing, eval runs, prompt management.

**Langfuse:** Open-source, self-hostable. Strong tracing + eval + cost tracking. Good privacy story.

**Helicone:** Proxy-based — sits in front of your LLM API calls, requires no code changes. Instant visibility.

**Arize Phoenix:** Strong for evaluation and debugging. Good visualization of embedding spaces.

**OpenTelemetry:** Standard observability protocol. OpenLLMetry extends it for LLMs. Vendor-neutral, integrates with Datadog, Grafana, Honeycomb.

```python
# Langfuse example
from langfuse.decorators import observe, langfuse_context

@observe()
def process_query(user_query: str):
    rewritten = rewrite_query(user_query)        # auto-traced
    chunks = retrieve_chunks(rewritten)           # auto-traced
    response = generate_response(chunks, rewritten) # auto-traced
    return response
```

---

## 📉 7. Drift Detection

### What is drift in LLM applications?

**Input drift:** User queries change character over time — new topics, new query patterns, different languages. Your RAG pipeline wasn't built for them.

**Output drift:** Model behavior changes — due to upstream model updates (API providers update models), prompt sensitivity to new input patterns, or context window changes.

**Data drift:** Your RAG knowledge base becomes stale — documents are outdated, new information isn't indexed.

**Performance drift:** Task metrics degrade over time without any explicit change you made.

### Detecting drift

**Statistical drift on inputs:** Monitor distributions of:

- Query length distribution
- Embedding centroid of queries (semantic drift)
- Query intent classification distribution
- Language distribution

Use statistical tests (KS test, PSI — Population Stability Index) to flag significant distribution shifts.

```python
# Monitor embedding drift
current_embeddings = embed_recent_queries(last_7_days)
baseline_embeddings = embed_baseline_queries(reference_period)

drift_score = population_stability_index(current_embeddings, baseline_embeddings)
if drift_score > 0.2:
    alert("Significant input drift detected")
```

**Output quality monitoring:**

- Run automated eval suite on a sample of production traffic daily
- Track metric trends over time — gradual degradation is as dangerous as sudden drops
- Monitor proxy metrics: user thumbs up/down, session length, retry rate, escalation rate

**RAG freshness:**

- Track document age in your knowledge base
- Monitor "no relevant context found" rate in retrieval
- Alert when key source documents haven't been updated in N days

### Upstream model version changes

API providers update models — sometimes silently. GPT-4-turbo today behaves differently than six months ago.

Mitigations:

- Pin to specific model versions where the API allows it
- Run your eval suite immediately when a model version changes
- Canary new model versions before full traffic switch

---

## 🧪 8. A/B Testing & Experimentation

### Why A/B testing LLMs is hard

Traditional A/B testing: measure click-through rate, conversion. Binary, fast signal.

LLM A/B testing: measure response quality. Subjective, slow signal. How do you know if response A is better than response B at scale?

### Experimentation approaches

**Implicit signals:** User behavior as proxy for quality — thumbs up/down, session continuation, task completion, follow-up questions (sign of confusion), re-asks (sign of wrong answer).

Cheap, scalable, but noisy. User behavior correlates with quality but doesn't measure it directly.

**LLM-as-judge at scale:** Sample N% of production traffic. For each request, run both variants. Use an LLM judge to compare responses. Aggregate win rates.

```python
def judge_comparison(query, response_a, response_b):
    judgment = llm_call(f"""
        Query: {query}
        Response A: {response_a}
        Response B: {response_b}

        Which response is better? Consider: accuracy, helpfulness, conciseness.
        Respond with JSON: {{"winner": "A" or "B" or "tie", "reasoning": "..."}}
    """)
    return judgment

# Run on 1000 sampled production pairs
results = [judge_comparison(q, a, b) for q, a, b in sample]
win_rate_a = sum(r["winner"] == "A" for r in results) / len(results)
```

**Human eval panels:** For high-stakes decisions (major model changes, alignment updates), pay human raters to evaluate a sample of outputs. Most reliable, most expensive. Use for major releases.

### Statistical significance

LLM eval metrics are noisy. You need enough samples for statistical confidence:

```
Typical effect size you care about: 2-5% improvement in task accuracy
Required sample size: 500-2000 examples for 80% power at p < 0.05

Rule of thumb: don't ship based on <200 evaluation examples
               don't make major decisions based on <1000 examples
```

---

## 🏗️ 9. The Full MLOps Stack

How everything wires together in a mature AI product team:

```
Development
  Experiment Tracker (W&B / MLflow)
  ├── Log hyperparameters, metrics, artifacts
  ├── Compare runs, identify best config
  └── Link to Model Registry

Model Registry (W&B / HuggingFace / MLflow)
  ├── Version model weights + prompt configs
  ├── Track lineage (base model → fine-tune → deployed)
  └── Gate deployment (must pass eval threshold)

CI/CD Pipeline (GitHub Actions / Jenkins)
  ├── Unit tests (code correctness)
  ├── Eval gate (automated quality threshold)
  ├── Regression check (vs. production baseline)
  └── Staged rollout (shadow → canary → full)

Production Serving (vLLM / API provider)
  ├── Load balancer
  ├── Multiple replicas
  └── Auto-scaling

Observability Stack
  ├── Tracing (Langfuse / LangSmith)
  │   └── Full execution tree per request
  ├── Metrics (Prometheus + Grafana)
  │   ├── System health (latency, errors, throughput)
  │   ├── Cost (tokens, $ per request)
  │   └── Usage (query patterns, feature usage)
  ├── Logging (structured JSON → Elasticsearch / Loki)
  └── Alerting (PagerDuty / OpsGenie)
      ├── Latency p99 > 5s
      ├── Error rate > 1%
      ├── Cost spike > 3σ
      └── Eval score drop > 5%

Continuous Evaluation
  ├── Daily eval suite on production sample
  ├── Drift detection (input distribution, output quality)
  ├── A/B test framework
  └── Human eval pipeline (for major changes)
```

---

## 💡 Developer Relevance Callouts

**Evals are the foundation of everything.** Without a solid eval suite, you can't do CI/CD gates, drift detection, or A/B testing meaningfully. Invest in evals before investing in any other MLOps tooling.

**Start with tracing on day one.** It costs almost nothing to add Langfuse or Helicone to your LLM calls. The first time something goes wrong in production — and it will — you'll be grateful for traces.

**Prompt changes need the same rigor as code changes.** A prompt edit is a production change. Version it, eval gate it, deploy it through CI/CD. "I'll just update the system prompt" has caused many production incidents.

**Cost monitoring prevents surprises.** Set budget alerts from day one. A runaway agent or a prompt injection attack can burn through API budget in minutes.

**The eval-deploy-monitor loop is your core operational rhythm:**

```
Build eval suite → Ship change → Monitor production
       ↑                                  ↓
       └──────── drift detected ──────────┘
```

---

## Where We Are

```
✅ Stage 0 — Model Landscape
✅ Stage 1 — Data Layer
✅ Stage 2 — Pretraining
✅ Stage 3 — Post-Training
✅ Stage 4 — Inference & Serving
✅ Stage 5 — Application & Integration
✅ Stage 6 — MLOps & Observability
        ↓
→ Stage 7 — AI Product Strategy  ← next (final stage)
```
