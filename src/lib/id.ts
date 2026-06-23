import { ulid } from 'ulidx';

/** Generates a new ULID (26-char, lexicographically sortable) for primary keys. */
export const newId = (): string => ulid();
