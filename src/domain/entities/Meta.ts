export interface Meta {
  migrations: {
    derivedDeck: boolean;
  };
}

export function defaultMeta(): Meta {
  return { migrations: { derivedDeck: false } };
}
