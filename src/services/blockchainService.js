const { ethers } = require('ethers');
const secretsManager = require('../config/secrets.manager');

class BlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    this.config = {
      rpc: process.env.BLOCKCHAIN_RPC || 'https://paseo-rpc.dwellir.com',
      contractAddress: process.env.CONTRACT_ADDRESS || '0x96950629523b239C2B0d6dd029300dDAe19Be2Cc',
      chainId: 420420422,
      gasLimit: 500000,
      maxFeePerGas: ethers.parseUnits('30', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
    };

    this.contractABI = [
      "function issueCertificate(string memory certificateId, address recipient, string memory ipfsHash, uint256 timestamp) public",
      "function verifyCertificate(string memory certificateId) public view returns (bool exists, address recipient, string memory ipfsHash, uint256 timestamp, address issuer)",
      "function getCertificateCount() public view returns (uint256)",
      "event CertificateIssued(string indexed certificateId, address indexed recipient, address indexed issuer, uint256 timestamp)"
    ];

    this.initialize();
  }

  async initialize() {
    try {
      console.log('🔄 Initializing Blockchain Service...');
      
      // Configurar provider
      this.provider = new ethers.JsonRpcProvider(this.config.rpc);
      
      // Verificar conexión
      const network = await this.provider.getNetwork();
      console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
      
      // Obtener private key del secrets manager
      const privateKey = secretsManager.get('privateKey');
      
      if (!privateKey) {
        console.error('❌ Private key not available - Blockchain writes disabled');
        console.log('📝 Operating in READ-ONLY mode');
        this.initialized = false;
        return;
      }

      // Crear wallet
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`✅ Wallet initialized: ${this.wallet.address}`);
      
      // Verificar balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} PAS`);
      
      if (balance < ethers.parseEther('0.01')) {
        console.warn('⚠️ Low balance warning - may not be able to send transactions');
      }
      
      // Crear instancia del contrato
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        this.contractABI,
        this.wallet
      );
      
      // Verificar contrato
      const contractCode = await this.provider.getCode(this.config.contractAddress);
      if (contractCode === '0x') {
        throw new Error('Contract not deployed at specified address');
      }
      
      console.log(`✅ Contract initialized at: ${this.config.contractAddress}`);
      
      // Test de lectura
      try {
        const count = await this.contract.getCertificateCount();
        console.log(`📊 Total certificates on-chain: ${count.toString()}`);
      } catch (error) {
        console.log('⚠️ Could not read certificate count');
      }
      
      this.initialized = true;
      console.log('🎉 Blockchain Service fully initialized');
      
    } catch (error) {
      console.error('❌ Blockchain initialization error:', error.message);
      this.initialized = false;
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying initialization (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.initialize(), 5000 * this.retryCount);
      }
    }
  }

  async issueCertificate(certificateData) {
    if (!this.initialized) {
      throw new Error('Blockchain service not initialized - cannot issue certificates');
    }

    try {
      const { certificateId, recipientAddress, ipfsHash, timestamp } = certificateData;
      
      console.log(`📝 Issuing certificate: ${certificateId}`);
      
      // Estimar gas
      const estimatedGas = await this.contract.issueCertificate.estimateGas(
        certificateId,
        recipientAddress || this.wallet.address,
        ipfsHash || '',
        timestamp || Math.floor(Date.now() / 1000)
      );
      
      console.log(`⛽ Estimated gas: ${estimatedGas.toString()}`);
      
      // Enviar transacción
      const tx = await this.contract.issueCertificate(
        certificateId,
        recipientAddress || this.wallet.address,
        ipfsHash || '',
        timestamp || Math.floor(Date.now() / 1000),
        {
          gasLimit: estimatedGas * 120n / 100n, // 20% buffer
          maxFeePerGas: this.config.maxFeePerGas,
          maxPriorityFeePerGas: this.config.maxPriorityFeePerGas
        }
      );
      
      console.log(`📤 Transaction sent: ${tx.hash}`);
      
      // Esperar confirmación
      const receipt = await tx.wait(2); // Esperar 2 confirmaciones
      
      console.log(`✅ Certificate issued successfully`);
      console.log(`🔗 Transaction hash: ${receipt.hash}`);
      console.log(`📦 Block number: ${receipt.blockNumber}`);
      
      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl: `https://paseo.subscan.io/tx/${receipt.hash}`
      };
      
    } catch (error) {
      console.error('❌ Error issuing certificate:', error);
      
      // Manejo detallado de errores
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient funds in wallet for transaction');
      } else if (error.code === 'NONCE_EXPIRED') {
        throw new Error('Transaction nonce issue - please retry');
      } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
        throw new Error('Gas price too low - network congested');
      } else {
        throw new Error(`Blockchain error: ${error.message}`);
      }
    }
  }

  async verifyCertificate(certificateId) {
    try {
      // Funciona incluso sin private key
      const provider = new ethers.JsonRpcProvider(this.config.rpc);
      const contract = new ethers.Contract(
        this.config.contractAddress,
        this.contractABI,
        provider
      );
      
      const result = await contract.verifyCertificate(certificateId);
      
      return {
        exists: result[0],
        recipient: result[1],
        ipfsHash: result[2],
        timestamp: result[3].toString(),
        issuer: result[4]
      };
    } catch (error) {
      console.error('Error verifying certificate:', error);
      throw error;
    }
  }

  async batchEmitCertificates(certificates) {
    if (!this.initialized) {
      throw new Error('Blockchain service not initialized');
    }

    const results = [];
    const failed = [];
    
    for (const cert of certificates) {
      try {
        const result = await this.issueCertificate(cert);
        results.push({
          certificateId: cert.certificateId,
          ...result
        });
        
        // Delay entre transacciones para evitar problemas de nonce
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Failed to emit ${cert.certificateId}:`, error);
        failed.push({
          certificateId: cert.certificateId,
          error: error.message
        });
      }
    }
    
    return {
      successful: results,
      failed: failed,
      summary: {
        total: certificates.length,
        succeeded: results.length,
        failed: failed.length
      }
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      hasWallet: !!this.wallet,
      walletAddress: this.wallet?.address || null,
      contractAddress: this.config.contractAddress,
      rpcUrl: this.config.rpc,
      chainId: this.config.chainId,
      ...secretsManager.getSecureStatus()
    };
  }
}

module.exports = new BlockchainService();