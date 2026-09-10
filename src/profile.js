export const GENDERS = Object.freeze([
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'nonbinary', label: 'Non-binary' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say' },
].map(Object.freeze));

export function normalizeGender(value) {
  return GENDERS.some(gender => gender.id === value) ? value : null;
}
