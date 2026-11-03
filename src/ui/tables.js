/**
 * tables.js — draws a machine as a transition table.
 *
 * Mealy:  State | on a        | on b        ← each cell "next / output"
 * Moore:  State | Output λ | on a | on b   ← each cell "next"
 * The start state is marked with →.
 *
 * transitionTable() — read-only (optionally only the part built so far)
 * editableTable()   — the same table with drop-downs, for changing the machine
 */
import { MOORE, edgeKey } from '../core/model.js';

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c instanceof Node ? c : String(c));
  return node;
}

function headerRow(machine) {
  return el(
    'tr',
    {},
    el('th', {}, 'State'),
    ...(machine.type === MOORE ? [el('th', {}, 'Output λ')] : []),
    ...machine.inputAlphabet.map((a) => el('th', {}, `on ${a}`)),
  );
}

const note = (machine) =>
  el('p', { className: 'tt-note' }, machine.type === MOORE ? 'Each cell: next state. Output λ belongs to the state.' : 'Each cell: next state / output.');

/**
 * Read-only table.
 * @param {object} machine                 the machine to draw (final version)
 * @param {object} [options]
 * @param {object} [options.partial]       machine built so far (rows not yet created are hidden)
 * @param {string[]} [options.highlight]   states whose rows are highlighted
 */
export function transitionTable(machine, { partial = machine, highlight = [] } = {}) {
  const isMoore = machine.type === MOORE;
  const built = new Map(partial.transitions.map((t) => [edgeKey(t.from, t.input), t]));
  const width = 1 + (isMoore ? 1 : 0) + machine.inputAlphabet.length;

  const rows = partial.states.map((q) => {
    const cells = [el('th', { scope: 'row' }, q === partial.start ? `→ ${q}` : q)];
    if (isMoore) cells.push(el('td', {}, partial.stateOutputs?.[q] ?? ''));
    for (const a of machine.inputAlphabet) {
      const t = built.get(edgeKey(q, a));
      cells.push(el('td', {}, t ? (isMoore ? t.to : `${t.to} / ${t.output}`) : '…'));
    }
    return el('tr', { className: highlight.includes(q) ? 'hl' : '' }, ...cells);
  });
  if (rows.length === 0) {
    rows.push(el('tr', {}, el('td', { colSpan: width, className: 'empty' }, 'No states yet. The first steps only examine the given machine.')));
  }

  return el(
    'div',
    { className: 'tt-wrap' },
    el('table', { className: 'tt' }, el('thead', {}, headerRow(machine)), el('tbody', {}, ...rows)),
    note(machine),
  );
}

function select(options, value, label, onPick) {
  const s = el('select', {}, ...options.map((o) => el('option', { value: o }, o)));
  s.value = value;
  s.setAttribute('aria-label', label);
  s.addEventListener('change', () => onPick(s.value));
  return s;
}

/**
 * Editable table: every cell is a drop-down, so the machine is always complete and valid.
 * @param {object} machine                       the machine to edit (changed in place)
 * @param {(machine: object) => void} onChange   called after every change
 */
export function editableTable(machine, onChange) {
  const isMoore = machine.type === MOORE;
  const find = (q, a) => machine.transitions.find((t) => t.from === q && t.input === a);

  const rows = machine.states.map((q) => {
    const cells = [el('th', { scope: 'row' }, q === machine.start ? `→ ${q}` : q)];
    if (isMoore) {
      cells.push(
        el('td', {}, select(machine.outputAlphabet, machine.stateOutputs[q], `Output of ${q}`, (v) => {
          machine.stateOutputs[q] = v;
          onChange(machine);
        })),
      );
    }
    for (const a of machine.inputAlphabet) {
      const t = find(q, a);
      const td = el('td', {}, select(machine.states, t.to, `Next state from ${q} on ${a}`, (v) => {
        t.to = v;
        onChange(machine);
      }));
      if (!isMoore) {
        td.append(
          el('span', { className: 'slash' }, '/'),
          select(machine.outputAlphabet, t.output, `Output from ${q} on ${a}`, (v) => {
            t.output = v;
            onChange(machine);
          }),
        );
      }
      cells.push(td);
    }
    return el('tr', {}, ...cells);
  });

  return el(
    'div',
    { className: 'tt-wrap' },
    el('table', { className: 'tt editing' }, el('thead', {}, headerRow(machine)), el('tbody', {}, ...rows)),
    note(machine),
  );
}

/** Adds a state (q3, q4, …) whose transitions all loop back to itself. */
export function addState(machine) {
  let n = machine.states.length;
  while (machine.states.includes(`q${n}`)) n += 1;
  const q = `q${n}`;
  machine.states.push(q);
  for (const a of machine.inputAlphabet) {
    const t = { from: q, input: a, to: q };
    if (machine.type !== MOORE) t.output = machine.outputAlphabet[0];
    machine.transitions.push(t);
  }
  if (machine.type === MOORE) machine.stateOutputs[q] = machine.outputAlphabet[0];
}

/** Removes the last state; arrows that pointed to it now point to the start state. */
export function removeLastState(machine) {
  if (machine.states.length <= 1) return;
  const q = machine.states.pop();
  machine.transitions = machine.transitions.filter((t) => t.from !== q);
  for (const t of machine.transitions) if (t.to === q) t.to = machine.start;
  if (machine.stateOutputs) delete machine.stateOutputs[q];
}
