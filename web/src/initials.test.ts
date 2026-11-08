import { initials } from './initials';

describe('initials', () => {
  it('takes the first letters of the first and the last word', () => {
    expect(initials('Rudolph Renditier', 'rudolph')).toBe('RR');
    expect(initials('  anna maria  von der Heide ', 'anna')).toBe('AH');
  });

  it('takes one letter of a single word', () => {
    expect(initials('Cher', 'cher')).toBe('C');
  });

  it("falls back to the login name's first letter", () => {
    expect(initials(null, 'thies')).toBe('T');
    expect(initials(' ', 'thies')).toBe('T');
  });

  it('keeps a letter outside the BMP whole', () => {
    expect(initials('𝒜da Lovelace', 'ada')).toBe('𝒜L');
  });
});
