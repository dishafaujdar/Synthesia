# AI Research Agent - Production-Grade Implementation

A sophisticated AI Research Agent demonstrating enterprise-level engineering practices with advanced async patterns, robust observability, and production-ready architecture.

## 🏗️ Architecture Overview

```
Frontend (Next.js/TS) → API Gateway → Background Jobs → External APIs → Database
                            ↓
                    Observability Stack (Logs/Metrics/Traces)
```

## 📋 Tech Stack

### Backend (Node.js/TypeScript)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Job Queue**: Bull.js with Redis for async processing
- **Observability**: Winston logging + structured logging
- **Validation**: Zod for type-safe validation
- **Security**: Helmet, CORS, rate limiting

### Frontend (Next.js/TypeScript)
- **Framework**: Next.js 14 with App Router
- **UI**: Tailwind CSS with modern dark theme
- **State Management**: React hooks with custom API client
- **Real-time**: Polling for job status updates

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Database**: PostgreSQL with connection pooling
- **Cache/Queue**: Redis for job queue
- **Reverse Proxy**: Nginx for load balancing

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL (if running locally)
- Redis (if running locally)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ai-research-agent
npm install
```

### 2. Environment Setup

Backend environment:
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_research_agent"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=3001

# Optional: External API Keys
OPENAI_API_KEY="your-openai-key"
NEWS_API_KEY="your-news-api-key"
```

### 3. Database Setup

```bash
cd backend
npm run db:generate
npm run db:migrate
```

### 4. Development Mode

**Option A: With Docker (Recommended)**
```bash
docker-compose up --build
```

**Option B: Local Development**

Terminal 1 - Start services:
```bash
docker-compose up postgres redis
```

Terminal 2 - Backend:
```bash
cd backend
npm run dev
```

Terminal 3 - Frontend:
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 📊 API Endpoints

### Research API
- `POST /api/v1/research` - Create research request
- `GET /api/v1/research` - List research requests
- `GET /api/v1/research/:id` - Get specific request
- `GET /api/v1/research/:id/status` - Get request status
- `GET /api/v1/research/:id/logs` - Get request logs
- `DELETE /api/v1/research/:id` - Cancel request

### Example Usage

Create a research request:
```bash
curl -X POST http://localhost:3001/api/v1/research \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "artificial intelligence trends 2024", "priority": "high"}'
```

## 🔧 Configuration

### Environment Variables

#### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `NEWS_API_KEY` - News API key (optional)

#### Frontend
- `NEXT_PUBLIC_API_URL` - Backend API URL

### Database Schema

The application uses a sophisticated database schema with:
- **ResearchRequest**: Main research requests with status tracking
- **ResearchResult**: Processed results with articles and insights
- **Article**: Individual articles with relevance scoring
- **TaskLog**: Structured logging for each processing step
- **User**: User management (bonus feature)
- **SystemMetrics**: Performance monitoring

## 🏭 Production Deployment

### Docker Deployment

1. **Build Production Images**:
```bash
docker-compose -f docker-compose.prod.yml build
```

2. **Deploy**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

#### Backend (Railway/Render)
1. Set environment variables in platform
2. Configure PostgreSQL and Redis
3. Run database migrations
4. Deploy application

#### Frontend (Vercel)
1. Connect GitHub repository
2. Set `NEXT_PUBLIC_API_URL` environment variable
3. Deploy

## 🔍 Key Features Implemented

### 1. **Advanced Job Processing**
- ✅ Bull.js queue with Redis
- ✅ Job retry with exponential backoff
- ✅ Priority queues (low/normal/high)
- ✅ Graceful shutdown handling
- ✅ Job progress tracking

### 2. **Production API Design**
- ✅ Type-safe request/response with Zod
- ✅ Structured error handling
- ✅ Request correlation IDs
- ✅ Rate limiting
- ✅ Input validation
- ✅ CORS and security headers

### 3. **Database Architecture**
- ✅ Prisma ORM with TypeScript
- ✅ Complex relational schema
- ✅ Proper indexing strategy
- ✅ Connection pooling
- ✅ Transaction support

### 4. **External API Integration**
- ✅ Wikipedia API integration
- ✅ News API integration (optional)
- ✅ Circuit breaker pattern
- ✅ Timeout handling
- ✅ Fallback strategies

### 5. **Observability & Monitoring**
- ✅ Structured logging with Winston
- ✅ Request correlation tracking
- ✅ Performance metrics
- ✅ Health check endpoints
- ✅ Error tracking and alerting

### 6. **NLP & Content Processing**
- ✅ Keyword extraction
- ✅ Content summarization
- ✅ Article relevance scoring
- ✅ Duplicate detection
- ✅ Content ranking algorithms

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Frontend Testing
```bash
cd frontend
npm test                 # Run all tests
npm run test:watch      # Watch mode
```

### Integration Testing
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up

# Run integration tests
npm run test:integration
```

## 🔧 Advanced Configuration

### Job Queue Tuning
```typescript
// backend/src/jobs/queue.ts
export const researchQueue = new Bull<ResearchJobData>('research', {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
  settings: {
    stalledInterval: 30 * 1000,
    maxStalledCount: 1,
  },
});
```


### Debugging Tools
```bash
# View job queue status
curl http://localhost:3001/api/admin/queue/stats

# Check database connections
curl http://localhost:3001/health

# View recent logs
docker-compose logs -f backend

# Monitor Redis
redis-cli monitor
```

## 📚 Additional Resources

### Architecture Diagrams
- System Architecture: `/docs/architecture.md`
- Database Schema: `/docs/database-schema.md`
- API Documentation: `/docs/api-reference.md`
