// Emit only fixed categories: database errors can contain SQL, bindings and credentials.
export function reportServerError(operation: "dish_detail" | "ranking" | "vote" | "isolation_init", requestId: string, error: unknown) {
  const categories = new Set<string>();
  for (let depth = 0; depth < 4 && error instanceof Error; depth++, error = error.cause) {
    const message = error.message;
    categories.add(/D1.*overloaded|Requests queued for too long/i.test(message) ? "d1_overloaded"
      : /SQLITE_BUSY|database is locked/i.test(message) ? "database_busy"
      : /D1.*reset|database.*reset/i.test(message) ? "database_reset"
      : /network connection lost|connection reset/i.test(message) ? "connection_lost"
      : /SQLITE_CONSTRAINT/i.test(message) ? "database_constraint"
      : /D1_ERROR/i.test(message) ? "d1_error" : "unclassified");
  }
  console.error(JSON.stringify({ event: "server_error", operation, requestId, categories: [...categories] }));
}
