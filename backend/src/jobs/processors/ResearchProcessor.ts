import { ResearchJobData, ResearchResults, ProcessedArticle } from '@/types';
import db from '@/utils/db';
import WikipediaClient from '@/services/external/WikipediaClient';
import NewsAPIClient from '@/services/external/NewsAPIClient';
import KeywordExtractor from '@/services/nlp/KeywordExtractor';
import SummaryGenerator from '@/services/nlp/SummaryGenerator';

export default class ResearchProcessor {
  private job: any;
  private externalClients: any[];
  private keywordExtractor: KeywordExtractor;
  private summaryGenerator: SummaryGenerator;

  constructor(job: any) {
    this.job = job;
    this.externalClients = [
      new WikipediaClient(),
      new NewsAPIClient(),
    ];
    this.keywordExtractor = new KeywordExtractor();
    this.summaryGenerator = new SummaryGenerator();
  }

  async execute(): Promise<ResearchResults> {
    const data = this.job.data as ResearchJobData;
    const startTime = Date.now();

    try {
      // Update status to processing
      await this.updateProgress(0, 'Starting research', 'INIT');

      // Step 1: Fetch articles from multiple sources
      await this.updateProgress(10, 'Fetching articles', 'FETCH');
      const articles = await this.fetchArticles(data.topic);

      // Step 2: Process and rank articles
      await this.updateProgress(40, 'Processing articles', 'PROCESS');
      const processedArticles = await this.processArticles(articles, data.topic);

      // Step 3: Extract keywords
      await this.updateProgress(70, 'Extracting keywords', 'KEYWORDS');
      const keywords = await this.keywordExtractor.extract(
        processedArticles.map(a => `${a.title} ${a.summary}`).join(' ')
      );

      // Step 4: Generate summary and insights
      await this.updateProgress(85, 'Generating summary', 'SUMMARY');
      const summary = await this.summaryGenerator.generateSummary(processedArticles);
      const keyInsights = await this.summaryGenerator.generateInsights(processedArticles);

      // Step 5: Save results
      await this.updateProgress(95, 'Saving results', 'SAVE');
      const results: ResearchResults = {
        summary,
        keyInsights,
        keywords,
        articles: processedArticles,
        totalArticles: processedArticles.length,
        processingTime: Date.now() - startTime,
        confidence: this.calculateConfidence(processedArticles),
      };

      await this.saveResults(data.id, results);
      await this.updateProgress(100, 'Research completed', 'COMPLETED');

      return results;
    } catch (error) {
      await this.handleError(data.id, error as Error);
      throw error;
    }
  }

  private async fetchArticles(topic: string): Promise<ProcessedArticle[]> {
    const allArticles: ProcessedArticle[] = [];
    
    for (const client of this.externalClients) {
      try {
        const articles = await client.search(topic);
        allArticles.push(...articles);
      } catch (error) {
        console.error(`Failed to fetch from ${client.constructor.name}:`, error);
      }
    }

    return allArticles;
  }

  private async processArticles(articles: ProcessedArticle[], topic: string): Promise<ProcessedArticle[]> {
    // Remove duplicates and rank by relevance
    const uniqueArticles = this.removeDuplicates(articles);
    const rankedArticles = this.rankByRelevance(uniqueArticles, topic);
    
    // Take top 20 articles
    return rankedArticles.slice(0, 20);
  }

  private removeDuplicates(articles: ProcessedArticle[]): ProcessedArticle[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const key = article.title.toLowerCase() + article.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private rankByRelevance(articles: ProcessedArticle[], topic: string): ProcessedArticle[] {
    const topicWords = topic.toLowerCase().split(' ');
    
    return articles
      .map(article => {
        let score = 0;
        const text = `${article.title} ${article.summary}`.toLowerCase();
        
        topicWords.forEach(word => {
          const occurrences = (text.match(new RegExp(word, 'g')) || []).length;
          score += occurrences * 2; // Weight title/summary matches highly
        });

        return { ...article, relevanceScore: score };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateConfidence(articles: ProcessedArticle[]): number {
    if (articles.length === 0) return 0;
    
    const avgRelevance = articles.reduce((sum, a) => sum + a.relevanceScore, 0) / articles.length;
    const sourceVariety = new Set(articles.map(a => a.source)).size;
    
    // Confidence based on relevance and source diversity
    return Math.min((avgRelevance / 10) * 0.7 + (sourceVariety / 3) * 0.3, 1.0);
  }

  private async updateProgress(progress: number, message: string, step: string): Promise<void> {
    const data = this.job.data as ResearchJobData;
    
    // Update job progress
    await this.job.progress(progress);
    
    // Log to database
    await db.taskLog.create({
      data: {
        researchRequestId: data.id,
        level: 'INFO',
        message,
        step,
        context: { progress },
      },
    });

    // Update request status
    await db.researchRequest.update({
      where: { id: data.id },
      data: { 
        progress,
        ...(progress === 100 && { 
          status: 'COMPLETED',
          completedAt: new Date()
        })
      },
    });
  }

  private async saveResults(requestId: string, results: ResearchResults): Promise<void> {
    await db.researchResult.create({
      data: {
        researchRequestId: requestId,
        summary: results.summary,
        keyInsights: results.keyInsights,
        keywords: results.keywords,
        totalArticles: results.totalArticles,
        processingTime: results.processingTime,
        confidence: results.confidence,
        sources: Array.from(new Set(results.articles.map(article => article.source))),
        articles: {
          create: results.articles.map(article => {
            const articleData: any = {
              title: article.title,
              url: article.url,
              summary: article.summary,
              content: article.content || '',
              source: article.source,
              relevanceScore: article.relevanceScore,
            };
            
            if (article.publishedAt) {
              articleData.publishedDate = article.publishedAt;
            }
            
            if (article.sentiment) {
              articleData.sentiment = article.sentiment;
            }
            
            if (article.wordCount) {
              articleData.wordCount = article.wordCount;
            }
            
            return articleData;
          }),
        },
      },
    });
  }

  private async handleError(requestId: string, error: Error): Promise<void> {
    await db.researchRequest.update({
      where: { id: requestId },
      data: {
        status: 'FAILED',
        error: error.message,
      },
    });

    await db.taskLog.create({
      data: {
        researchRequestId: requestId,
        level: 'ERROR',
        message: 'Research job failed',
        step: 'ERROR',
        context: { 
          error: error.message,
          stack: error.stack 
        },
      },
    });
  }
}
