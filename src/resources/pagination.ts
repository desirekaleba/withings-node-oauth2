import type { Paginated } from "../models/common.js";

/** Loads one page given the previous page's cursor (`undefined` for the first). */
export type PageLoader<Body extends Paginated> = (
  offset: number | undefined,
) => Promise<Body>;

/** Extracts the array of items from a page body. */
export type ItemSelector<Body, Item> = (body: Body) => Item[];

/**
 * Lazily iterate every item across all pages, transparently following
 * Withings' `more` / `offset` cursor. Stops when `more` is falsy.
 *
 * @example
 * ```ts
 * for await (const grp of client.measures.paginate({ types: [1] })) {
 *   console.log(grp.date);
 * }
 * ```
 */
export async function* paginate<Body extends Paginated, Item>(
  load: PageLoader<Body>,
  select: ItemSelector<Body, Item>,
): AsyncGenerator<Item, void, void> {
  let offset: number | undefined;
  // Guard against a server that keeps returning the same cursor.
  const seen = new Set<number>();
  for (;;) {
    const body = await load(offset);
    for (const item of select(body)) yield item;
    if (!body.more || body.offset === undefined) return;
    if (seen.has(body.offset)) return;
    seen.add(body.offset);
    offset = body.offset;
  }
}
