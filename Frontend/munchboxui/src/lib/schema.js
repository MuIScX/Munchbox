// A simple key-value pair schema
export const CATEGORY_MAP = {
  1: 'Vegetable',
  2: 'Meat',
  3: 'Grain',
  4: 'Dairy',
  5: 'Spice',
  6: 'Fruit',
  7: 'Seafood',
  8: 'Beverage',
  9: 'Other'
};

// Optional: If you need to map it back from String to ID (for creating new ingredients)
export const CATEGORY_REVERSE_MAP = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([id, name]) => [name, Number(id)])
);