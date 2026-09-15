# HALO channel review protocol — v2, 2026-09-12

HALO provides a common protocol for reviewing a paper's configured service,
functional mechanisms, and reported evidence. It can be applied by a reader or
a coding agent using the original paper, supplements, and available code. No
system-specific adapter or execution is required for a literature review.

## Review unit and source record

Review one named configuration. Record its service, observation and action
setting, personal-state lifetime, feedback source, and evaluated outcome
horizon. Pin the paper version, code commit when inspected, and source locations.
Keep vendor documentation, simulation, and empirical deployment identifiable.
Assess a contribution within its own scope before considering a broader service.
If backends differ in a channel mechanism, distinguish the configurations instead
of averaging their statuses. An artifact can provide a reported mechanism;
publication alone does not imply independent reproduction.

## Four mechanism statuses

The table shows four statuses, not four performance or evidence grades.

- **reported (filled circle):** the source describes an implemented dependency
  that reaches its functional endpoint and satisfies the relevant retention
  requirement. A separately measured causal benefit is not required.
- **partial (half-filled circle):** the source describes an implemented part of
  this dependency and explicitly identifies a necessary part left unfinished.
  Record both parts. A hypothetical example is decision-linked feedback that
  produces candidate memory revisions which the implementation only holds
  temporarily, without a durable commit. A generic record of an outcome alone
  is not a partial attribution-and-update mechanism.
- **absent (hollow circle):** the source explicitly excludes the dependency from
  this configuration, disables it, or identifies it as unimplemented future
  functionality. Cite the affirmative evidence for absence. A missing arrow in
  a diagram or an omitted paragraph is insufficient.
- **unreported (dashed circle):** the inspected material leaves the dependency
  unspecified or omits information needed to map it. Record the unresolved link.
  Use this status when the missing part is unknown, rather than explicitly absent.

Do not assign partial just because an experiment is short, simulated, lacks a
channel ablation, or reports a fused/delegated implementation. Do not infer a
missing mechanism from a narrow evaluation scope. For an explicitly implemented
partial route, use partial and identify its completed and unfinished endpoints;
for a wholly excluded route, use absent. Resolve conflicting source statements
against the named implementation; retain unresolved conflicts as unreported.

## Functional endpoints, in table order

1. **S→M:** sensed or explicitly supplied evidence enters retained personal state.
   The coupling admits a write; the local Memory operation commits it.
   User-directed writes qualify. A supplied benchmark profile alone does not
   demonstrate an online admission/write mechanism.
2. **M→A:** retained personal state is supplied to an action decision about silence,
   communication, preparation, or execution, including timing and content.
   Current authority constrains the decision. Consumption and marginal causal
   influence are separate evidence claims.
3. **A→S:** intended or executed action supplies an information need or observation
   target, including questions before commitment and checks afterward. A grader
   outside the acting system does not supply an in-system observation mechanism.
4. **M→S:** retained personal state guides acquisition, attention, or interpretation
   at a sensing endpoint. Answer-time retrieval alone identifies M→A instead.
5. **A→M:** external outcome evidence is associated with an earlier action decision
   and governs a durable personal-state or policy revision. Either update branch
   qualifies; both are not required. Outcome logging alone identifies S→M.
   Separately record association, use in revision, attribution warrant, and benefit.

The common Memory boundary is retained user-specific state across interactions.
An explicitly transient sensing buffer is not relabeled Memory. A short study
does not imply transient implementation; silence about retention is unreported.
Persistent state can support later interactions within a day: multi-day or
process-restart evaluation is not an automatic requirement for a reported route.
Seeded profiles may support an outgoing dependency if retained and reused in the
configuration; their presence does not establish the incoming S→M write.
Use the source's interaction boundary. A reset between tasks does not prove a
reset between every user exchange within a task. If the source leaves that
boundary unspecified, record the ambiguity; do not infer either durable Memory
or explicit absence merely from the word "session". Ordinary offline training
of a general model is separate from a configured personal service's A→M update.

## Direct, indirect, and fused realization

Identify the immediate receiving decision first. A retained identity used to
interpret a new observation is direct M→S. A memory-conditioned decision to ask
first supplies M→A; the question's information target then supplies A→S. If the
source explicitly links these decisions to an observation endpoint, report M→S
with an asterisk. The star marks realization through a documented combination
of existing channels. It adds neither a channel nor a mechanism-status category.
Record each linked decision and its source location. The separate presence of
M→A and A→S does not establish that one guides the other. Retain the shared scope
of the mechanism and comparison; do not count an additional independent effect.

In the current inventory, all starred cells use the recorded `indirect_via_A`
realization. Keep that specific route in the machine-readable ledger while
showing the general asterisk in the manuscript. Future starred cases require
the same source-to-endpoint reasoning, not an inferred path between positive cells.

A receipt or independent user correction may satisfy a service's information
need without implementing the dependency under review. Record what evidence it
provides and retain the source-supported channel status. Do not promote an absent
or unreported dependency to reported merely because the task succeeds. For S→M,
a delegated write can implement the ordinary admission-and-persistence function;
using a tool does not itself warrant a star. A pre-seeded profile is not evidence
of an online S→M write. Fused computation likewise qualifies when source,
receiving decision, and functional role are identifiable. A star concerns
mediation through another functional decision, not component layout.

## Evidence and synthesis

Record the evidence supporting each claim independently of circle status:
mechanism description, traced use, controlled effect on a decision or state,
and controlled service outcome. A study can supply several forms; these are not
cumulative grades. A controlled comparison can confirm its manipulation through
the design or records without publishing full run traces. Record the manipulated
unit, endpoint, setting, horizon, and reported uncertainty. Whole-module or
pipeline comparisons may affect several channels. Useful, adverse, and null
results retain the kind of evidence supplied by the comparison.

An effect of freezing an update does not demonstrate correct attribution of the
outcome that triggered it. Local capabilities, mechanism presence, empirical
effects, and service quality remain distinct conclusions. Proposed tests are
review outputs, not experiments performed by HALO.

Evidence-language clarification (2026-09-15): the manuscript uses these names
without E1–E4 codes. The 31 existing records retain their original schema and
source judgments; the legacy `evidence_levels` field contains a scope note,
not an assigned grade. Read `comparison_scope` and the source-linked summaries
for the reported comparisons. This clarification does not recode any channel.

## Audit record and reconciliation

For every cell record status, source/receiving endpoint, source location,
paraphrased rationale, realization (direct/indirect/fused/unspecified), retained
state scope, and unresolved ambiguity. Partial also requires completed and
unfinished parts; absent requires an explicit exclusion locator. Preserve the
original study's contribution and experimental scope in the row summary.

The v2 review divides the existing inventory among parallel coding-agent tasks
using this same guide. The coordinating reviewer reconciles boundary cases.
This is not independent duplicate coding of every cell and does not establish
inter-rater reliability. Independent human review can use the pinned sources and
decision records without rerunning the studied systems.
