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


## 📚 Additional Resources

### Architecture Diagrams
- System Architecture: `/docs/architecture.md`
- Database Schema: `/docs/database-schema.md`
- API Documentation: `/docs/api-reference.md`
