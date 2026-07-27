export async function executeVocabularyImageSearch<TResponse extends { items: readonly unknown[] }>(input: {
  query: string;
  fallbackQuery?: string;
  allowFallback: boolean;
  search: (query: string) => Promise<TResponse>;
}): Promise<TResponse> {
  const first = await input.search(input.query);
  if (first.items.length > 0 || !input.allowFallback || !input.fallbackQuery ||
      input.fallbackQuery === input.query) return first;
  return input.search(input.fallbackQuery);
}
