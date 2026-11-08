// Code points rather than UTF-16 units, so that a letter outside the BMP stays
// whole.
const firstLetter = (word = '') => Array.from(word)[0] ?? '';

// "Rudolph Renditier" → "RR", "Cher" → "C"; without a full name, the login
// name's first letter.
export const initials = (fullName: string | null, name: string | null) => {
  const words = (fullName ?? '').split(/\s+/).filter(word => word !== '');
  if (words.length === 0) return firstLetter(name ?? '').toUpperCase();

  const last = words.length > 1 ? firstLetter(words.at(-1)) : '';
  return (firstLetter(words[0]) + last).toUpperCase();
};
