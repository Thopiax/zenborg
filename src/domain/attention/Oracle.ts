export interface OracleResponse<T> {
  readonly window: { from: string; to: string };
  readonly coverage: { first?: string; last?: string; records: number };
  readonly data: T;
}

export type OracleAdapter<T> = (
  vaultRoot: string,
  from: number,
  to: number,
) => OracleResponse<T>;
