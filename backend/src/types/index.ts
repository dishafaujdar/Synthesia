import type { RequestStatus, TaskLogLevel, UserRole } from '@prisma/client';

// Core domain types
export interface ResearchJobData {
  id: string;
  topic: string;
  field?: string | undefined;
  userId?: string;
  priority: 'low' | 'normal' | 'high';
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessedArticle {
  title: string;
  url: string;
  summary: string;
  content?: string;
  publishedAt?: Date;
  source: string;
  relevanceScore: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  wordCount: number;
}

export interface ResearchResults {
  summary: string;
  keyInsights: string[];
  keywords: string[];
  articles: ProcessedArticle[];
  totalArticles: number;
  processingTime: number;
  confidence: number;
}

export interface JobProgress {
  step: string;
  progress: number;
  message: string;
  timestamp: Date;
}

// API Request/Response types
export interface CreateResearchRequest {
  topic: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface ResearchRequestResponse {
  id: string;
  topic: string;
  status: RequestStatus;
  priority: string;
  progress: number;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  results?: ResearchResults;
}

export interface TaskLogEntry {
  id: string;
  level: TaskLogLevel;
  message: string;
  step: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// External API interfaces
export interface WikipediaSearchResult {
  id: number;
  key: string;
  title: string;
  excerpt: string;
  description?: string;
  thumbnail?: {
    mimetype: string;
    url: string;
  };
}

export interface NewsAPIArticle {
  source: {
    id?: string;
    name: string;
  };
  author?: string;
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  content?: string;
}

export interface HackerNewsItem {
  id: number;
  title?: string;
  url?: string;
  text?: string;
  time: number;
  type: string;
  score?: number;
}

// Service interfaces
export interface ExternalAPIClient {
  search(query: string): Promise<ProcessedArticle[]>;
  isHealthy(): Promise<boolean>;
}

export interface JobProcessor {
  execute(data: ResearchJobData): Promise<void>;
  onProgress(callback: (progress: JobProgress) => void): void;
  onFailure(error: Error): void;
}

// Authentication types
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  apiUsage: number;
  apiLimit: number;
}

// Error types
export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
  field?: string | undefined;
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
  }
}

// Configuration types
export interface Config {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  apiVersion: string;
  database: {
    url: string;
    connectionPoolSize: number;
  };
  redis: {
    url: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  externalApis: {
    openai?: {
      apiKey: string;
    };
    newsApi?: {
      apiKey: string;
    };
    wikipedia: {
      baseUrl: string;
    };
  };
  jobs: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
  };
  monitoring: {
    logLevel: string;
    otelServiceName: string;
    otelEndpoint?: string;
  };
  cache: {
    ttl: number;
  };
  apiTimeout: number;
}

// Metrics types
export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    externalApis: Record<string, 'healthy' | 'unhealthy'>;
  };
  version: string;
  uptime: number;
}

// Event types for real-time updates
export interface ResearchProgressEvent {
  requestId: string;
  progress: number;
  step: string;
  message: string;
  timestamp: Date;
}

export interface ResearchCompletedEvent {
  requestId: string;
  results: ResearchResults;
  timestamp: Date;
}

export interface ResearchFailedEvent {
  requestId: string;
  error: string;
  timestamp: Date;
}
