// Solo cargar dotenv en desarrollo local
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Sistema de verificación de entorno para Railway
class RailwayEnvLoader {
  constructor() {
    this.criticalVars = {
      INSTITUTIONAL_KEY: '364b83d0722af52837fc321dbaefd68ccae1396eede1b9a926ae4843a28afeb5',
      BLOCKCHAIN_RPC: 'https://paseo-rpc.dwellir.com',
      CONTRACT_ADDRESS: '0x96950629523b239C2B0d6dd029300dDAe19Be2Cc',
      SUPABASE_URL: 'https://cxowygaebcusntrtdawr.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4b3d5Z2FlYmN1c250cnRkYXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NzAzNTYsImV4cCI6MjA3NDI0NjM1Nn0.EcmYVeJspon0sAr4J0MDKqICa08nvLRqiXIJ9M_C-QY',
      JWT_SECRET: 'tu_secret_key_super_segura_cambiar_en_produccion'
    };
  }

  load() {
    console.log('🔍 Checking Railway Environment Variables...');
    console.log('================================================');
    
    // Detectar si estamos en Railway
    const isRailway = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.RAILWAY_STATIC_URL || 
                      process.env.RAILWAY_GIT_COMMIT_SHA;
    
    if (isRailway) {
      console.log('🚂 Running on Railway Platform');
      console.log(`📦 Environment: ${process.env.RAILWAY_ENVIRONMENT || 'production'}`);
    }

    // Verificar y cargar variables críticas
    let missingVars = [];
    let loadedVars = [];

    Object.keys(this.criticalVars).forEach(varName => {
      if (!process.env[varName]) {
        // En producción/Railway, usar valores de respaldo para el hackathon
        if (process.env.NODE_ENV === 'production' || isRailway) {
          process.env[varName] = this.criticalVars[varName];
          console.log(`⚠️  ${varName}: Loaded from fallback (hackathon mode)`);
          loadedVars.push(varName);
        } else {
          missingVars.push(varName);
          console.log(`❌ ${varName}: Missing`);
        }
      } else {
        // Variable existe, mostrar de forma segura
        const value = process.env[varName];
        const masked = varName.includes('KEY') || varName.includes('SECRET') 
          ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
          : value.substring(0, 20) + '...';
        console.log(`✅ ${varName}: ${masked}`);
        loadedVars.push(varName);
      }
    });

    // Resumen
    console.log('================================================');
    console.log(`📊 Variables Summary:`);
    console.log(`   Total System Env Vars: ${Object.keys(process.env).length}`);
    console.log(`   Critical Vars Loaded: ${loadedVars.length}/${Object.keys(this.criticalVars).length}`);
    console.log(`   Missing Vars: ${missingVars.length}`);
    
    if (missingVars.length > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`\n⚠️  Missing variables in development:`, missingVars);
    }

    // Variables adicionales opcionales
    const optionalVars = ['JWT_EXPIRE', 'JWT_REFRESH_EXPIRE', 'PORT', 'HACKATHON_MODE'];
    console.log(`\n📋 Optional Variables:`);
    optionalVars.forEach(varName => {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName}: ${process.env[varName]}`);
      } else {
        console.log(`   ⚡ ${varName}: Using defaults`);
      }
    });

    console.log('================================================\n');

    // Establecer modo hackathon si estamos en producción
    if (process.env.NODE_ENV === 'production' && !process.env.HACKATHON_MODE) {
      process.env.HACKATHON_MODE = 'true';
      console.log('🏆 Hackathon Mode: ACTIVATED');
    }

    return missingVars.length === 0 || process.env.NODE_ENV === 'production';
  }
}

// Cargar variables antes de iniciar la app
const envLoader = new RailwayEnvLoader();
const envLoaded = envLoader.load();

if (!envLoaded && process.env.NODE_ENV !== 'production') {
  console.error('\n❌ CRITICAL: Environment variables missing in development mode');
  console.error('Please create a .env file with the required variables\n');
  process.exit(1);
}

// Importar la app después de cargar las variables
const app = require('./src/app');

// Inicializar servicios críticos
const initializeServices = async () => {
  console.log('🔄 Initializing Core Services...');
  
  try {
    // Inicializar blockchain service
    const blockchainService = require('./src/services/blockchainService');
    const blockchainStatus = blockchainService.getStatus();
    
    if (blockchainStatus.initialized) {
      console.log('✅ Blockchain Service: Ready');
      console.log(`   Wallet: ${blockchainStatus.walletAddress || 'Not configured'}`);
      console.log(`   Contract: ${blockchainStatus.contractAddress}`);
    } else {
      console.log('⚠️  Blockchain Service: Limited functionality');
      console.log('   Operating in database-only mode');
    }

    // Verificar Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      console.log('✅ Supabase: Configured');
    } else {
      console.log('⚠️  Supabase: Not configured');
    }

    // Verificar JWT
    if (process.env.JWT_SECRET) {
      console.log('✅ JWT Auth: Configured');
    } else {
      console.log('⚠️  JWT Auth: Using default (not secure)');
    }

    console.log('================================================\n');
    
  } catch (error) {
    console.error('⚠️  Error initializing services:', error.message);
  }
};

// Puerto y configuración del servidor
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, async () => {
  console.log('🎉 VeriChain Backend API Started Successfully!');
  console.log('================================================');
  console.log(`🚀 Server: http://${HOST}:${PORT}`);
  console.log(`📚 API Docs: http://${HOST}:${PORT}/api-docs`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏆 Hackathon Mode: ${process.env.HACKATHON_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
  
  if (process.env.RAILWAY_STATIC_URL) {
    console.log(`🌐 Public URL: ${process.env.RAILWAY_STATIC_URL}`);
  }
  
  console.log('================================================\n');

  // Inicializar servicios después de que el servidor esté listo
  await initializeServices();

  // Endpoint de salud mejorado
  console.log('💡 Quick Health Check:');
  console.log(`   curl ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/health`);
  console.log(`   curl ${process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`}/api/v1/diagnostics`);
  console.log('');
});

// Manejo mejorado de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! 💥');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // Log adicional para debugging en Railway
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.error('Railway Environment:', process.env.RAILWAY_ENVIRONMENT);
    console.error('Commit SHA:', process.env.RAILWAY_GIT_COMMIT_SHA);
  }
  
  // Dar tiempo para que los logs se escriban antes de cerrar
  setTimeout(() => {
    server.close(() => {
      console.log('🛑 Server closed');
      process.exit(1);
    });
  }, 1000);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! 💥');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // Cerrar de forma segura
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('🛑 HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('🛑 HTTP server closed');
    process.exit(0);
  });
});

// Sistema de monitoreo básico
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const usage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Solo loguear si hay problemas de memoria
    if (usage.heapUsed / usage.heapTotal > 0.9) {
      console.warn('⚠️  High memory usage detected:', {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        uptime: `${Math.round(uptime / 60)} minutes`
      });
    }
  }, 60000); // Cada minuto
}

module.exports = server;