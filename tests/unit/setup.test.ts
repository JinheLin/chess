import { expect, test } from 'vitest';
import { Chess } from 'chess.js';
test('standard starting position has twenty legal moves', () => { expect(new Chess().moves()).toHaveLength(20); });
