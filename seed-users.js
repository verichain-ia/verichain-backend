// seed-users.js
// Ejecutar este script para crear usuarios de prueba
// node seed-users.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// IMPORTANTE: Necesitas la SERVICE KEY para bypass RLS
// Encuentra tu service key en: Supabase Dashboard > Settings > API > Service Key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'TU_SERVICE_KEY_AQUI';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const users = [
  {
    email: 'admin@verichain.com',
    password: 'Admin123!',
    fullName: 'Admin VeriChain',
    role: 'admin',
    phone: '+57 300 1234567'
  },
  {
    email: 'universidad@test.com',
    password: 'Uni123!',
    fullName: 'Universidad de Prueba',
    role: 'organization',
    organizationId: 'b1891ae6-15ef-4ce9-b48f-3442fd6d321f', // ID de tu org
    phone: '+57 301 2345678'
  },
  {
    email: 'estudiante1@test.com',
    password: 'Est123!',
    fullName: 'Juan Pérez',
    role: 'student',
    phone: '+57 302 3456789'
  },
  {
    email: 'estudiante2@test.com',
    password: 'Est123!',
    fullName: 'María García',
    role: 'student',
    phone: '+57 303 4567890'
  },
  {
    email: 'verificador@empresa.com',
    password: 'Ver123!',
    fullName: 'Empresa Verificadora',
    role: 'verifier',
    phone: '+57 304 5678901'
  }
];

async function createUsers() {
  console.log('🚀 Iniciando creación de usuarios...\n');
  
  for (const userData of users) {
    try {
      console.log(`📝 Creando usuario: ${userData.email}`);
      
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirmar email para testing
        user_metadata: {
          full_name: userData.fullName,
          role: userData.role
        }
      });

      if (authError) {
        console.error(`❌ Error creando auth para ${userData.email}:`, authError.message);
        continue;
      }

      console.log(`✅ Auth creado: ${authData.user.id}`);

      // 2. Crear perfil en tabla users
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.fullName,
          role: userData.role,
          organization_id: userData.organizationId || null,
          phone: userData.phone || null,
          metadata: {
            created_via: 'seed_script',
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (profileError) {
        console.error(`⚠️  Error creando perfil para ${userData.email}:`, profileError.message);
      } else {
        console.log(`✅ Perfil creado en tabla users`);
      }

      console.log(`✅ Usuario completo: ${userData.email}\n`);
      
    } catch (error) {
      console.error(`❌ Error general con ${userData.email}:`, error.message);
    }
  }

  console.log('\n📊 Resumen de usuarios creados:');
  console.log('================================');
  for (const user of users) {
    console.log(`
📧 Email: ${user.email}
🔑 Password: ${user.password}
👤 Nombre: ${user.fullName}
🎭 Rol: ${user.role}
    `);
  }
  
  console.log('================================');
  console.log('✅ Proceso completado!');
  console.log('\n🔥 Ahora puedes hacer login con cualquiera de estos usuarios');
}

// Ejecutar
createUsers().then(() => {
  console.log('\n🎉 Script finalizado');
  process.exit(0);
}).catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});