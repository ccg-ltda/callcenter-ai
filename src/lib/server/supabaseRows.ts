import 'server-only';

export function camelizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
    value,
  ]));
}

export function camelizeRows(rows: Record<string, unknown>[] | null) {
  return (rows || []).map(camelizeRow);
}
