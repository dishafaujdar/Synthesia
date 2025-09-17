export const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  console.error('Error:', err);

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'CLIENT_ERROR';
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      code,
      ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack }),
    },
  });
};
