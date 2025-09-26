const { ethers } = require('ethers');
require('dotenv').config();

const CONTRACT_ABI = [
  "function issueCertificate(string memory id, string memory studentName, string memory courseName, string memory institution) public returns (bytes32)"
];

class BlockchainService {
  constructor() {
    // Debug completo de variables de entorno
    console.log('=== BLOCKCHAIN SERVICE INITIALIZATION ===');
    console.log('Environment variables check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- Has INSTITUTIONAL_KEY:', !!process.env.INSTITUTIONAL_KEY);
    console.log('- Has BLOCKCHAIN_RPC:', !!process.env.BLOCKCHAIN_RPC);
    console.log('- Has CONTRACT_ADDRESS:', !!process.env.CONTRACT_ADDRESS);
    
    // Listar TODAS las variables de entorno (solo los nombres, no valores)
    console.log('All available env vars:', Object.keys(process.env).filter(key => 
      key.includes('BLOCKCHAIN') || 
      key.includes('CONTRACT') || 
      key.includes('INSTITUTIONAL') ||
      key.includes('KEY')
    ));
    
    // Intentar obtener la configuración de múltiples fuentes
    const rpcUrl = process.env.BLOCKCHAIN_RPC || process.env.RPC_URL;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const config = require('../config');
    const privateKey = config.blockchain.privateKey;
    
    // Validar RPC
    if (!rpcUrl) {
      console.error('ERROR: No RPC URL configured');
      throw new Error('RPC URL not configured');
    }
    console.log('RPC URL configured:', rpcUrl);
    
    // Validar Contract Address
    if (!contractAddress) {
      console.error('ERROR: No contract address configured');
      throw new Error('Contract address not configured');
    }
    console.log('Contract address configured:', contractAddress);
    
    // Validar Private Key con más detalle
    console.log('Private key validation:');
    console.log('- Key exists:', !!privateKey);
    console.log('- Key length:', privateKey ? privateKey.length : 0);
    console.log('- First 6 chars:', privateKey ? privateKey.substring(0, 6) + '...' : 'N/A');
    
    if (!privateKey) {
      console.error('ERROR: Private key is undefined or empty');
      throw new Error('Private key not found in environment variables');
    }
    
    if (privateKey === '[ REDACTED ]') {
      console.error('ERROR: Private key showing as REDACTED');
      throw new Error('Private key is REDACTED - check Railway configuration');
    }
    
    if (privateKey.length !== 64) {
      console.error(`ERROR: Private key has wrong length: ${privateKey.length} (expected 64)`);
      throw new Error(`Invalid private key length: ${privateKey.length}`);
    }
    
    // Inicializar provider
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('Provider initialized successfully');
    } catch (error) {
      console.error('ERROR initializing provider:', error.message);
      throw error;
    }
    
    // Inicializar wallet
    try {
      // Agregar 0x si no lo tiene
      const formattedKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
      this.wallet = new ethers.Wallet(formattedKey, this.provider);
      console.log('Wallet initialized with address:', this.wallet.address);
    } catch (error) {
      console.error('ERROR initializing wallet:', error.message);
      throw error;
    }
    
    // Inicializar contrato
    try {
      this.contract = new ethers.Contract(
        contractAddress,
        CONTRACT_ABI,
        this.wallet
      );
      console.log('Contract initialized at:', contractAddress);
    } catch (error) {
      console.error('ERROR initializing contract:', error.message);
      throw error;
    }
    
    console.log('=== BLOCKCHAIN SERVICE READY ===');
  }

  async issueCertificate(id, studentName, courseName, institution = 'Universidad Demo') {
    try {
      console.log(`Emitting certificate ${id} to blockchain...`);
      console.log('- Student:', studentName);
      console.log('- Course:', courseName);
      console.log('- Institution:', institution);
      
      const tx = await this.contract.issueCertificate(
        id,
        studentName,
        courseName,
        institution
      );
      
      console.log('TX sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('TX confirmed in block:', receipt.blockNumber);
      
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber.toString()
      };
    } catch (error) {
      console.error('Blockchain error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async batchIssueCertificates(certificates, delay = 2000) {
    const results = [];
    
    for (const cert of certificates) {
      try {
        const result = await this.issueCertificate(
          cert.id,
          cert.student_name,
          cert.course_name,
          cert.institution
        );
        results.push({ ...cert, ...result });
        
        // Delay entre emisiones para evitar congestión
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        results.push({ 
          id: cert.id, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }
}

// Exportar con manejo de errores
try {
  module.exports = new BlockchainService();
} catch (error) {
  console.error('FATAL: Could not initialize BlockchainService');
  console.error(error.message);
  // Exportar un servicio dummy para no romper la aplicación
  module.exports = {
    issueCertificate: async () => ({ 
      success: false, 
      error: 'Blockchain service not initialized' 
    }),
    batchIssueCertificates: async () => []
  };
}