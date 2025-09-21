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

    console.log(`🚀 Starting research job ${this.job.id} for topic: "${data.topic}"`);

    try {
      // Update status to in progress first
      await this.updateRequestStatus(data.id, 'IN_PROGRESS');
      
      // Update status to processing
      await this.updateProgress(0, 'Starting research', 'INIT');
      console.log(`✅ Updated progress to 0% for job ${this.job.id}`);

      // Step 1: Fetch articles from multiple sources
      await this.updateProgress(10, 'Fetching articles', 'FETCH');
      console.log(`🔍 Fetching articles for topic: "${data.topic}"`);
      const articles = await this.fetchArticles(data.topic);
      console.log(`📰 Fetched ${articles.length} articles total`);

      // Early check - if no articles found, create minimal results
      if (articles.length === 0) {
        console.warn(`⚠️ No articles found for topic: "${data.topic}"`);
        const emptyResults: ResearchResults = {
          summary: `No articles were found for the topic "${data.topic}". This could be due to API limitations or the topic being too specific.`,
          keyInsights: ['No insights available due to lack of data'],
          keywords: [],
          articles: [],
          totalArticles: 0,
          processingTime: Date.now() - startTime,
          confidence: 0,
        };
        
        await this.saveResults(data.id, emptyResults);
        await this.updateProgress(100, 'Research completed (no data found)', 'COMPLETED');
        return emptyResults;
      }

      // Step 2: Process and rank articles
      await this.updateProgress(40, 'Processing articles', 'PROCESS');
      const processedArticles = await this.processArticles(articles, data.topic);
      console.log(`📊 Processed ${processedArticles.length} articles`);

      // Step 3: Extract keywords
      await this.updateProgress(70, 'Extracting keywords', 'KEYWORDS');
      let keywords: string[] = [];
      try {
        keywords = await this.keywordExtractor.extract(
          processedArticles.map(a => `${a.title} ${a.summary}`).join(' ')
        );
      } catch (error) {
        console.error('❌ Keyword extraction failed:', error);
        keywords = this.fallbackKeywordExtraction(processedArticles, data.topic);
      }

      // Step 4: Generate summary and insights
      await this.updateProgress(85, 'Generating summary', 'SUMMARY');
      let summary: string;
      let keyInsights: string[];
      
      try {
        summary = await this.summaryGenerator.generateSummary(processedArticles);
        keyInsights = await this.summaryGenerator.generateInsights(processedArticles);
      } catch (error) {
        console.error('❌ Summary generation failed:', error);
        summary = this.fallbackSummaryGeneration(processedArticles);
        keyInsights = this.fallbackInsightGeneration(processedArticles);
      }

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
      console.error(`❌ Research job ${this.job.id} failed:`, error);
      await this.handleError(data.id, error as Error);
      throw error;
    }
  }

  private async fetchArticles(topic: string): Promise<ProcessedArticle[]> {
    const allArticles: ProcessedArticle[] = [];
    console.log(`🔎 Starting to fetch articles from ${this.externalClients.length} sources`);
    
    const fetchPromises = this.externalClients.map(async (client) => {
      try {
        console.log(`📡 Fetching from ${client.constructor.name}...`);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<ProcessedArticle[]>((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 30000)
        );
        
        const articlesPromise = client.search(topic);
        const articles = await Promise.race([articlesPromise, timeoutPromise]);
        
        console.log(`✅ ${client.constructor.name} returned ${articles.length} articles`);
        return articles;
      } catch (error) {
        console.error(`❌ Failed to fetch from ${client.constructor.name}:`, error);
        return [];
      }
    });

    try {
      const results = await Promise.allSettled(fetchPromises);
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value);
        } else {
          console.error(`❌ Client ${index} failed:`, result.reason);
        }
      });
    } catch (error) {
      console.error('❌ Error in fetchArticles:', error);
    }

    console.log(`📊 Total articles collected: ${allArticles.length}`);
    return allArticles;
  }

  private async processArticles(articles: ProcessedArticle[], topic: string): Promise<ProcessedArticle[]> {
    try {
      // Remove duplicates and rank by relevance
      const uniqueArticles = this.removeDuplicates(articles);
      const rankedArticles = this.rankByRelevance(uniqueArticles, topic);
      
      // Take top 20 articles
      return rankedArticles.slice(0, 20);
    } catch (error) {
      console.error('❌ Error processing articles:', error);
      return articles.slice(0, 20); // Fallback to first 20 articles
    }
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
        const text = `${article.title} ${article.summary || ''}`.toLowerCase();
        
        topicWords.forEach(word => {
          const occurrences = (text.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          score += occurrences * 2; // Weight title/summary matches highly
        });

        return { ...article, relevanceScore: score };
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private calculateConfidence(articles: ProcessedArticle[]): number {
    if (articles.length === 0) return 0;
    
    const avgRelevance = articles.reduce((sum, a) => sum + (a.relevanceScore || 0), 0) / articles.length;
    const sourceVariety = new Set(articles.map(a => a.source)).size;
    
    // Confidence based on relevance and source diversity
    return Math.min((avgRelevance / 10) * 0.7 + (sourceVariety / 3) * 0.3, 1.0);
  }

  private fallbackKeywordExtraction(articles: ProcessedArticle[], _topic: string): string[] {
    const words = new Map<string, number>();
    const text = articles.map(a => `${a.title} ${a.summary || ''}`).join(' ').toLowerCase();
    
    // Simple word frequency extraction
    const wordList = text.match(/\b\w{3,}\b/g) || [];
    wordList.forEach(word => {
      if (word.length > 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)) {
        words.set(word, (words.get(word) || 0) + 1);
      }
    });
    
    return Array.from(words.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }

  private fallbackSummaryGeneration(articles: ProcessedArticle[]): string {
    if (articles.length === 0) return 'No articles found for analysis.';
    
    const topTitles = articles.slice(0, 5).map(a => a.title).join('; ');
    return `Research summary based on ${articles.length} articles. Key topics include: ${topTitles}`;
  }

  private fallbackInsightGeneration(articles: ProcessedArticle[]): string[] {
    if (articles.length === 0) return ['No insights available'];
    
    return [
      `Found ${articles.length} relevant articles`,
      `Sources include: ${Array.from(new Set(articles.map(a => a.source))).join(', ')}`,
      'Analysis completed using basic processing due to service limitations'
    ];
  }

  private async updateRequestStatus(requestId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'): Promise<void> {
    try {
      // Use transaction with short timeout for status updates
      await db.$transaction(async (tx) => {
        await tx.researchRequest.update({
          where: { id: requestId },
          data: { status },
        });
      }, {
        timeout: 5000, // 5 second timeout
        isolationLevel: 'ReadCommitted'
      });
      console.log(`✅ Updated request ${requestId} status to ${status}`);
    } catch (error) {
      console.error(`❌ Failed to update request status:`, error);
    }
  }

  private async updateProgress(progress: number, message: string, step: string): Promise<void> {
    const data = this.job.data as ResearchJobData;
    
    try {
      // Update job progress (no database connection)
      await this.job.progress(progress);
      console.log(`📈 Job ${this.job.id} progress: ${progress}% - ${message}`);
      
      // Single transaction for both operations with short timeout
      await db.$transaction(async (tx) => {
        // Log to database
        await tx.taskLog.create({
          data: {
            researchRequestId: data.id,
            level: 'INFO',
            message,
            step,
            context: { progress },
          },
        });

        // Update request progress
        const updateData: any = { progress };
        if (progress === 100) {
          updateData.status = 'COMPLETED';
          updateData.completedAt = new Date();
        }

        await tx.researchRequest.update({
          where: { id: data.id },
          data: updateData,
        });
      }, {
        timeout: 8000, // 8 second timeout for progress updates
        isolationLevel: 'ReadCommitted'
      });

    } catch (error) {
      console.error(`❌ Failed to update progress for job ${this.job.id}:`, error);
      // Don't throw here, continue processing
    }
  }

  private async saveResults(requestId: string, results: ResearchResults): Promise<void> {
    try {
      // Single transaction to save all results - optimized for bulk operations
      await db.$transaction(async (tx) => {
        const researchResult = await tx.researchResult.create({
          data: {
            researchRequestId: requestId,
            summary: results.summary,
            keyInsights: results.keyInsights,
            keywords: results.keywords,
            totalArticles: results.totalArticles,
            processingTime: results.processingTime,
            confidence: results.confidence,
            sources: Array.from(new Set(results.articles.map(article => article.source))),
          },
        });

        // Bulk insert articles if any exist
        if (results.articles.length > 0) {
          const articlesData = results.articles.map(article => {
            const articleData: any = {
              researchResultId: researchResult.id,
              title: article.title,
              url: article.url,
              summary: article.summary || '',
              content: article.content || '',
              source: article.source,
              relevanceScore: article.relevanceScore || 0,
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
          });

          // Use createMany for better performance
          await tx.article.createMany({
            data: articlesData,
            skipDuplicates: true,
          });
        }
      }, {
        timeout: 20000, // 20 second timeout for saving results
        isolationLevel: 'ReadCommitted'
      });
      
      console.log(`✅ Saved results for request ${requestId} with ${results.articles.length} articles`);
    } catch (error) {
      console.error(`❌ Failed to save results for request ${requestId}:`, error);
      throw error;
    }
  }

  private async handleError(requestId: string, error: Error): Promise<void> {
    try {
      // Single transaction for error handling
      await db.$transaction(async (tx) => {
        await tx.researchRequest.update({
          where: { id: requestId },
          data: {
            status: 'FAILED',
            error: error.message,
            completedAt: new Date(),
          },
        });

        await tx.taskLog.create({
          data: {
            researchRequestId: requestId,
            level: 'ERROR',
            message: 'Research job failed',
            step: 'ERROR',
            context: { 
              error: error.message,
              stack: error.stack?.substring(0, 500) // Limit stack trace size
            },
          },
        });
      }, {
        timeout: 10000, // 10 second timeout for error handling
        isolationLevel: 'ReadCommitted'
      });

      console.log(`❌ Recorded error for request ${requestId}: ${error.message}`);
    } catch (dbError) {
      console.error(`❌ Failed to record error in database:`, dbError);
    }
  }
}