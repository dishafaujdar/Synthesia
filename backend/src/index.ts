// Load env before any other code that reads process.env (e.g. database config)
import 'dotenv/config'

// Simple startup file - the app.ts file now handles everything
import './app'