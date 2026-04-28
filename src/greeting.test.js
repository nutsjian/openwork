const { getGreeting, getFormalGreeting } = require('./greeting');

describe('getGreeting', () => {
  test('should return a morning greeting', () => {
    const date = new Date('2026-01-01T08:00:00');
    expect(getGreeting('Alice', date)).toBe('Good morning, Alice!');
  });

  test('should return an afternoon greeting', () => {
    const date = new Date('2026-01-01T14:00:00');
    expect(getGreeting('Bob', date)).toBe('Good afternoon, Bob!');
  });

  test('should return an evening greeting', () => {
    const date = new Date('2026-01-01T18:00:00');
    expect(getGreeting('Charlie', date)).toBe('Good evening, Charlie!');
  });

  test('should return a night greeting', () => {
    const date = new Date('2026-01-01T23:00:00');
    expect(getGreeting('Diana', date)).toBe('Good night, Diana!');
  });

  test('should throw error for empty name', () => {
    expect(() => getGreeting('')).toThrow('A valid name string is required');
  });

  test('should throw error for non-string name', () => {
    expect(() => getGreeting(123)).toThrow('A valid name string is required');
  });

  test('should use current date when not provided', () => {
    const result = getGreeting('Test');
    expect(result).toMatch(/Good (morning|afternoon|evening|night), Test!/);
  });
});

describe('getFormalGreeting', () => {
  test('should include title in greeting', () => {
    const date = new Date('2026-01-01T10:00:00');
    expect(getFormalGreeting('Smith', { title: 'Dr.', date })).toContain('Dr. Smith');
  });

  test('should work without title', () => {
    const date = new Date('2026-01-01T10:00:00');
    expect(getFormalGreeting('Smith', { date })).toBe('Good morning, Smith!');
  });

  test('should throw error for empty name', () => {
    expect(() => getFormalGreeting('')).toThrow('A valid name string is required');
  });
});
