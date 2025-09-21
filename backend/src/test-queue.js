const Bull = require('bull');

console.log('Testing Bull with Redis...');


const REDIS_URL = process.env.REDIS_URL;
console.log('Redis URL:', REDIS_URL ? 'configured' : 'missing');

try {
  const testQueue = new Bull('test', REDIS_URL);
  console.log('Bull queue created successfully');
  
  testQueue.on('ready', () => {
    console.log('Bull queue is ready');
  });
  
  testQueue.on('error', (error) => {
    console.log('Bull queue error:', error.message);
  });
  
} catch (error) {
  console.log('Bull queue creation failed:', error.message);
}