import IORedis from 'ioredis'

// Parse the Redis URL properly
const REDIS_URL = process.env['REDIS_URL']!
console.log('🔗 Connecting to Redis:', REDIS_URL.replace(/:[^:@]*@/, ':****@'))

// Parse Redis URL manually for better error handling
const parseRedisUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    const config: any = {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 6379,
    }
    
    if (urlObj.password) {
      config.password = urlObj.password
    }
    
    if (urlObj.username) {
      config.username = urlObj.username
    }
    
    return config
  } catch (error: any) {
    console.error('❌ Invalid Redis URL format:', error.message)
    throw new Error('Invalid Redis URL format')
  }
}

const redisConfig = parseRedisUrl(REDIS_URL)

export const redis = new IORedis({
  ...redisConfig,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: false, // Connect immediately
  keepAlive: 30000,
  family: 4, // Use IPv4
  db: 0,
})

// Enhanced event listeners
redis.on('connect', () => {
  console.log('✅ Redis: Connection established')
})

redis.on('ready', () => {
  console.log('🚀 Redis: Ready to accept commands')
})

redis.on('error', (error) => {
  console.error('❌ Redis Error:', error.message)
  console.error('🔧 Check your REDIS_URL and network connectivity')
})

redis.on('close', () => {
  console.log('📪 Redis: Connection closed')
})

redis.on('reconnecting', (delay: number) => {
  console.log(`🔄 Redis: Reconnecting in ${delay}ms...`)
})

redis.on('end', () => {
  console.log('🔚 Redis: Connection ended')
})

// Test connection immediately
const testRedisConnection = async () => {
  try {
    console.log('🏓 Testing Redis connection...')
    const result = await redis.ping()
    console.log('✅ Redis ping successful:', result)
    return true
  } catch (error: any) {
    console.error('❌ Redis ping failed:', error.message)
    console.error('🔧 Redis connection details:', {
      host: redisConfig.host,
      port: redisConfig.port,
      hasPassword: !!redisConfig.password,
      hasUsername: !!redisConfig.username,
    })
    return false
  }
}

// Export test function
export { testRedisConnection }
