const secretsManager = require('./secrets.manager');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  
  jwt: {
    secret: process.env.JWT_SECRET || 'tu_secret_key_super_segura_cambiar_en_produccion',
    expire: process.env.JWT_EXPIRE || '15m',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d'
  },
  
  blockchain: {
    rpc: process.env.BLOCKCHAIN_RPC || 'https://paseo-rpc.dwellir.com',
    contractAddress: process.env.CONTRACT_ADDRESS || '0x96950629523b239C2B0d6dd029300dDAe19Be2Cc',
    privateKey: secretsManager.get('privateKey'),
    chainId: 420420422
  },
  
  supabase: {
    url: process.env.SUPABASE_URL || 'https://cxowygaebcusntrtdawr.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY
  },
  
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100 // límite de requests
    },
    corsOrigins: [
      'https://latinhack.verichain.app',
      'https://verichain.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ]
  },
  
  monitoring: {
    enabled: true,
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};