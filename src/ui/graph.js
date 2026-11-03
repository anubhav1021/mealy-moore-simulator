/**
 * graph.js — draws a machine as a state diagram with Cytoscape.js.
 *
 * Mealy: edges are labelled "input/output", e.g. "a/0".
 * Moore: states are labelled "q / λ", edges only carry the input symbol.
 * Parallel edges between the same two states are merged into one label: "a/0, b/1".
 */
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { MOORE, edgeKey } from '../core/model.js';

cytoscape.use(dagre);

const START_NODE = '__start__';

/** Reads a colour from the CSS variables in style.css, so graphs follow light/dark mode. */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildStyle() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': cssVar('--node-bg'),
        'border-color': cssVar('--node-border'),
        'border-width': 1.5,
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        color: cssVar('--text'),
        'font-size': 13,
        'font-family': 'system-ui, sans-serif',
        width: 58,
        height: 58,
      },
    },
    { selector: 'node.start', style: { 'border-width': 3 } },
    { selector: `node#${START_NODE}`, style: { width: 1, height: 1, opacity: 0, label: '' } },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'line-color': cssVar('--edge'),
        'target-arrow-color': cssVar('--edge'),
        width: 1.5,
        label: 'data(label)',
        'font-size': 12,
        color: cssVar('--text'),
        'text-background-color': cssVar('--panel'),
        'text-background-opacity': 1,
        'text-background-padding': 2,
        'control-point-step-size': 48,
      },
    },
    {
      selector: 'node.hl',
      style: { 'border-color': cssVar('--accent'), 'background-color': cssVar('--accent-soft'), 'border-width': 3 },
    },
    {
      selector: 'edge.hl',
      style: { 'line-color': cssVar('--accent'), 'target-arrow-color': cssVar('--accent'), width: 3 },
    },
    { selector: '.ghost', style: { opacity: 0.12 } },
  ];
}

const nodeLabel = (machine, q) => (machine.type === MOORE ? `${q}\nλ = ${machine.stateOutputs[q]}` : q);
const edgeLabel = (machine, t) => (machine.type === MOORE ? t.input : `${t.input}/${t.output}`);

/** Converts a machine into Cytoscape elements (nodes + grouped edges + start arrow). */
function buildElements(machine) {
  const nodes = machine.states.map((q) => ({
    data: { id: q, label: nodeLabel(machine, q) },
    classes: q === machine.start ? 'start' : '',
  }));

  const grouped = new Map(); // "from→to" → list of { key, label }
  for (const t of machine.transitions) {
    const id = `${t.from}→${t.to}`;
    if (!grouped.has(id)) grouped.set(id, { source: t.from, target: t.to, items: [] });
    grouped.get(id).items.push({ key: edgeKey(t.from, t.input), label: edgeLabel(machine, t) });
  }
  const edges = [...grouped.entries()].map(([id, g]) => ({
    data: { id, source: g.source, target: g.target, items: g.items, label: g.items.map((i) => i.label).join(', ') },
  }));

  const start = [
    { data: { id: START_NODE, label: '' } },
    { data: { id: '__start_edge__', source: START_NODE, target: machine.start, items: [], label: '' } },
  ];
  return [...nodes, ...start, ...edges];
}

/**
 * Small machines read best left-to-right (dagre). Larger ones become long and thin
 * that way, so they are placed on a circle (start state first) instead.
 */
function chooseLayout(machine) {
  if (machine.states.length <= 4) {
    return { name: 'dagre', rankDir: 'LR', nodeSep: 50, rankSep: 90, edgeSep: 24 };
  }
  const order = [machine.start, ...machine.states.filter((q) => q !== machine.start)];
  return {
    name: 'circle',
    radius: 40 + machine.states.length * 26,
    startAngle: Math.PI, // start state on the left
    sort: (a, b) => order.indexOf(a.id()) - order.indexOf(b.id()),
    avoidOverlap: true,
  };
}

export class MachineGraph {
  constructor(container) {
    this.container = container;
    this.cy = null;
    this.machine = null;
  }

  /** Draws a machine (replacing any previous drawing). */
  render(machine) {
    this.clear();
    this.machine = machine;
    this.cy = cytoscape({
      container: this.container,
      elements: buildElements(machine),
      style: buildStyle(),
      layout: { name: 'preset' },
      minZoom: 0.3,
      maxZoom: 2.5,
      wheelSensitivity: 0.3,
    });
    const layout = chooseLayout(machine);
    const marker = this.cy.getElementById(START_NODE);
    if (layout.name === 'dagre') {
      this.cy.layout(layout).run(); // dagre places the start arrow itself
    } else {
      this.cy.elements().difference(marker.union(marker.connectedEdges())).layout(layout).run();
      const s = this.cy.getElementById(machine.start).position();
      marker.position({ x: s.x - 80, y: s.y });
    }
    this.fit();
  }

  clear() {
    if (this.cy) this.cy.destroy();
    this.cy = null;
    this.machine = null;
  }

  /** Fits the drawing to its box, without blowing small machines up too far. */
  fit() {
    if (!this.cy) return;
    this.cy.resize();
    this.cy.fit(undefined, 28);
    if (this.cy.zoom() > 1.4) {
      this.cy.zoom(1.4);
      this.cy.center();
    }
  }

  /**
   * Shows only the part of the final machine that exists in `partial`
   * (the result as built so far); everything else is faded out.
   */
  showPartial(partial) {
    if (!this.cy) return;
    const states = new Set(partial ? partial.states : this.machine.states);
    const keys = new Set((partial ?? this.machine).transitions.map((t) => edgeKey(t.from, t.input)));
    const started = !partial || partial.start === this.machine.start;

    this.cy.nodes().forEach((n) => {
      if (n.id() === START_NODE) return;
      n.toggleClass('ghost', !states.has(n.id()));
    });
    this.cy.edges().forEach((e) => {
      if (e.id() === '__start_edge__') {
        e.toggleClass('ghost', !started);
        return;
      }
      const visible = e.data('items').filter((i) => keys.has(i.key));
      e.data('label', (visible.length ? visible : e.data('items')).map((i) => i.label).join(', '));
      e.toggleClass('ghost', visible.length === 0);
    });
  }

  /** Highlights the given state names and edge keys ("q|a"). */
  highlight({ states = [], edges = [] } = {}) {
    if (!this.cy) return;
    this.cy.elements().removeClass('hl');
    for (const s of states) this.cy.getElementById(s).addClass('hl');
    this.cy.edges().forEach((e) => {
      if ((e.data('items') ?? []).some((i) => edges.includes(i.key))) e.addClass('hl');
    });
  }
}
