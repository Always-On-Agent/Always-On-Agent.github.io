# Always-On Personal AI — Reading List

A curated reading-list snapshot accompanying the September 2026 working draft.

[Project website](https://always-on-agent.github.io/) · [Read the paper](assets/always-on-personal-ai.pdf)

This list is a starting point. See the paper for the full bibliography, evaluated configurations, and evidence judgments.

## Background and Surveys
+ [**Audio-Visual Intelligence in Large Foundation Models**](https://arxiv.org/abs/2605.04045)
  - *Broad survey style for organizing multimodal perception and benchmarks.*
+ [**AI for Auto-Research: Roadmap & User Guide**](https://arxiv.org/abs/2605.18661)
  - *Useful template for lifecycle-style organization and resource curation.*
+ [**Agentic World Modeling: Foundations, Capabilities, Laws, and Beyond**](https://arxiv.org/abs/2604.22748)
  - *Frames agents through prediction, simulation, and self-revision.*
+ [**A Survey on Proactive Dialogue Systems: Problems, Methods, and Prospects**](https://arxiv.org/abs/2305.02750) (IJCAI 2023)
  - *Core survey for proactive conversational agents and system-initiated interaction.*
+ [**A Survey on the Memory Mechanism of Large Language Model-based Agents**](https://arxiv.org/abs/2404.13501)
  - *Surveys memory design, evaluation, and applications for LLM agents.*
+ [**LLM Agent Memory: A Survey from a Unified Representation--Management Perspective**](https://openreview.net/forum?id=KPs1EgGKcT)
  - *Organizes memory systems around representation and lifecycle management.*
+ [**GUI Agents: A Survey**](https://aclanthology.org/2025.findings-acl.1158.pdf)
  - *Surveys agents that operate graphical interfaces across web, desktop, and mobile.*

## Stage 1: Sensing

+ [**Ego4D: Around the World in 3,000 Hours of Egocentric Video**](https://arxiv.org/abs/2110.07058) (CVPR 2022)
  - *Large-scale first-person video benchmark covering past memory, present understanding, and future prediction.*
+ [**Ego-Exo4D: Understanding Skilled Human Activity from First- and Third-Person Perspectives**](https://arxiv.org/abs/2311.18259)
  - *Multiview, multimodal dataset for skilled activity understanding and cross-view reasoning.*
+ [**TeleEgo: Benchmarking Egocentric AI Assistants in the Wild**](https://teleai-uagi.github.io/TeleEgo/)
  - *Evaluates real-time correctness and memory persistence for egocentric AI assistants.*
+ [**WearVox: An Egocentric Multichannel Voice Assistant Benchmark**](https://arxiv.org/abs/2601.02391)
  - *Targets voice interaction under wearable, egocentric audio conditions.*
+ [**EgoLife: Towards Egocentric Life Assistant**](https://arxiv.org/abs/2503.03803) (CVPR 2025)
  - *Frames first-person perception as a foundation for life-oriented AI assistance.*
+ [**Vinci: A Real-time Embodied Smart Assistant based on Egocentric Vision-Language Model**](https://arxiv.org/abs/2412.21080)
  - *Real-time portable assistant built around egocentric vision-language sensing.*
+ [**Proactive Assistant Dialogue Generation from Streaming Egocentric Videos**](https://arxiv.org/abs/2506.05904) (EMNLP 2025)
  - *Directly studies assistant responses generated from streaming egocentric video.*
+ [**ContextAgent: Context-Aware Proactive LLM Agents with Open-World Sensory Perceptions**](https://arxiv.org/abs/2505.14668)
  - *Uses broader sensory context to improve proactive LLM agent behavior.*
+ [**ProAgent: Harnessing On-Demand Sensory Contexts for Proactive LLM Agent Systems**](https://arxiv.org/abs/2512.06721)
  - *Studies on-demand sensory context acquisition for proactive agents.*

## Stage 2: Memory

+ [**Generative Agents: Interactive Simulacra of Human Behavior**](https://arxiv.org/abs/2304.03442) (UIST 2023)
  - *Classic memory-reflection-planning architecture for agents with persistent experience records.*
+ [**MemoryBank: Enhancing Large Language Models with Long-Term Memory**](https://arxiv.org/abs/2305.10250)
  - *Early LLM memory system for long-term companion interaction and user modeling.*
+ [**Augmenting Language Models with Long-Term Memory**](https://arxiv.org/abs/2306.07174)
  - *Memory-augmented language model design for storing and retrieving long histories.*
+ [**MemGPT: Towards LLMs as Operating Systems**](https://arxiv.org/abs/2310.08560)
  - *Introduces OS-inspired memory tiers and control flow for long-context agent operation.*
+ [**Memory Matters: The Need to Improve Long-Term Memory in LLM-Agents**](https://ojs.aaai.org/index.php/AAAI-SS/article/view/27688)
  - *Motivates long-term memory as a central missing component for autonomous agents.*
+ [**Position: Episodic Memory is the Missing Piece for Long-Term LLM Agents**](https://arxiv.org/abs/2502.06975)
  - *Argues for episodic memory properties as a foundation for long-horizon agents.*
+ [**How Memory Management Impacts LLM Agents: An Empirical Study of Experience-Following Behavior**](https://arxiv.org/abs/2505.16067)
  - *Studies how memory design choices affect long-term agent behavior.*
+ [**Agentic Memory: Learning Unified Long-Term and Short-Term Memory Management for Large Language Model Agents**](https://arxiv.org/abs/2601.01885)
  - *Treats memory operations as agent actions: store, retrieve, update, summarize, and discard.*
+ [**LoCoMo: Evaluating Very Long-Term Conversational Memory of LLM Agents**](https://arxiv.org/abs/2402.17753)
  - *Evaluates memory over long, multi-session, multimodal conversations.*
+ [**LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory**](https://arxiv.org/abs/2410.10813)
  - *Tests extraction, temporal reasoning, knowledge updates, and abstention across sessions.*
+ [**Memory OS of AI Agent**](https://arxiv.org/abs/2506.06326)
  - *OS-inspired architecture for personalized long-term agent memory.*
+ [**MIRIX: Multi-Agent Memory System for LLM-Based Agents**](https://arxiv.org/abs/2507.07957)
  - *Multi-type memory system spanning core, episodic, semantic, procedural, resource, and knowledge-vault memories.*
+ [**Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions**](https://arxiv.org/abs/2507.05257)
  - *Evaluates memory update and retrieval through incremental multi-turn interactions.*

## Stage 3: Action

+ [**A Survey on Proactive Dialogue Systems: Problems, Methods, and Prospects**](https://arxiv.org/abs/2305.02750) (IJCAI 2023)
  - *Baseline reference for dialogue systems that lead conversation toward system-side goals.*
+ [**Principles of Mixed-Initiative User Interfaces**](https://dl.acm.org/doi/10.1145/302979.303030) (CHI 1999)
  - *Classical foundation for deciding when a system should take initiative.*
+ [**Just-in-Time Adaptive Interventions in Mobile Health**](https://pmc.ncbi.nlm.nih.gov/articles/PMC5364076/) (Annals of Behavioral Medicine 2018)
  - *Formalizes timely adaptive support under changing user context.*
+ [**Large Language Models Know What To Say But Not When To Speak**](https://arxiv.org/abs/2410.16044) (EMNLP 2024)
  - *Highlights the timing gap between content generation and appropriate intervention.*
+ [**Reflexion: Language Agents with Verbal Reinforcement Learning**](https://arxiv.org/abs/2303.11366)
  - *Uses verbal feedback to update future behavior across trials.*
+ [**Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection**](https://arxiv.org/abs/2310.11511)
  - *Useful for thinking about when agents should retrieve evidence and critique outputs.*
+ [**ReAct: Synergizing Reasoning and Acting in Language Models**](https://arxiv.org/abs/2210.03629)
  - *Canonical reasoning-action interleaving pattern for LLM agents.*
+ [**WebArena: A Realistic Web Environment for Building Autonomous Agents**](https://arxiv.org/abs/2307.13854)
  - *Self-hosted web benchmark for realistic web task completion.*
+ [**OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments**](https://arxiv.org/abs/2404.07972)
  - *Evaluates agents on real computer tasks across operating systems and applications.*
+ [**Mind2Web: Towards a Generalist Agent for the Web**](https://arxiv.org/abs/2306.06070)
  - *Large-scale web navigation dataset for grounding user goals into website actions.*
+ [**AgentBench: Evaluating LLMs as Agents**](https://arxiv.org/abs/2308.03688)
  - *Early multi-environment benchmark for evaluating LLM agent capabilities.*
+ [**Voyager: An Open-Ended Embodied Agent with Large Language Models**](https://arxiv.org/abs/2305.16291)
  - *Demonstrates open-ended skill acquisition and persistent action knowledge in Minecraft.*

## Integrated Always-On Systems

+ [**Agentic World Modeling: Foundations, Capabilities, Laws, and Beyond**](https://arxiv.org/abs/2604.22748)
  - *Anchor reference for prediction and simulation as agent capabilities.*
+ [**VisionClaw: Always-On AI Agents through Smart Glasses**](https://arxiv.org/abs/2604.03486)
  - *Integrates live egocentric perception with agentic task execution on smart glasses.*
+ [**AI for Service: Proactive Assistance with AI Glasses**](https://arxiv.org/abs/2510.14359)
  - *Full-stack glasses assistant for proactive and real-time daily-life assistance.*
+ [**Memento: Towards Proactive Visualization of Everyday Memories with Personal Wearable AR Assistant**](https://arxiv.org/abs/2601.17622)
  - *Connects captured personal memory with context-triggered AR recall.*
+ [**LlamaPIE: Proactive In-Ear Conversation Assistants**](https://aclanthology.org/2025.findings-acl.710/) (ACL Findings 2025)
  - *In-ear assistant that decides when to provide discreet conversational guidance.*
+ [**Voyager: An Open-Ended Embodied Agent with Large Language Models**](https://arxiv.org/abs/2305.16291)
  - *Connects action, exploration, and accumulated skills over long horizons.*
+ [**Ego4D: Around the World in 3,000 Hours of Egocentric Video**](https://arxiv.org/abs/2110.07058)
  - *Includes future forecasting tasks that align with anticipation in always-on assistants.*

## Benchmarks and Datasets

+ [**Ego4D**](https://ego4d-data.org/)
  - *Daily-life first-person video benchmark suite.*
+ [**Ego-Exo4D**](https://ego-exo4d-data.org/)
  - *Paired first-person and third-person video for skilled human activities.*
+ [**TeleEgo**](https://teleai-uagi.github.io/TeleEgo/)
  - *Live-in-the-wild personal assistant benchmark.*
+ [**WebArena**](https://webarena.dev/)
  - *Realistic self-hosted web environments and tasks.*
+ [**OSWorld**](https://os-world.github.io/)
  - *Open-ended computer-use tasks with execution-based evaluation.*
+ [**Xperience-10M**](https://huggingface.co/datasets/ropedia-ai/xperience-10m)
  - *Large-scale robot experience dataset relevant to always-on perception-action systems.*

## Open-Source Systems and Infrastructure

+ [**Letta**](https://github.com/letta-ai/letta)
  - *Open-source agent framework evolved from MemGPT.*
+ [**mem0**](https://github.com/mem0ai/mem0)
  - *Practical memory layer for personalized AI applications.*
+ [**Zep**](https://github.com/getzep/zep)
  - *Long-term memory service for agent and chatbot applications.*
+ [**Graphiti**](https://github.com/getzep/graphiti)
  - *Temporal graph memory for dynamic agent state.*
+ [**OpenHands**](https://github.com/All-Hands-AI/OpenHands)
  - *Open-source agent platform for software engineering tasks.*

## Safety, Privacy, and Governance

+ [**Ego4D Privacy and Ethics**](https://ego4d-data.org/docs/privacy/)
  - *Reference point for privacy handling in large-scale first-person data collection.*
+ [**OSWorld**](https://os-world.github.io/)
  - *Illustrates controlled environments for evaluating computer-use agents.*
+ [**Awesome AI Auto-Research**](https://github.com/worldbench/awesome-ai-auto-research)
  - *Reference style for organizing a broad agentic research resource.*
+ [**Awesome Agentic World Modeling**](https://github.com/matrix-agent/awesome-agentic-world-modeling)
  - *Reference style for a taxonomy-driven awesome repository.*
