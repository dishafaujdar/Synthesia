import axios, { AxiosInstance } from 'axios';
import { ExternalAPIClient, ProcessedArticle, WikipediaSearchResult } from '@/types';
import config from '@/utils/config';

export default class WikipediaClient implements ExternalAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.externalApis.wikipedia.baseUrl,
      timeout: config.apiTimeout,
      headers: {
        'User-Agent': 'AI-Research-Agent/1.0',
      },
    });
  }

  async search(query: string): Promise<ProcessedArticle[]> {
    try {
      // Search for articles
      const searchResponse = await this.client.get('/page/search', {
        params: {
          q: query,
          limit: 10,
        },
      });

      const articles: ProcessedArticle[] = [];

      // Get details for each article
      for (const item of searchResponse.data.pages || []) {
        try {
          const article = await this.fetchArticleDetails(item);
          if (article) {
            articles.push(article);
          }
        } catch (error) {
          console.error(`Failed to fetch Wikipedia article ${item.key}:`, error);
        }
      }

      return articles;
    } catch (error) {
      console.error('Wikipedia search failed:', error);
      return [];
    }
  }

  private async fetchArticleDetails(item: WikipediaSearchResult): Promise<ProcessedArticle | null> {
    try {
      // Get article summary
      const summaryResponse = await this.client.get(`/page/summary/${item.key}`);
      const summary = summaryResponse.data;

      // Get full content (optional)
      let content = '';
      try {
        const contentResponse = await this.client.get(`/page/mobile-sections/${item.key}`);
        content = this.extractTextFromSections(contentResponse.data.sections);
      } catch (error) {
        // Content extraction is optional
      }

      return {
        title: summary.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.key)}`,
        summary: summary.extract || item.excerpt,
        content: content.substring(0, 5000), // Limit content length
        source: 'Wikipedia',
        relevanceScore: 0, // Will be calculated later
        wordCount: content.split(' ').length,
      };
    } catch (error) {
      return null;
    }
  }

  private extractTextFromSections(sections: any[]): string {
    return sections
      .filter(section => section.text)
      .map(section => section.text)
      .join(' ')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/page/search', {
        params: { q: 'test', limit: 1 },
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
