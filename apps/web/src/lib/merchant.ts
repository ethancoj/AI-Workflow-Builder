// Stand-in for the logged-in merchant until auth is added.
// Every merchant-scoped read/write goes through this constant so it can be swapped in one place.
export const PLACEHOLDER_MERCHANT_ID = '00000000-0000-0000-0000-000000000000'
