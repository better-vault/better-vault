import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useRef } from "react";
import type { GraphEdge, GraphNode } from "@/lib/notes/graph";
import {
  builtInGraphStyles,
  radialLayout,
  resolveColour,
  type GraphStyle,
} from "@/lib/notes/graph-style";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Colour token names (CSS variables) for each vault id. */
  vaultColors: Record<string, string>;
  /** The open note, drawn with a ring. */
  focusId?: string | null;
  /** Nodes whose label matches the search are lit, the rest faded. */
  highlight?: string;
  onOpen: (node: GraphNode) => void;
  /** Changes whenever the view should be fitted again. */
  fitKey?: number;
  label: string;
  /** How the graph is laid out and drawn (Settings → Appearance, or a plugin's). */
  look?: GraphStyle;
}

/** Reads a colour token once per draw, so the graph follows light and dark mode. */
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || "currentColor";

const baseRadius = (node: GraphNode) =>
  (node.kind === "tag" ? 3 : 4) + Math.min(10, Math.sqrt(node.degree) * 2.2);

const FONTS = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  serif: "ui-serif, Georgia, serif",
} as const;

/** The node a radial graph grows from: the open note, else the most linked one. */
function radialHub(nodes: readonly GraphNode[], focusId: string | null | undefined) {
  const focus = focusId ? nodes.find((node) => node.id === `note:${focusId}`) : undefined;
  if (focus) return focus.id;
  let best: GraphNode | undefined;
  for (const node of nodes) if (!best || node.degree > best.degree) best = node;
  return best?.id;
}

/**
 * The graph drawn on a canvas with a force layout (d3-force), like
 * Obsidian's graph view: drag the background to pan, the wheel to zoom,
 * drag a node to move it; hovering lights a node and its neighbours.
 */
export function GraphCanvas({
  nodes,
  edges,
  vaultColors,
  focusId,
  highlight = "",
  onOpen,
  fitKey = 0,
  label,
  look = builtInGraphStyles.classic,
}: GraphCanvasProps) {
  const radius = (node: GraphNode) => baseRadius(node) * look.node.size;
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    view: { x: 0, y: 0, k: 1 },
    hover: null as SimNode | null,
    dragging: null as SimNode | null,
    panning: null as { x: number; y: number; vx: number; vy: number } | null,
    moved: false,
    sim: null as Simulation<SimNode, SimLink> | null,
    nodes: [] as SimNode[],
    links: [] as SimLink[],
    neighbours: new Map<string, Set<string>>(),
    hubId: null as string | null,
  });
  const props = useRef({ vaultColors, focusId, highlight, onOpen, look });

  // Draws one frame, reading the latest state and props through refs.
  const draw = useRef(() => {});
  const drawFrame = () => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    const { view, hover, nodes: simNodes, links, neighbours, hubId } = state.current;
    const { vaultColors: colors, focusId: focus, highlight: query, look: style } = props.current;
    const ratio = window.devicePixelRatio || 1;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (element.width !== width * ratio || element.height !== height * ratio) {
      element.width = width * ratio;
      element.height = height * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (style.background) {
      context.fillStyle = resolveColour(style.background, token);
      context.fillRect(0, 0, width, height);
    }
    context.translate(view.x, view.y);
    context.scale(view.k, view.k);

    const lit = hover ? new Set([hover.id, ...(neighbours.get(hover.id) ?? [])]) : null;
    const search = query.trim().toLowerCase();
    const matches = (node: SimNode) => !search || node.label.toLowerCase().includes(search);
    const border = token("border");
    const linkColour = resolveColour(style.link.color, token);
    const labelColour = resolveColour(style.label.color, token);
    const muted = token("muted-foreground");
    const primary = token("primary");
    const foreground = token("foreground");

    context.lineWidth = style.link.width / view.k;
    for (const link of links) {
      const a = link.source as SimNode;
      const b = link.target as SimNode;
      const on = lit && lit.has(a.id) && lit.has(b.id);
      context.strokeStyle = on ? primary : linkColour;
      context.globalAlpha = on ? 1 : (lit ? 0.25 : search ? 0.4 : 1) * style.link.opacity;
      const [ax, ay, bx, by] = [a.x ?? 0, a.y ?? 0, b.x ?? 0, b.y ?? 0];
      context.beginPath();
      context.moveTo(ax, ay);
      if (style.link.curved) {
        // A branch that leaves its parent outward and bends into the child.
        const hub = simNodes.find((node) => node.id === hubId);
        const [cx, cy] = [hub?.x ?? 0, hub?.y ?? 0];
        const rb = Math.hypot(bx - cx, by - cy);
        const ra = Math.hypot(ax - cx, ay - cy);
        const angle = Math.atan2(by - cy, bx - cx);
        const mid = (ra + rb) / 2;
        context.bezierCurveTo(
          ra < 1 ? cx + Math.cos(angle) * mid * 0.5 : ax + ((ax - cx) / ra) * (mid - ra),
          ra < 1 ? cy + Math.sin(angle) * mid * 0.5 : ay + ((ay - cy) / ra) * (mid - ra),
          cx + Math.cos(angle) * mid,
          cy + Math.sin(angle) * mid,
          bx,
          by,
        );
      } else {
        context.lineTo(bx, by);
      }
      context.stroke();
    }

    for (const node of simNodes) {
      const faded = (lit && !lit.has(node.id)) || !matches(node);
      context.globalAlpha = faded ? 0.2 : 1;
      const colour =
        node.kind === "tag"
          ? muted
          : node.kind === "missing"
            ? border
            : style.node.color === "vault"
              ? token(colors[node.vaultId ?? ""] ?? "chart-2")
              : resolveColour(style.node.color, token);
      context.fillStyle = colour;
      context.beginPath();
      const r = radius(node);
      if (node.kind === "notebook" || node.kind === "source") {
        context.roundRect((node.x ?? 0) - r, (node.y ?? 0) - r, r * 2, r * 2, r * 0.4);
      } else {
        context.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
      }
      context.fill();
      if (node.kind === "missing") {
        context.strokeStyle = muted;
        context.setLineDash([2 / view.k, 2 / view.k]);
        context.stroke();
        context.setLineDash([]);
      }
      if (style.node.hubRing && node.id === hubId) {
        // A soft halo and a thin ring around the hub.
        context.globalAlpha = faded ? 0.1 : 0.18;
        context.beginPath();
        context.arc(node.x ?? 0, node.y ?? 0, r * 2.6, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = faded ? 0.2 : 0.7;
        context.strokeStyle = colour;
        context.lineWidth = 1 / view.k;
        context.beginPath();
        context.arc(node.x ?? 0, node.y ?? 0, r * 3.6, 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = faded ? 0.2 : 1;
      }
      if (node.id === `note:${focus}` || node === hover) {
        context.strokeStyle = primary;
        context.lineWidth = 2 / view.k;
        context.beginPath();
        context.arc(node.x ?? 0, node.y ?? 0, r + 3 / view.k, 0, Math.PI * 2);
        context.stroke();
        context.lineWidth = 1 / view.k;
      }
    }

    // Labels: always near the pointer and the open note, the rest once zoomed in.
    const hub = simNodes.find((node) => node.id === hubId);
    const radial = style.layout === "radial";
    context.font = `${style.label.size / view.k}px ${FONTS[style.label.font]}`;
    for (const node of simNodes) {
      const near =
        (lit && lit.has(node.id)) || node.id === `note:${focus}` || (search && matches(node));
      if (!near && view.k < 0.9) continue;
      if (lit && !lit.has(node.id)) continue;
      context.globalAlpha = near ? 1 : Math.min(1, (view.k - 0.9) * 3 + 0.3);
      context.fillStyle =
        node.kind === "tag" || node.kind === "missing" ? muted : near ? foreground : labelColour;
      const text = style.label.uppercase ? node.label.toUpperCase() : node.label;
      const [x, y] = [node.x ?? 0, node.y ?? 0];
      if (radial && hub && node !== hub) {
        // Beside the node, pointing away from the hub.
        const angle = Math.atan2(y - (hub.y ?? 0), x - (hub.x ?? 0));
        const right = Math.cos(angle) >= 0;
        const gap = radius(node) + 5 / view.k;
        context.textAlign = right ? "left" : "right";
        context.textBaseline = "middle";
        context.fillText(text, x + Math.cos(angle) * gap, y + Math.sin(angle) * gap);
      } else {
        context.textAlign = "center";
        context.textBaseline = "top";
        const ring = style.node.hubRing && node.id === hubId ? 3.6 : 1;
        context.fillText(text, x, y + radius(node) * ring + 4 / view.k);
      }
    }
    context.globalAlpha = 1;
  };

  const fit = useRef(() => {});
  const fitView = () => {
    const element = canvas.current;
    const simNodes = state.current.nodes;
    if (!element || simNodes.length === 0) return;
    const xs = simNodes.map((node) => node.x ?? 0);
    const ys = simNodes.map((node) => node.y ?? 0);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const width = element.clientWidth;
    const height = element.clientHeight;
    const k = Math.min(
      2,
      Math.max(
        0.2,
        Math.min((width - 80) / (maxX - minX || 1), (height - 80) / (maxY - minY || 1)),
      ),
    );
    state.current.view = {
      k,
      x: width / 2 - ((minX + maxX) / 2) * k,
      y: height / 2 - ((minY + maxY) / 2) * k,
    };
    draw.current();
  };

  // The latest props and drawing functions, for the handlers and the simulation.
  useEffect(() => {
    props.current = { vaultColors, focusId, highlight, onOpen, look };
    draw.current = drawFrame;
    fit.current = fitView;
    draw.current();
  });

  // The simulation: rebuilt when the graph changes, keeping known positions.
  useEffect(() => {
    const previous = new Map(state.current.nodes.map((node) => [node.id, node]));
    const simNodes: SimNode[] = nodes.map((node) => {
      const old = previous.get(node.id);
      return { ...node, x: old?.x, y: old?.y, vx: old?.vx, vy: old?.vy };
    });
    const byId = new Map(simNodes.map((node) => [node.id, node]));
    const links: SimLink[] = edges
      .filter((edge) => byId.has(edge.source) && byId.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target }));
    const neighbours = new Map<string, Set<string>>();
    for (const edge of edges) {
      neighbours.set(edge.source, new Set([...(neighbours.get(edge.source) ?? []), edge.target]));
      neighbours.set(edge.target, new Set([...(neighbours.get(edge.target) ?? []), edge.source]));
    }
    state.current.sim?.stop();
    const radial = look.layout === "radial";
    const hubId = radial ? (radialHub(simNodes, focusId) ?? null) : null;
    let fresh = simNodes.some((node) => node.x === undefined);
    const sim = forceSimulation(simNodes);
    if (radial) {
      // Each node is pulled to its place in the radial tree; dragging still works.
      const places = radialLayout(simNodes, edges, hubId, 90 * look.node.size + 40);
      for (const node of simNodes) {
        const place = places.get(node.id);
        if (fresh || node.x === undefined) Object.assign(node, { x: place?.x, y: place?.y });
      }
      fresh = true;
      sim
        .force("x", forceX<SimNode>((node) => places.get(node.id)?.x ?? 0).strength(0.6))
        .force("y", forceY<SimNode>((node) => places.get(node.id)?.y ?? 0).strength(0.6))
        .force(
          "collide",
          forceCollide<SimNode>().radius((node) => radius(node) + 2),
        )
        .alpha(0.6);
    } else {
      sim
        .force(
          "link",
          forceLink<SimNode, SimLink>(links)
            .id((node) => node.id)
            .distance(60)
            .strength(0.6),
        )
        .force("charge", forceManyBody().strength(-160))
        .force("center", forceCenter(0, 0).strength(0.05))
        .force(
          "collide",
          forceCollide<SimNode>().radius((node) => radius(node) + 6),
        )
        .alpha(fresh ? 1 : 0.3);
    }
    if (radial)
      sim.force(
        "link-ids",
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .strength(0),
      );
    sim.on("tick", () => draw.current());
    let fitted = false;
    sim.on("end", () => {
      if (!fitted && fresh) fit.current();
      fitted = true;
    });
    Object.assign(state.current, {
      sim,
      nodes: simNodes,
      links,
      neighbours,
      hubId: hubId ?? radialHub(simNodes, focusId),
    });
    if (fresh) setTimeout(() => fit.current(), 450);
    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt on the layout, not every style tweak
  }, [nodes, edges, look.layout, look.node.size, look.layout === "radial" ? focusId : null]);

  useEffect(() => {
    fit.current();
  }, [fitKey]);

  // Redraw on resize and on theme changes (the tokens change on <html>).
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = new ResizeObserver(() => draw.current());
    resize.observe(element);
    const theme = new MutationObserver(() => draw.current());
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent", "style"],
    });
    return () => {
      resize.disconnect();
      theme.disconnect();
    };
  }, []);

  const toGraph = (clientX: number, clientY: number) => {
    const box = canvas.current!.getBoundingClientRect();
    const { view } = state.current;
    return { x: (clientX - box.left - view.x) / view.k, y: (clientY - box.top - view.y) / view.k };
  };
  const nodeAt = (clientX: number, clientY: number) => {
    const point = toGraph(clientX, clientY);
    let best: SimNode | null = null;
    let bestDistance = Infinity;
    for (const node of state.current.nodes) {
      const d = Math.hypot((node.x ?? 0) - point.x, (node.y ?? 0) - point.y);
      if (d < radius(node) + 6 / state.current.view.k && d < bestDistance) {
        best = node;
        bestDistance = d;
      }
    }
    return best;
  };

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      className="size-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const node = nodeAt(event.clientX, event.clientY);
        state.current.moved = false;
        if (node) {
          state.current.dragging = node;
          node.fx = node.x;
          node.fy = node.y;
          state.current.sim?.alphaTarget(0.2).restart();
        } else {
          const { view } = state.current;
          state.current.panning = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
        }
      }}
      onPointerMove={(event) => {
        const current = state.current;
        if (current.dragging) {
          const point = toGraph(event.clientX, event.clientY);
          current.dragging.fx = point.x;
          current.dragging.fy = point.y;
          current.moved = true;
          return;
        }
        if (current.panning) {
          current.view.x = current.panning.vx + event.clientX - current.panning.x;
          current.view.y = current.panning.vy + event.clientY - current.panning.y;
          current.moved = true;
          draw.current();
          return;
        }
        const hover = nodeAt(event.clientX, event.clientY);
        if (hover !== current.hover) {
          current.hover = hover;
          event.currentTarget.style.cursor = hover ? "pointer" : "";
          draw.current();
        }
      }}
      onPointerUp={() => {
        const current = state.current;
        if (current.dragging) {
          const node = current.dragging;
          node.fx = null;
          node.fy = null;
          current.sim?.alphaTarget(0);
          if (!current.moved) props.current.onOpen(node);
        }
        current.dragging = null;
        current.panning = null;
      }}
      onPointerLeave={() => {
        state.current.hover = null;
        draw.current();
      }}
      onWheel={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const { view } = state.current;
        const k = Math.min(4, Math.max(0.15, view.k * Math.exp(-event.deltaY * 0.0015)));
        const px = event.clientX - box.left;
        const py = event.clientY - box.top;
        state.current.view = {
          k,
          x: px - ((px - view.x) / view.k) * k,
          y: py - ((py - view.y) / view.k) * k,
        };
        draw.current();
      }}
    />
  );
}
