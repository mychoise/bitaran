/** A LIKE pattern matching `term` anywhere, with wildcards in it escaped. */
export function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
