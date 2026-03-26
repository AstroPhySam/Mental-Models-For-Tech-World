# Stage 5 — Application & Integration Layer

> _This is where the model becomes a product. Everything before this was infrastructure. This is what users actually touch — and where most AI engineering work happens day-to-day._

---

## 🗺️ What we'll cover

1. **Prompt Engineering** — the interface between you and the model
2. **RAG** — giving the model knowledge it wasn't trained on
3. **Tool Use & Function Calling** — giving the model hands
4. **Agents & Orchestration** — autonomous multi-step reasoning
5. **Context Window Management** — working within limits
6. **Structured Output & Constrained Generation** — reliable machine-readable responses
7. **Memory & State** — making stateful applications on a stateless model

---

## ✍️ 1. Prompt Engineering

Prompt engineering is often dismissed as "just writing text." It's actually **the primary interface for steering model behavior** — the equivalent of an API contract between your product and the model.

### The anatomy of a prompt

Modern LLM APIs take a structured message array:

```python
messages = [
    {
        "role": "system",
        "content": "You are a senior software engineer reviewing PRs.
                    Be direct, technical, and concise.
                    Always cite specific line numbers."
    },
    {
        "role": "user",
        "content": "Review this Python function: ..."
    }
]
```

**System prompt:** Sets persistent behavior, persona, constraints, output format. The model treats this as ground truth about its operating context. This is your primary lever for shaping behavior.

**User turn:** The actual input. Can be a question, instruction, document, code, or any combination.

**Assistant turn:** The model's response. You can also _prefill_ this — start the assistant turn with a partial response to steer format or behavior.

### Core techniques

**Zero-shot:** Just ask. Works for well-trained models on common tasks.

```
"Summarize this article in 3 bullet points."
```

**Few-shot:** Provide examples before the actual input. Dramatically improves performance on format-sensitive or specialized tasks.

```
"Classify sentiment. Examples:
 'Great product!' → positive
 'Terrible experience' → negative
 'It was okay' → neutral

Now classify: 'Absolutely love it'"
```

**Chain-of-Thought (CoT):** Instruct the model to reason step-by-step before answering. Improves accuracy on math, logic, and multi-step tasks significantly.

```
"Solve this problem. Think step by step before giving your final answer."
```

The reason CoT works: the model's answer is conditioned on everything before it in context. Reasoning tokens before the answer give the model "scratch space" — intermediate steps it can build on.

**ReAct (Reason + Act):** Interleave reasoning and action steps. Foundation for agents:

```
Thought: I need to find the current price of AAPL
Action: search("AAPL stock price today")
Observation: $189.43
Thought: Now I can answer the question
Answer: AAPL is currently trading at $189.43
```

### Prompt engineering principles that actually matter

**Be specific about format.** "Respond in JSON with keys: summary, sentiment, confidence" beats "give me structured output."

**Specify what NOT to do.** Models respond well to negative constraints: "Do not include caveats or disclaimers."

**Persona assignment works.** "You are an expert in X" shifts the model's output distribution toward expert-level responses.

**Order matters.** Instructions at the beginning and end of the system prompt are weighted more heavily. Critical instructions → put them first or last, not buried in the middle.

**Temperature is a lever, not an afterthought.**

- Temperature = 0 → deterministic, greedy. Use for: classification, extraction, factual QA
- Temperature = 0.7 → balanced. Use for: most tasks
- Temperature = 1.0+ → creative, diverse. Use for: brainstorming, creative writing

---

## 📚 2. RAG — Retrieval Augmented Generation

### The core problem RAG solves

LLMs have a **knowledge cutoff** — they don't know about events after training. They also can't know _your_ private data — your docs, your codebase, your customers. And even within their training data, they hallucinate specific facts.

**RAG** solves this by retrieving relevant information at query time and injecting it into the context window. The model's job shifts from "recall from weights" to "reason over provided context."

### The full RAG pipeline

```
Offline (indexing):
Documents → Chunking → Embedding → Vector Store

Online (query time):
Query → Embed query → Vector search → Retrieve chunks
      → Inject into context → Model generates answer
```

Let's go deep on each step.

### Chunking

Documents must be split into chunks small enough to fit meaningfully in context but large enough to be semantically coherent.

**Fixed-size chunking:** Split every N tokens with M token overlap. Simple, fast, ignores structure.

```
chunk_size=512, overlap=64
```

**Semantic chunking:** Split at natural boundaries — paragraphs, sections, sentences. Preserves coherence better.

**Hierarchical chunking:** Store both small chunks (for precise retrieval) and their parent sections (for richer context). Retrieve small, return large. Used in **parent-document retrieval**.

**The overlap is critical.** Without overlap, a sentence split across two chunks loses context in both. Overlap ensures no information falls through the cracks.

Chunk size tradeoffs:

```
Smaller chunks → more precise retrieval, less context per chunk
Larger chunks → more context, more noise, harder to rank accurately
Typical sweet spot: 256-512 tokens for most use cases
```

### Embeddings

Each chunk is converted to a dense vector (embedding) that captures semantic meaning. Similar meaning → similar vectors → close in vector space.

**Embedding models:**

- **OpenAI text-embedding-3-large** — strong general purpose, 3072 dims
- **Cohere embed-v3** — strong multilingual
- **BGE-M3** (BAAI) — best open source, multilingual
- **E5-mistral** — strong open source instruction-tuned embeddings

**Critical:** Use the same embedding model at indexing time and query time. Mixing models breaks retrieval entirely.

### Vector stores

Store embeddings and support approximate nearest-neighbor (ANN) search efficiently.

|Store|Best for|
|---|---|
|**Pinecone**|Managed, production, simple ops|
|**Weaviate**|Hybrid search, self-hosted option|
|**Qdrant**|High performance, self-hosted|
|**pgvector**|Already using Postgres, simple setup|
|**FAISS**|In-memory, research, no persistence|
|**Chroma**|Local development, lightweight|

**ANN algorithms:** HNSW (Hierarchical Navigable Small World) is the dominant index — O(log n) search, high recall. pgvector supports both exact and HNSW.

### Retrieval strategies

**Dense retrieval:** Pure embedding similarity search. Great for semantic matches, misses keyword/exact matches.

**Sparse retrieval (BM25):** Classic keyword-based search (TF-IDF variant). Great for exact term matches, misses semantic similarity.

**Hybrid retrieval:** Combine dense + sparse scores. Consistently outperforms either alone. **Reciprocal Rank Fusion (RRF)** is the standard merging algorithm.

```python
# Hybrid search with RRF
dense_results = vector_store.search(query_embedding, k=20)
sparse_results = bm25_index.search(query_text, k=20)
final_results = reciprocal_rank_fusion(dense_results, sparse_results, k=10)
```

**Reranking:** After retrieval, run a cross-encoder reranker (Cohere Rerank, BGE reranker) to reorder results by true relevance. Cross-encoders see both query and document together — much more accurate than embedding similarity, but too slow to run on the full corpus.

```
Retrieval: fast, recall-oriented → get top 20 candidates
Reranking: slow, precision-oriented → reorder to top 5
```

### RAG failure modes

**Retrieval fails:** The right chunk isn't retrieved. Causes: bad chunking, wrong embedding model, query-document mismatch in language/style. Fix: hybrid search, query rewriting, better chunking.

**Context ignored:** The model ignores retrieved context and hallucinates anyway. Causes: too much irrelevant context, model not instruction-tuned for RAG. Fix: reranking, stricter system prompt ("answer only from the provided context").

**Lost in the middle:** Models attend better to the beginning and end of context. Chunks injected in the middle of a long context get underweighted. Fix: put most relevant chunks first or last, limit context length.

**Chunk boundary issues:** Answer spans two chunks, neither retrieved fully. Fix: overlap, parent-document retrieval.

### Advanced RAG patterns

**Query rewriting:** Use the model to rewrite the user's query into a better search query before retrieval. "What did the CEO say last quarter?" → "CEO earnings call statement Q3 2024."

**HyDE (Hypothetical Document Embeddings):** Generate a hypothetical answer to the query, embed _that_, use it as the search vector. Often retrieves more relevant documents than embedding the question directly.

**Multi-query retrieval:** Generate 3-5 paraphrases of the query, retrieve for each, merge results. Improves recall.

**Agentic RAG:** Let the model decide _when_ to retrieve and _what_ to search for. Covered in the agents section.

---

## 🔧 3. Tool Use & Function Calling

### The core idea

Models are text in, text out. **Tool use** lets the model take actions — search the web, query a database, call an API, run code. The model decides _when_ to use a tool and _what arguments_ to pass.

### How function calling works

You define tools as JSON schemas in the API call:

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City name"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["location"]
        }
    }
]
```

The model's response may include a **tool call** instead of (or before) text:

```json
{
    "role": "assistant",
    "tool_calls": [{
        "name": "get_weather",
        "arguments": {"location": "Tokyo", "unit": "celsius"}
    }]
}
```

Your application executes the function, returns the result, and the model continues:

```python
# You execute the function
result = get_weather(location="Tokyo", unit="celsius")

# Return result to model
messages.append({"role": "tool", "content": str(result)})

# Model generates final response using tool result
response = client.chat(messages=messages, tools=tools)
```

### Tool design principles

**Write descriptions like documentation.** The model decides whether to call a tool based entirely on its description. Vague descriptions → wrong tool selection.

```
Bad:  "description": "Get data"
Good: "description": "Retrieve customer order history by customer ID.
                       Returns last 50 orders with status, amount, and date."
```

**Be explicit about when NOT to use a tool.** "Only call this when the user explicitly asks for real-time data — do not call for historical questions."

**Return structured, parseable results.** The model needs to extract information from tool results. JSON is better than prose.

**Handle errors gracefully.** Return error information in a structured way the model can reason about and potentially retry.

### Common tool categories

|Category|Examples|
|---|---|
|**Knowledge retrieval**|Web search, RAG search, database query|
|**Computation**|Code execution, calculator, data analysis|
|**External APIs**|Weather, maps, payment, CRM, calendar|
|**File operations**|Read/write files, parse documents|
|**Communication**|Send email, post message, create ticket|

---

## 🤖 4. Agents & Orchestration

### What is an agent?

An agent is a model in a **loop** — it reasons, takes actions, observes results, reasons again. Rather than one prompt → one response, agents execute multi-step workflows autonomously.

```
┌─────────────────────────────────┐
│           Agent Loop            │
│                                 │
│  Observe state                  │
│       ↓                         │
│  Reason (LLM call)              │
│       ↓                         │
│  Choose action                  │
│       ↓                         │
│  Execute action (tool call)     │
│       ↓                         │
│  Observe result → back to top   │
│                                 │
│  Until: task complete or limit  │
└─────────────────────────────────┘
```

### Agent architectures

**ReAct agents:** Alternate Thought → Action → Observation. The original and still widely used. Every step is a model call producing a thought and then a tool call.

**Plan-and-execute:** First generate a full plan (list of steps), then execute each step. Better for complex multi-step tasks. Less adaptive mid-execution.

**Reflection agents:** After executing, critique the result and decide whether to retry or revise. Improves reliability on hard tasks.

**Multi-agent:** Multiple specialized agents collaborate. An orchestrator agent routes subtasks to specialized subagents (researcher, coder, critic). Used in AutoGen, CrewAI.

### Orchestration frameworks

**LangChain:** The original. Extensive ecosystem, lots of integrations, sometimes over-engineered. Good for prototyping.

**LlamaIndex:** Focused on data — RAG pipelines, document processing, knowledge graphs. Strong for data-heavy applications.

**LangGraph:** Graph-based agent orchestration from the LangChain team. Define agent workflows as state machines with explicit edges. Better control and debuggability than chains.

**AutoGen (Microsoft):** Multi-agent conversation framework. Agents talk to each other to complete tasks. Strong for complex collaborative tasks.

**Custom:** For production, many teams abandon frameworks entirely after prototyping — too much abstraction, hard to debug, framework updates break things. Build a thin orchestration layer yourself.

### Agent failure modes

**Infinite loops:** Agent keeps retrying the same failing action. Fix: max iteration limits, loop detection.

**Context overflow:** Long agent runs accumulate tool results and history until context window fills. Fix: summarization of old steps, context pruning.

**Hallucinated tool calls:** Model invents arguments or calls tools that don't exist. Fix: strict tool schemas, output validation.

**Error propagation:** One bad tool result causes all downstream reasoning to fail. Fix: explicit error handling in prompts, retry logic.

**Reliability cliff:** Single LLM call = 95% success. 10 sequential calls = 0.95^10 = 60% success. Agents are fundamentally less reliable than single calls. Fix: human-in-the-loop checkpoints, smaller atomic steps.

---

## 🪟 5. Context Window Management

### The context window is your working memory

Everything the model knows about the current interaction lives in the context window. Inputs, outputs, tool results, retrieved documents, conversation history — all compete for limited space.

Current context windows: 128K (GPT-4o, Claude), 1M (Gemini 1.5 Pro). Sounds large — but fills fast in agentic applications.

### What eats context

```
System prompt:           500–2000 tokens
Conversation history:    grows unboundedly
Retrieved RAG chunks:    500–3000 tokens per retrieval
Tool results:            100–5000 tokens per call
Agent scratchpad:        grows with reasoning steps
```

A 10-turn conversation with RAG and tool use can easily hit 50K+ tokens.

### Management strategies

**Sliding window:** Keep only the last N turns of conversation history. Simple, loses early context.

**Summarization:** Periodically summarize old conversation turns into a compressed representation. Append summary + recent turns. Better retention but adds latency and a model call.

**Selective retention:** Not all turns are equal. Keep turns with tool results, decisions, or key facts. Drop small talk and filler.

**KV cache reuse:** If your system prompt is always the same, the provider's KV cache means you only pay the prefill cost once. Design your prompts to maximize the cacheable prefix.

**Prompt caching:** Anthropic and OpenAI offer explicit prompt caching — mark a prefix as cacheable, pay reduced cost on cache hits. Critical for cost optimization in high-volume applications.

---

## 📐 6. Structured Output & Constrained Generation

### The problem

LLMs output free text. Your application needs JSON, a specific schema, a yes/no answer. Parsing free text is fragile — the model might add prose before the JSON, forget a field, or use slightly wrong field names.

### JSON mode

Most APIs offer a JSON mode — the model is constrained to output valid JSON. Doesn't guarantee schema compliance, just valid syntax.

```python
response = client.chat(
    messages=messages,
    response_format={"type": "json_object"}
)
```

### Structured outputs (schema enforcement)

OpenAI and Anthropic support passing a JSON schema — the model's output is constrained to match it exactly. Uses constrained decoding under the hood (only tokens that continue a valid schema completion are allowed).

```python
from pydantic import BaseModel

class ReviewAnalysis(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    key_phrases: list[str]
    summary: str

response = client.beta.chat.completions.parse(
    messages=messages,
    response_format=ReviewAnalysis
)
result = response.choices[0].message.parsed  # typed Python object
```

### Constrained decoding internals

Under the hood, structured output works by maintaining a grammar state machine during token generation. At each step, only tokens that keep the output in a valid state are given non-zero probability. LMQL, Outlines, and Guidance are libraries that implement this for open models.

### When structured output matters most

- **Pipelines:** Output feeds into downstream code — must be parseable
- **Classification:** Constrain to a fixed label set — eliminates hallucinated labels
- **Extraction:** Pull specific fields from documents — schema ensures completeness
- **Tool arguments:** Function calling already uses this under the hood

---

## 🧠 7. Memory & State

LLMs are **stateless** — every API call is independent. But products need state: user preferences, past conversations, learned facts. Memory is how you fake statefulness on a stateless model.

### The four types of memory

**In-context memory:** Everything in the current context window. Perfect recall but limited capacity and ephemeral — gone when the context ends.

**External memory (RAG-style):** Store facts/conversations in a vector DB, retrieve relevant ones per turn. Scalable, persistent, but retrieval is imperfect — you might miss relevant memories.

**Summary memory:** Periodically summarize conversation/facts into a compressed representation stored externally. Retrieve and inject the summary into each new conversation. Loses detail but scales indefinitely.

**Parametric memory (fine-tuning):** Bake knowledge into model weights via fine-tuning. Permanent, fast (no retrieval), but expensive to update and can't be selectively forgotten.

### Practical memory architecture

For most products, a layered approach:

```
Working memory:     Current context window
                    (conversation history, current task state)

Episodic memory:    Recent conversations in vector DB
                    (retrieve top-K similar past interactions)

Semantic memory:    User facts/preferences in structured DB
                    (name, preferences, past decisions — retrieved by user ID)

Procedural memory:  System prompt
                    (how to behave — static, always in context)
```

### Memory for agents

Long-running agents need memory within a run and across runs:

**Within-run:** Maintain a scratchpad of discovered facts, completed steps, intermediate results. Include in context as a compressed state representation.

**Across-run:** Persist key outcomes and learnings to external storage. On next run, retrieve relevant past experience to avoid repeating work.

---

## 🏗️ How it all fits together — A production AI feature

Here's what a real production RAG + agent system looks like end-to-end:

```
User query
    ↓
Query analysis
  (classify intent, rewrite for retrieval, extract entities)
    ↓
Parallel retrieval
  (vector search + BM25 hybrid, multiple query variants)
    ↓
Reranking
  (cross-encoder, keep top 5 chunks)
    ↓
Context assembly
  (system prompt + memory + retrieved chunks + conversation history)
    ↓
Model call with tools available
    ↓
Tool execution loop (if needed)
  (search, calculate, query DB, call API)
    ↓
Final response generation
    ↓
Output validation
  (schema check, safety filter, hallucination detection)
    ↓
Response to user + update memory store
```

---

## 💡 Developer Relevance Callouts

**Prompt engineering is underrated.** Before reaching for fine-tuning or RAG, exhaust prompt engineering — it's the highest ROI, lowest cost lever. Most tasks can be solved or significantly improved with better prompts.

**RAG before fine-tuning.** If the problem is "model doesn't know X," RAG is almost always the right answer. Fine-tuning is for _behavior_, not _knowledge_.

**Evals before everything.** Before building any pipeline, build your eval set. You can't improve what you can't measure. 50 golden examples is enough to start.

**Frameworks are scaffolding.** LangChain/LlamaIndex are great for prototyping. In production, their abstractions often become obstacles. Know what they're doing under the hood so you can replace them with clean custom code when needed.

**Context window cost compounds.** In agentic applications, every extra token in your system prompt, every verbose tool result, every untruncated conversation history — it all multiplies by your request volume. Optimize prompts for token efficiency.

---

## Where We Are

```
✅ Stage 0 — Model Landscape
✅ Stage 1 — Data Layer
✅ Stage 2 — Pretraining
✅ Stage 3 — Post-Training
✅ Stage 4 — Inference & Serving
✅ Stage 5 — Application & Integration
        ↓
→ Stage 6 — MLOps & Observability  ← next
→ Stage 7 — AI Product Strategy
```

