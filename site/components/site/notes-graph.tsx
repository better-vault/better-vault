/**
 * The landing page's picture of linked notes: notes as nodes in two vaults,
 * [[links]] as lines, drawn in SVG with the theme's chart colours. The
 * nodes breathe gently unless the reader prefers reduced motion.
 */
const nodes = [
  { id: "a", x: 160, y: 120, r: 16, label: "Research plan", vault: 2 },
  { id: "b", x: 300, y: 70, r: 10, label: "Sources", vault: 2 },
  { id: "c", x: 330, y: 190, r: 13, label: "Literature review", vault: 2 },
  { id: "d", x: 90, y: 230, r: 9, label: "Daily note", vault: 2 },
  { id: "e", x: 470, y: 120, r: 14, label: "Lecture 4", vault: 3 },
  { id: "f", x: 560, y: 220, r: 10, label: "Exam prep", vault: 3 },
  { id: "g", x: 600, y: 80, r: 8, label: "Flashcards", vault: 3 },
  { id: "h", x: 230, y: 290, r: 8, label: "#idea", vault: 0 },
  { id: "i", x: 430, y: 290, r: 9, label: "Glossary", vault: 3 },
];
const links: [string, string][] = [
  ["a", "b"],
  ["a", "c"],
  ["a", "d"],
  ["c", "e"],
  ["e", "f"],
  ["e", "g"],
  ["c", "h"],
  ["d", "h"],
  ["f", "i"],
  ["c", "i"],
];
const fill = ["var(--muted-foreground)", "", "var(--chart-2)", "var(--chart-5)"];

export function NotesGraph() {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (
    <svg
      viewBox="0 0 680 340"
      role="img"
      aria-label="Notes linked across two vaults, drawn as a graph"
      className="h-auto w-full"
    >
      <style>{`@media (prefers-reduced-motion: no-preference){.bv-node{animation:bv-breathe 5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}}@keyframes bv-breathe{50%{transform:scale(1.12)}}`}</style>
      {links.map(([from, to]) => {
        const a = byId.get(from)!;
        const b = byId.get(to)!;
        const across = a.vault !== b.vault && a.vault !== 0 && b.vault !== 0;
        return (
          <line
            key={`${from}${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={across ? "var(--primary)" : "var(--border)"}
            strokeWidth={across ? 2 : 1.5}
            strokeDasharray={across ? "5 4" : undefined}
          />
        );
      })}
      {nodes.map((node, index) => (
        <g key={node.id}>
          <circle
            className="bv-node"
            style={{ animationDelay: `${index * 0.4}s` }}
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill={fill[node.vault]}
            stroke="var(--background)"
            strokeWidth={3}
          />
          <text
            x={node.x}
            y={node.y + node.r + 16}
            textAnchor="middle"
            className="fill-muted-foreground text-[12px]"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
