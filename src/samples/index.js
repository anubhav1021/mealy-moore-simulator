/**
 * Built-in example machines, grouped by conversion direction.
 * Each one matches a test case in the project guide (T-numbers).
 */
import lastTwoEqual from './last-two-equal.mealy.json';
import startSplit from './start-split.mealy.json';
import worstCase from './worst-case.mealy.json';
import invalidMissing from './invalid-missing.mealy.json';
import mod3 from './mod3.moore.json';
import parity from './parity.moore.json';

export const SAMPLES = [
  // Mealy → Moore
  { id: 'last-two-equal', label: 'Last two symbols equal (3 → 5 states)', machine: lastTwoEqual, testString: 'abba' },
  { id: 'start-split', label: 'Start state must split', machine: startSplit, testString: 'abab' },
  { id: 'worst-case', label: 'Worst case (3 → 9 states)', machine: worstCase, testString: 'abc' },
  { id: 'invalid-missing', label: 'Invalid: missing transition', machine: invalidMissing, testString: 'ab' },
  // Moore → Mealy
  { id: 'mod3', label: 'Binary number mod 3', machine: mod3, testString: '110' },
  { id: 'parity', label: 'Parity of 1s (even/odd)', machine: parity, testString: '1101' },
];

/** Examples whose input machine has the given type ("mealy" or "moore"). */
export const samplesFor = (type) => SAMPLES.filter((s) => s.machine.type === type);
