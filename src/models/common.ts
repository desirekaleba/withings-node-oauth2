/**
 * Fields Withings adds to paginated response bodies. `more` is truthy when
 * another page exists; `offset` is the cursor to pass to the next request.
 */
export interface Paginated {
  more?: number | boolean;
  offset?: number;
}
