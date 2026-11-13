import { describe, expect, it } from 'vitest';
import { classInEvent } from '../src/lib/format';

describe('classInEvent', () => {
  const event = 'Step In Varberg Padelklubb / Flickor och pojkar 12, 14 & 16';
  it('drops the level the event name already says', () => {
    expect(classInEvent('Pojkar 12 Step In', event)).toBe('Pojkar 12');
    expect(classInEvent('Step In Flickor 14', event)).toBe('Flickor 14');
  });
  it('keeps the class name when the event does not say the level', () => {
    expect(classInEvent('Pojkar 12 Step In', 'Varberg Open')).toBe('Pojkar 12 Step In');
    expect(classInEvent('Pojkar 16 Level Up', event)).toBe('Pojkar 16 Level Up');
  });
  it('never returns an empty name', () => {
    expect(classInEvent('Step In', event)).toBe('Step In');
  });
});
