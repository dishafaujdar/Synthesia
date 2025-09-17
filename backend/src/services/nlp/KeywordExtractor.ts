import { stopwords } from '@/utils/stopwords';

export default class KeywordExtractor {
  private stopwordsSet = new Set(stopwords);

  async extract(text: string, maxKeywords: number = 15): Promise<string[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      // Clean and tokenize text
      const cleanText = text
        .toLowerCase()
        .replace(/[^a-zA-Z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const words = cleanText.split(' ').filter(word => word.length > 2);
      
      // Remove stopwords
      const filteredWords = words.filter((word: string) => 
        !this.stopwordsSet.has(word) && word.length > 2
      );

      // Count word frequencies
      const wordFreq = new Map<string, number>();
      filteredWords.forEach((word: string) => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });

      // Extract phrases (2-3 words)
      const phrases = this.extractPhrases(filteredWords);
      phrases.forEach(phrase => {
        wordFreq.set(phrase, (wordFreq.get(phrase) || 0) + 2); // Weight phrases higher
      });

      // Sort by frequency and return top keywords
      return Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word)
        .filter(keyword => keyword.length > 2);
    } catch (error) {
      console.error('Keyword extraction failed:', error);
      return [];
    }
  }

  private extractPhrases(words: string[]): string[] {
    const phrases: string[] = [];
    
    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (phrase.length > 5 && phrase.length < 30) {
        phrases.push(phrase);
      }
    }

    // Extract 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (phrase.length > 8 && phrase.length < 40) {
        phrases.push(phrase);
      }
    }

    return phrases;
  }

  // Extract keywords with TF-IDF-like scoring
  async extractWithScoring(documents: string[]): Promise<{ keyword: string; score: number }[]> {
    const documentCount = documents.length;
    const wordDocumentFreq = new Map<string, number>();
    const allKeywords = new Set<string>();

    // Extract keywords from each document
    for (const doc of documents) {
      const keywords = await this.extract(doc);
      keywords.forEach(keyword => {
        allKeywords.add(keyword);
        wordDocumentFreq.set(keyword, (wordDocumentFreq.get(keyword) || 0) + 1);
      });
    }

    // Calculate TF-IDF-like scores
    const scoredKeywords = Array.from(allKeywords).map(keyword => {
      const df = wordDocumentFreq.get(keyword) || 0;
      const idf = Math.log(documentCount / df);
      const tf = df / documentCount;
      
      return {
        keyword,
        score: tf * idf,
      };
    });

    return scoredKeywords.sort((a, b) => b.score - a.score);
  }
}
