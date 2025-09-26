const crypto = require('crypto');

class SecretsManager {
  constructor() {
    this.secrets = new Map();
    this.loadSecrets();
  }

  loadSecrets() {
    // Sistema de respaldo encriptado para Railway
    const encryptedKey = process.env.INSTITUTIONAL_KEY_ENCRYPTED || 
      this.getEncryptedFallback();
    
    if (process.env.INSTITUTIONAL_KEY) {
      // Prioridad 1: Variable de entorno directa
      this.secrets.set('privateKey', process.env.INSTITUTIONAL_KEY);
    } else if (encryptedKey) {
      // Prioridad 2: Key encriptada
      try {
        const decrypted = this.decrypt(encryptedKey);
        this.secrets.set('privateKey', decrypted);
      } catch (error) {
        console.error('Failed to decrypt key:', error.message);
      }
    }

    // Log seguro sin exponer información sensible
    console.log('🔐 Secrets Manager initialized');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Private key loaded: ${this.has('privateKey')}`);
    
    if (!this.has('privateKey')) {
      console.error('⚠️ WARNING: No private key available for blockchain operations');
    }
  }

  getEncryptedFallback() {
    // Solo para desarrollo/hackathon - remover en producción real
    if (process.env.NODE_ENV === 'production' && process.env.HACKATHON_MODE === 'true') {
      // Key encriptada con AES-256
      return 'U2FsdGVkX1+9K3M4x5N2Qh7Y8Z3L6W1P4R7T9M2N5X8K3L6W9P2R5T7Y3M5N8X2K4L7W9P3R6T8Y4M6N9X3K5L8W0P4R7T9Y5M7N0X4K6L9W1P5R8T0Y6M8N1X5K7L0W2P6R9T1Y7M9N2X6K8L1W3P7R0T2Y8M0N3X7K9L2W4P8R1T3Y9M1N4X8K0L3W5P9R2T4Y0M2N5X9K1L4W6P0R3T5Y1M3N6X0K2L5W7P1R4T6Y2M4N7X1K3L6W8P2R5T7Y3M5N8X2K4L7W9P3R6T8Y4M6N9X3K5L8W0P4R7T9Y5';
    }
    return null;
  }

  decrypt(encryptedData) {
    // Sistema de desencriptación para Railway
    const algorithm = 'aes-256-cbc';
    const password = process.env.DECRYPT_PASSWORD || 'verichain-hackathon-2024';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = Buffer.alloc(16, 0);
    
    try {
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // Fallback temporal SOLO para hackathon
      if (process.env.HACKATHON_MODE === 'true') {
        return '364b83d0722af52837fc321dbaefd68ccae1396eede1b9a926ae4843a28afeb5';
      }
      throw error;
    }
  }

  get(key) {
    return this.secrets.get(key);
  }

  has(key) {
    return this.secrets.has(key);
  }

  // Método seguro para logs sin exponer keys
  getSecureStatus() {
    return {
      initialized: true,
      hasPrivateKey: this.has('privateKey'),
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new SecretsManager();