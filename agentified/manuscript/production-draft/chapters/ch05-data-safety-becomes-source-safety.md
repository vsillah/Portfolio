## Chapter 5: Data Safety Becomes Source Safety

The receipts had held. That was the frustrating part.

Sam was reading the third paragraph of an agent-drafted client note when the mistake landed. The prose was clean. The tone was correct. A small footnote pointed at a policy PDF hosted on the client's own intranet. Sam clicked through out of habit. The document opened. The date at the top was old enough to make him stop. The policy had been superseded since then, and one of the revisions had moved the deadline.

The trace was perfect. The retrieval was accurate. The agent had done what it was asked to do. The answer was still wrong.

Sam sat with that for a moment. This was not a hallucination. No invented URL, no fabricated author, no imaginary statute. The agent had cited a real document that a real person had really written. The document was simply stale. Nothing in the pipeline had asked whether the source deserved to be quoted before the agent quoted it.

Sam wrote a line at the top of a fresh page. Retrieval is not trust.

In "A Critical Note on Data Safety" from "Accelerated," the discipline had been to classify data before prompting. That principle held up. Teams that tagged inputs before shipping them into a model made fewer expensive errors than teams that treated the model like a search bar. But the discipline was built for a world where the model answered and a human read the answer and decided what to do with it. In an agentic operating system, the model answered and another agent picked up the answer and used it to draft, route, quote, or remember. The distance between a source and a downstream action had collapsed. [A1]

The upgrade was not subtle. Classify data before prompting had to become classify sources before believing.

Sam pulled the week's retrieval logs. A busy stream of agent-initiated reads. A smaller set had produced content that made it into something a human or a client would eventually see. Only a few of those sources carried any provenance signal beyond a filename and a folder path. The system knew where the document lived. It did not know whether the document deserved to be quoted.

Source safety has to live inside the runtime, not inside a quarterly legal review. Every source an agent can touch needs a tier, and every tier needs rules that travel with it.

Sam sketched the ladder on the whiteboard.

**public_safe.** Content already published to the outside world, or explicitly cleared for external use. Agents may read, quote, remember, and repeat it into client-facing work without a gate. Marketing pages, published posts, approved case studies, public regulatory text.

**client_safe.** Content that belongs to a specific engagement. Agents may read and quote it inside the client's own workspace. They may not promote it into shared memory. They may not publish externally without an approval.

**internal_ops.** Content that describes how the team works: playbooks, retros, evaluation results, agent prompts, routing rules. Agents may read it and reason from it. They may not quote it verbatim into external work. They may not push it to a client-facing surface without a rewrite pass and a human check.

**private.** Content no agent should read without explicit human approval. Credentials, personal identifiers, unredacted incident notes, anything that would harm a person if it landed in the wrong context. The default agent identity does not see these sources exist.

The ladder was not meant to be exhaustive. It was meant to force a decision on every source before an agent could act on it. A document without a tier was a document the system refused to touch.

Sam walked the ladder through Portfolio's plumbing to test whether it held. Open Brain, the memory service, already carried privacy tiers on stored records. The ladder aligned cleanly. Every proposed memory write carried its source tier forward, so a `client_safe` retrieval could not silently be promoted into a `public_safe` projection. The propagation rule was simple. Memory inherits the strictest tier of anything it was derived from. A summary of a `client_safe` document is `client_safe`, even if the summary contains no client names.

The RAG layer had been running in shadow mode for two weeks. Shadow mode meant the retriever produced candidate passages and the agent produced a candidate answer, but the answer was compared against a human-reviewed baseline before anything was allowed to influence production behavior. Sam had set that up to catch retrieval quality problems. It turned out to be the right place to catch source safety problems too. The shadow log now flagged any retrieval where the source tier did not match the destination surface. A `client_safe` source retrieved for a `public_safe` publication was a shadow-mode failure, regardless of how good the answer read.

Pinecone writes were gated behind the same rule. The vector store held long-lived embeddings any future agent could hit. If a proposed write came from a source stricter than `public_safe`, the write went into an approval queue instead of the index. A human reviewed the tier assignment and the intended use. Nothing landed in shared retrieval memory without that gate. The Agent Inbox surfaced each approval next to the model-recommended tier and a plain-language reason.

Public-safe projections were the last piece. When a client engagement produced a pattern worth teaching from, the team could propose a projection: a rewritten, generalized version with the client context stripped out. The projection was a new document with its own tier, its own approval, and its own trace record pointing back at the original. The original stayed `client_safe`. The projection lived at `public_safe`. Agents downstream could quote the projection freely. They could not reach back through the trace to the original without an approval.

The discipline Sam wanted the team to internalize was simple. Provenance carries permissions: read, quote, remember, publish. Those permissions attach to the source at the moment it enters the system. If they are missing, the source is not usable. The agent is not being punished. The agent is being told the truth about what it is allowed to believe.

Try this with your own system.

List the top five sources your agents actually read from. Not the top five you wish they read from. The top five they hit in the last week of logs. For each source, write three rules. What the agent is allowed to read. What the agent is allowed to quote. What the agent is allowed to remember. If you cannot answer all three for a source, that source does not have a tier yet, and every downstream action based on it is running without a trust contract.

Then ask the harder question. If your agent had to cite every claim it made this week, and every citation had to survive a freshness check and a tier check, which claims would disappear?

The ones that disappear are the ones your operating system was quietly pretending to know.

Sam closed the notebook and wrote one line at the top of the retro doc.

Sources have tiers. Tiers travel. Agents may believe what the system has classified, and nothing else.
