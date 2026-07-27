import type { VocabularyTopicSuggestionItem } from "@teacher/shared";

export class TopicSuggestionRequestSequence {
  private current = 0;

  async run(
    request: () => Promise<{ items: VocabularyTopicSuggestionItem[] }>,
  ): Promise<VocabularyTopicSuggestionItem[] | null> {
    const sequence = ++this.current;
    try {
      const result = await request();
      return sequence === this.current ? result.items : null;
    } catch (error) {
      if (sequence !== this.current) return null;
      throw error;
    }
  }
}
