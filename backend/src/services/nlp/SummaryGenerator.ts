import { ProcessedArticle } from '@/types';
import config from '@/utils/config';

export default class SummaryGenerator {
  async generateSummary(articles: ProcessedArticle[]): Promise<string> {
    if (articles.length === 0) {
      return 'No articles found for analysis.';
    }

    try {
      // If OpenAI is configured, use it for better summaries
      if (config.externalApis.openai?.apiKey) {
        return await this.generateAISummary(articles);
      }

      // Fallback to extractive summary
      return this.generateExtractiveSummary(articles);
    } catch (error) {
      console.error('Summary generation failed:', error);
      return this.generateBasicSummary(articles);
    }
  }

  async generateInsights(articles: ProcessedArticle[]): Promise<string[]> {
    const insights: string[] = [];

    try {
      // Source diversity insight
      const sources = new Set(articles.map(a => a.source));
      insights.push(`Research covers ${sources.size} different sources including ${Array.from(sources).slice(0, 3).join(', ')}`);

      // Temporal insight
      const datedArticles = articles.filter(a => a.publishedAt);
      if (datedArticles.length > 0) {
        const dates = datedArticles.map(a => a.publishedAt!.getTime()).sort();
        const oldestDate = new Date(dates[0]);
        const newestDate = new Date(dates[dates.length - 1]);
        
        insights.push(`Content spans from ${oldestDate.toDateString()} to ${newestDate.toDateString()}`);
      }

      // Content volume insight
      const totalWords = articles.reduce((sum, a) => sum + a.wordCount, 0);
      insights.push(`Analysis includes ${totalWords.toLocaleString()} words across ${articles.length} sources`);

      // Relevance insight
      const avgRelevance = articles.reduce((sum, a) => sum + a.relevanceScore, 0) / articles.length;
      insights.push(`Average content relevance score: ${avgRelevance.toFixed(1)}/10`);

      return insights;
    } catch (error) {
      console.error('Insight generation failed:', error);
      return ['Unable to generate insights due to processing error'];
    }
  }

  private async generateAISummary(articles: ProcessedArticle[]): Promise<string> {
    // This would integrate with OpenAI API
    // For now, return extractive summary
    return this.generateExtractiveSummary(articles);
  }

  private generateExtractiveSummary(articles: ProcessedArticle[]): string {
    // Simple extractive summarization
    const sentences = articles
      .flatMap(article => 
        article.summary
          .split(/[.!?]+/)
          .filter(s => s.trim().length > 20)
          .map(s => s.trim())
      )
      .filter(Boolean);

    // Score sentences based on keyword frequency
    const wordFreq = this.calculateWordFrequency(sentences.join(' '));
    const scoredSentences = sentences.map(sentence => ({
      sentence,
      score: this.scoreSentence(sentence, wordFreq),
    }));

    // Select top sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.sentence);

    return topSentences.join('. ') + '.';
  }

  private generateBasicSummary(articles: ProcessedArticle[]): string {
    const topics = articles.map(a => a.title).slice(0, 5);
    return `Research compilation covering topics including: ${topics.join(', ')}. Analysis based on ${articles.length} sources from various providers.`;
  }

  private calculateWordFrequency(text: string): Map<string, number> {
    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const freq = new Map<string, number>();
    words.forEach(word => {
      freq.set(word, (freq.get(word) || 0) + 1);
    });

    return freq;
  }

  private scoreSentence(sentence: string, wordFreq: Map<string, number>): number {
    const words = sentence
      .toLowerCase()
      .replace(/[^a-zA-Z\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    let score = 0;
    words.forEach(word => {
      score += wordFreq.get(word) || 0;
    });

    return score / words.length; // Normalize by sentence length
  }
}
