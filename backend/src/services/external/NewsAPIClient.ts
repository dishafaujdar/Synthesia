import axios, { AxiosInstance } from 'axios';
import { ExternalAPIClient, ProcessedArticle, NewsAPIArticle } from '@/types';
import config from '@/utils/config';

export default class NewsAPIClient implements ExternalAPIClient {
  private client: AxiosInstance;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = config.externalApis.newsApi?.apiKey;
    this.client = axios.create({
      baseURL: 'https://newsapi.org/v2',
      timeout: config.apiTimeout,
      headers: {
        'User-Agent': 'AI-Research-Agent/1.0',
      },
    });
  }

  async search(query: string): Promise<ProcessedArticle[]> {
    if (!this.apiKey) {
      console.warn('NewsAPI key not configured, skipping NewsAPI search');
      return [];
    }

    try {
      const response = await this.client.get('/everything', {
        params: {
          q: query,
          apiKey: this.apiKey,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: 20,
        },
      });

      const articles: ProcessedArticle[] = response.data.articles
        .filter((article: NewsAPIArticle) => 
          article.title && 
          article.url && 
          article.description &&
          !article.title.includes('[Removed]')
        )
        .map((article: NewsAPIArticle) => ({
          title: article.title,
          url: article.url,
          summary: article.description || '',
          content: article.content?.substring(0, 5000),
          publishedAt: new Date(article.publishedAt),
          source: article.source.name,
          relevanceScore: 0,
          wordCount: (article.content || '').split(' ').length,
        }));

      return articles;
    } catch (error) {
      console.error('NewsAPI search failed:', error);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await this.client.get('/top-headlines', {
        params: {
          apiKey: this.apiKey,
          country: 'us',
          pageSize: 1,
        },
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
