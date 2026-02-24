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