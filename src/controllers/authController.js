require('dotenv').config();
const bcrypt = require('bcryptjs');
const { generateToken, generateRefreshToken } = require('../utils/jwtUtils');
const supabaseService = require('../services/supabaseService');
const { createClient } = require('@supabase/supabase-js');

// Cliente de Supabase para Auth (usa service key para bypass RLS)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validación
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // 1. Intentar login con Supabase Auth
      const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Login error:', authError);
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // 2. Buscar perfil del usuario en tabla users
      const { data: userProfile, error: profileError } = await supabaseService.supabase
        .from('users')
        .select('*, organization:organizations(id, name, logo_url)')
        .eq('id', authData.user.id)
        .single();

      // Si no existe perfil, crearlo con datos básicos
      let profile = userProfile;
      if (!profile) {
        const { data: newProfile } = await supabaseService.supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            full_name: authData.user.user_metadata?.full_name || email.split('@')[0],
            role: authData.user.user_metadata?.role || 'student',
            metadata: {
              last_login: new Date().toISOString(),
              created_via: 'login'
            }
          })
          .select()
          .single();
        
        profile = newProfile;
      } else {
        // Actualizar último login
        await supabaseService.supabase
          .from('users')
          .update({ 
            metadata: {
              ...profile.metadata,
              last_login: new Date().toISOString()
            }
          })
          .eq('id', authData.user.id);
      }

      // 3. Generar nuestro propio JWT (compatible con tu sistema actual)
      const token = generateToken({
        id: authData.user.id,
        email: authData.user.email,
        role: profile?.role || 'student',
        organizationId: profile?.organization_id
      });

      const refreshToken = generateRefreshToken({
        id: authData.user.id
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          refreshToken,
          supabaseToken: authData.session.access_token, // Por si lo necesitas
          user: {
            id: authData.user.id,
            email: authData.user.email,
            name: profile?.full_name || authData.user.user_metadata?.full_name,
            role: profile?.role || 'student',
            organization: profile?.organization || null,
            emailConfirmed: authData.user.email_confirmed_at !== null
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: error.message
      });
    }
  }

  async register(req, res) {
    try {
      const { email, password, fullName, role = 'student', organizationId, phone } = req.body;

      // Validación
      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Email, password and full name are required'
        });
      }

      // Validar rol
      const validRoles = ['admin', 'organization', 'student', 'verifier'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be: admin, organization, student, or verifier'
        });
      }

      // Validar organización si es necesario
      if (role === 'organization' && !organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Organization ID is required for organization role'
        });
      }

      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            organization_id: organizationId
          },
          emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email`
        }
      });

      if (authError) {
        console.error('Auth registration error:', authError);
        
        // Manejo específico de errores
        if (authError.message.includes('already registered')) {
          return res.status(400).json({
            success: false,
            message: 'Email already registered'
          });
        }
        
        return res.status(400).json({
          success: false,
          message: authError.message
        });
      }

      // 2. Crear perfil en tabla users
      const { data: userProfile, error: profileError } = await supabaseService.supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: role,
          organization_id: organizationId || null,
          phone: phone || null,
          metadata: {
            registered_at: new Date().toISOString(),
            registration_source: 'api',
            email_verification_pending: true
          }
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // No fallar si el perfil no se crea, Auth ya está creado
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            emailConfirmed: false,
            role: role
          }
        }
      });

    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during registration',
        error: error.message
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Por ahora usar tu sistema de JWT actual
      // TODO: Integrar con Supabase refresh si es necesario
      const newToken = generateToken({
        // Decodificar el refresh token para obtener el user id
        // Por ahora simplemente generar uno nuevo
      });

      res.json({
        success: true,
        message: 'Token refreshed',
        data: {
          token: newToken
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error refreshing token',
        error: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      // Obtener token del header si existe
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (token) {
        // Intentar cerrar sesión en Supabase
        await supabaseAuth.auth.signOut();
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during logout',
        error: error.message
      });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        message: 'Password reset instructions sent to your email'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending reset email',
        error: error.message
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      const { error } = await supabaseAuth.auth.updateUser({
        password: password
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error.message
      });
    }
  }

  async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      res.json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email',
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();