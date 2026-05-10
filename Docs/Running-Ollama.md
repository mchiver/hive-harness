# Running Ollama


Ollama is a self-hosted LLM runner. Unlike cloud providers (Anthropic,
OpenAI), a single Ollama process shares one model instance across all
concurrent requests, which introduces caveats that do not exist with
hosted APIs.


## Parallel Requests and Context Division

Ollama serves concurrent requests from a fixed pool of **slots**
controlled by the `OLLAMA_NUM_PARALLEL` environment variable (default `4`
on recent versions).

The model's context window is divided across **active** slots. For a
model loaded with `num_ctx: 131072`:

| Active slots | Effective context per request |
|--------------|-------------------------------|
| 1            | 131,072 tokens                |
| 2            |  65,536 tokens                |
| 4            |  32,768 tokens                |

When a request's prompt exceeds the per-slot context, Ollama rejects it
synchronously with:

```
Ollama error: prompt too long; exceeded max context length by N tokens
```

This is why a prompt that fits in serial mode can overflow under
parallel load. The slot count changes dynamically based on in-flight
requests, so failures are intermittent.

**Mitigations:**

- Set `OLLAMA_NUM_PARALLEL=1` in the Ollama process's environment to
  force serialization. Requests queue, each getting the full context.
- Lower `ContextSize` in entity config to a value that still fits when
  divided by `OLLAMA_NUM_PARALLEL`.
- Run live-LLM test suites serially even when the rest of the suite
  runs in parallel.


## Model-Capped Context

`num_ctx` requests larger than the model's trained context are silently
capped at the model's actual maximum. Setting `ContextSize: 131072` on a
model trained for 8k does not give you 131k — it gives you 8k.


## Memory Pressure

Each loaded model consumes GPU/VRAM (or system RAM in CPU mode).
Running multiple models concurrently, or a single model with a very
large `num_ctx`, can exhaust available memory and force Ollama to
offload layers to CPU — slowing inference substantially.


## Health Check Latency

When the Ollama process is busy with inference, even the HTTP health
endpoint (`GET /`) can block. The `Llm.Ollama` adapter's health
timeout is 30 seconds. If you see health check failures under load,
either the server is overloaded or the model is mid-load.


## Contrast with Hosted Providers

Anthropic and OpenAI run massive horizontally-scaled fleets:

- Each request gets the model's full stated context (e.g. 200k for
  Claude, 128k for GPT-4o), independent of concurrency.
- Parallel requests do not cannibalize each other's context.
- Overload surfaces as HTTP 429 rate-limit responses, not context
  overflow errors.

If the live-LLM test flakiness under parallel load is a concern, using
a hosted provider eliminates the class of failure entirely — at the
cost of API fees and network dependency.
