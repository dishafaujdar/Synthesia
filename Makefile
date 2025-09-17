# AI Research Agent - Development Commands

.PHONY: help install dev build test clean docker-up docker-down db-setup db-migrate db-seed lint

help: ## Show this help message
	@echo "AI Research Agent - Development Commands"
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	@npm install
	@cd backend && npm install
	@cd frontend && npm install
	@echo "✅ Dependencies installed"

dev: ## Start development servers
	@echo "🚀 Starting development servers..."
	@npm run dev

backend-dev: ## Start only backend development server
	@echo "🔧 Starting backend development server..."
	@cd backend && npm run dev

frontend-dev: ## Start only frontend development server
	@echo "🎨 Starting frontend development server..."
	@cd frontend && npm run dev

build: ## Build all applications for production
	@echo "🏗️  Building applications..."
	@npm run build
	@echo "✅ Build completed"

test: ## Run all tests
	@echo "🧪 Running tests..."
	@npm run test
	@echo "✅ Tests completed"

lint: ## Run linting and type checking
	@echo "🔍 Running linting and type checking..."
	@cd backend && npm run lint && npm run typecheck
	@cd frontend && npm run lint && npm run typecheck
	@echo "✅ Linting completed"

clean: ## Clean build artifacts and node_modules
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf node_modules package-lock.json
	@rm -rf backend/node_modules backend/package-lock.json backend/dist
	@rm -rf frontend/node_modules frontend/package-lock.json frontend/.next
	@echo "✅ Cleaned"

docker-up: ## Start all services with Docker
	@echo "🐳 Starting Docker services..."
	@docker-compose up --build

docker-down: ## Stop all Docker services
	@echo "🐳 Stopping Docker services..."
	@docker-compose down

docker-logs: ## View Docker logs
	@docker-compose logs -f

db-setup: ## Setup database (generate + migrate + seed)
	@echo "🗄️  Setting up database..."
	@cd backend && npm run db:generate && npm run db:migrate && npm run db:seed
	@echo "✅ Database setup completed"

db-migrate: ## Run database migrations
	@echo "🔄 Running database migrations..."
	@cd backend && npm run db:migrate
	@echo "✅ Migrations completed"

db-seed: ## Seed database with sample data
	@echo "🌱 Seeding database..."
	@cd backend && npm run db:seed
	@echo "✅ Database seeded"

db-studio: ## Open Prisma Studio
	@echo "🎯 Opening Prisma Studio..."
	@cd backend && npm run db:studio

health: ## Check application health
	@echo "🩺 Checking application health..."
	@curl -f http://localhost:3001/health || echo "❌ Backend is not healthy"
	@curl -f http://localhost:3000 || echo "❌ Frontend is not accessible"

logs: ## View application logs
	@echo "📋 Viewing logs..."
	@docker-compose logs -f backend

setup: ## Complete development environment setup
	@echo "🚀 Running complete setup..."
	@./setup.sh

production: ## Deploy to production
	@echo "🚢 Deploying to production..."
	@docker-compose -f docker-compose.prod.yml up --build -d

# Database shortcuts
migrate: db-migrate
seed: db-seed
studio: db-studio

# Docker shortcuts
up: docker-up
down: docker-down

# Development shortcuts
start: dev
serve: dev
