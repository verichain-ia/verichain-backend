const { ethers } = require('ethers');
require('dotenv').config();

const CONTRACT_ABI = [
  "function issueCertificate(string memory id, string memory studentName, string memory courseName, string memory institution) public returns (bytes32)"
];

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC);
    const privateKey = process.env.INSTITUTIONAL_KEY;
    if (!privateKey || privateKey === '[ REDACTED ]' || privateKey.length !== 64) {
    console.error('Invalid private key configuration');
    throw new Error('Private key not properly configured');
    }
    this.wallet = new ethers.Wallet('0x' + privateKey, this.provider);
    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      CONTRACT_ABI,
      this.wallet
    );
    console.log('Blockchain service initialized with wallet:', this.wallet.address);
  }

  async issueCertificate(id, studentName, courseName, institution = 'Universidad Demo') {
    try {
      console.log(`Emitting certificate ${id} to blockchain...`);
      
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

module.exports = new BlockchainService();