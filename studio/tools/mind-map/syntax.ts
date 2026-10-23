import type { DiagramKind } from "./definition";

interface Syntax {
  /** The first word the Mermaid source must start with. */
  header: RegExp;
  /** What the diagram is for, told to the model. */
  purpose: string;
  /** A small, valid example. */
  example: string;
}

/** Mermaid syntax for each kind of diagram, checked against Pele. */
export const diagramSyntax: Record<DiagramKind, Syntax> = {
  mindmap: {
    header: /^mindmap\b/,
    purpose: "a mind map: the central topic, its main branches and their sub-ideas",
    example: `mindmap
  root((Entrepreneurship))
    Opportunity
      Ideas
      Market needs
    Risk
      Capital
      Uncertainty`,
  },
  flowchart: {
    header: /^(flowchart|graph)\b/,
    purpose: "a flowchart of a process, its steps and decisions",
    example: `flowchart TD
  A[Find an idea] --> B{Is there demand?}
  B -->|Yes| C[Write a business plan]
  B -->|No| A
  C --> D[Launch]`,
  },
  timeline: {
    header: /^timeline\b/,
    purpose: "a timeline of events in order",
    example: `timeline
  title History of the venture
  2019 : Idea
  2020 : First prototype : First customers
  2022 : Expansion`,
  },
  sequence: {
    header: /^sequenceDiagram\b/,
    purpose: "a sequence diagram of who does what, in order",
    example: `sequenceDiagram
  participant F as Founder
  participant I as Investor
  F->>I: Pitch the idea
  I-->>F: Ask for a plan
  F->>I: Send the business plan`,
  },
  state: {
    header: /^stateDiagram(-v2)?\b/,
    purpose: "a state diagram of stages and what moves between them",
    example: `stateDiagram-v2
  [*] --> Idea
  Idea --> Validated : customer tests
  Validated --> Launched : funding
  Launched --> [*]`,
  },
  class: {
    header: /^classDiagram\b/,
    purpose: "a class diagram of concepts, their attributes and relationships",
    example: `classDiagram
  class Venture {
    +capital
    +team
    +launch()
  }
  class Startup
  Venture <|-- Startup`,
  },
  er: {
    header: /^erDiagram\b/,
    purpose: "an entity-relationship diagram of things and how they relate",
    example: `erDiagram
  FOUNDER ||--o{ VENTURE : starts
  VENTURE ||--|{ PRODUCT : sells
  CUSTOMER }o--o{ PRODUCT : buys`,
  },
  quadrant: {
    header: /^quadrantChart\b/,
    purpose: "a quadrant chart placing items on two axes",
    example: `quadrantChart
  title Ideas by effort and impact
  x-axis Low effort --> High effort
  y-axis Low impact --> High impact
  quadrant-1 Big bets
  quadrant-2 Quick wins
  quadrant-3 Fill-ins
  quadrant-4 Money pits
  Online shop: [0.3, 0.7]
  New factory: [0.9, 0.6]`,
  },
  journey: {
    header: /^journey\b/,
    purpose: "a user journey: sections, tasks and how each felt (score 1 to 5)",
    example: `journey
  title Launching a venture
  section Prepare
    Find an idea: 5: Founder
    Write a plan: 3: Founder
  section Launch
    First sale: 4: Founder, Customer`,
  },
  ishikawa: {
    header: /^ishikawa(-beta)?\b/,
    purpose: "a cause-and-effect (fishbone) diagram: the problem, categories of causes, and the causes",
    example: `ishikawa
  Venture failure
    People
      Small team
      No experience
    Money
      Too little capital
    Market
      No demand`,
  },
  kanban: {
    header: /^kanban\b/,
    purpose: "a kanban board of tasks in columns",
    example: `kanban
  todo[To do]
    t1[Market research]
    t2[Find a mentor]
  doing[In progress]
    t3[Business plan]
  done[Done]
    t4[Pick an idea]`,
  },
  gantt: {
    header: /^gantt\b/,
    purpose: "a Gantt chart of tasks over time",
    example: `gantt
  title Launch plan
  dateFormat YYYY-MM-DD
  section Research
    Market study :a1, 2025-01-06, 14d
    Interviews :after a1, 10d
  section Build
    Prototype :2025-02-03, 21d`,
  },
};

export const DETAIL = {
  concise: "Keep it small: about 8 to 12 nodes or items.",
  standard: "Aim for about 15 to 30 nodes or items.",
  detailed: "Be thorough: about 30 to 60 nodes or items.",
} as const;
