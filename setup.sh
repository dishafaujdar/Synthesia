#!/bin/bash

set -e

echo "🚀 Setting up AI Research Agent development environment..."

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install Node.js 20+"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Please install Docker"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed"; exit 1; }

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "📦 Installing backend dependencies..."
cd backend && npm install
cd ..

echo "📦 Installing frontend dependencies..."
cd frontend && npm install
cd ..

# Setup environment files
echo "⚙️  Setting up environment files..."

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env from example"
else
    echo "ℹ️  backend/.env already exists"
fi

# Start infrastructure services
echo "🐳 Starting infrastructure services..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Setup database
echo "🗄️  Setting up database..."
cd backend
npm run db:generate
npm run db:migrate

echo "🌱 Seeding database with sample data..."
npm run db:seed || echo "⚠️  Database seeding failed (this is okay for first run)"

cd ..

echo "✅ Setup completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "  1. Start development servers:"
echo "     npm run dev"
echo ""
echo "  2. Or start individual services:"
echo "     Backend:  cd backend && npm run dev"
echo "     Frontend: cd frontend && npm run dev"
echo ""
echo "  3. Access the application:"
echo "     Frontend: http://localhost:3000"
echo "     Backend:  http://localhost:3001"
echo "     Health:   http://localhost:3001/health"
echo ""
echo "📚 For more information, see README.md"
