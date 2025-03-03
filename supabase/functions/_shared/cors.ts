// CORS headers for edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, X-Requested-With, apikey, Apikey, X-API-KEY, x-api-key',
  'Access-Control-Max-Age': '86400', // 24 hours
}; 