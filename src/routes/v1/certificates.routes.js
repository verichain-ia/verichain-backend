const express = require('express');
const router = express.Router();
const certificateController = require('../../controllers/certificateController');
const { protect, authorize } = require('../../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Certificate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         student_name:
 *           type: string
 *         course_name:
 *           type: string
 */

/**
 * @swagger
 * /certificates:
 *   post:
 *     summary: Create a new certificate
 *     tags: [Certificates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentName
 *               - studentEmail
 *               - courseName
 *             properties:
 *               studentName:
 *                 type: string
 *               studentEmail:
 *                 type: string
 *               courseName:
 *                 type: string
 *               useBlockchain:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Certificate created successfully
 */
router.post('/', protect, certificateController.create);

/**
 * @swagger
 * /certificates:
 *   get:
 *     summary: List all certificates
 *     tags: [Certificates]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of certificates to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of certificates to skip
 *     responses:
 *       200:
 *         description: List of certificates
 */
router.get('/', certificateController.list);

/**
 * @swagger
 * /certificates/{id}:
 *   get:
 *     summary: Get a certificate by ID
 *     tags: [Certificates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Certificate details
 */
router.get('/:id', certificateController.get);

/**
 * @swagger
 * /certificates/{id}/verify:
 *   get:
 *     summary: Verify a certificate
 *     tags: [Certificates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification result
 */
router.get('/:id/verify', certificateController.verify);

/**
 * @swagger
 * /certificates/batch-emit:
 *   post:
 *     summary: Emit multiple certificates in batch
 *     tags: [Certificates]
 */
router.post('/batch-emit', async (req, res) => {
  try {
    const { certificateIds, mode, organizationId } = req.body;
    const supabaseService = require('../../services/supabaseService');
    
    console.log(`📦 Batch emit request: ${certificateIds.length} certificates in ${mode} mode`);
    
    // Si es modo demo, solo actualizar estado
    if (mode === 'demo') {
      for (const certId of certificateIds) {
        await supabaseService.client
          .from('certificates')
          .update({
            status: 'confirmed',
            blockchain_status: 'demo',
            tx_hash: 'DEMO-' + Date.now(),
            updated_at: new Date().toISOString()
          })
          .eq('certificate_id', certId);
      }
      
      return res.json({
        success: true,
        total: certificateIds.length,
        confirmed: certificateIds.length,
        mode: 'demo'
      });
    }
    
    // MODO PRODUCTION - Emisión blockchain real
    const blockchainService = require('../../services/blockchainService');
    
    // Verificar si el servicio está inicializado
    if (!blockchainService.initialized) {
      console.log('⚠️ Blockchain service not initialized, attempting to initialize...');
      await blockchainService.initialize();
      
      // Si aún no está inicializado después del intento
      if (!blockchainService.initialized) {
        return res.status(503).json({
          success: false,
          error: 'Blockchain service unavailable. Please try again later.',
          mode: 'production'
        });
      }
    }
    
    const results = [];
    const failed = [];
    
    // Obtener datos de los certificados
    const { data: certificates, error } = await supabaseService.client
      .from('certificates')
      .select('*')
      .in('certificate_id', certificateIds);
    
    if (error) {
      console.error('Error fetching certificates:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch certificates from database'
      });
    }
    
    if (!certificates || certificates.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No certificates found with provided IDs'
      });
    }
    
    console.log(`📋 Found ${certificates.length} certificates to emit`);
    
    // Emitir cada certificado
    for (const cert of certificates) {
      try {
        console.log(`🔄 Emitting certificate: ${cert.certificate_id}`);
        
        // Preparar datos para blockchain
        const certificateData = {
          certificateId: cert.certificate_id,
          recipientAddress: cert.recipient_address || '0x0000000000000000000000000000000000000000',
          ipfsHash: cert.ipfs_hash || '',
          timestamp: Math.floor(new Date(cert.issue_date).getTime() / 1000)
        };
        
        // Emitir en blockchain
        const blockchainResult = await blockchainService.issueCertificate(certificateData);
        
        if (blockchainResult && blockchainResult.success) {
          // Actualizar en DB con TX real
          await supabaseService.client
            .from('certificates')
            .update({
              status: 'confirmed',
              blockchain_status: 'confirmed',
              tx_hash: blockchainResult.transactionHash,
              block_number: blockchainResult.blockNumber,
              blockchain_network: 'paseo',
              updated_at: new Date().toISOString()
            })
            .eq('certificate_id', cert.certificate_id);
          
          results.push({
            id: cert.certificate_id,
            status: 'success',
            txHash: blockchainResult.transactionHash,
            explorerUrl: blockchainResult.explorerUrl
          });
          
          console.log(`✅ Certificate ${cert.certificate_id} emitted successfully`);
          console.log(`   TX: ${blockchainResult.transactionHash}`);
        } else {
          throw new Error(blockchainResult?.error || 'Unknown blockchain error');
        }
        
        // Delay entre emisiones para evitar problemas de nonce
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error emitting ${cert.certificate_id}:`, error.message);
        
        // Actualizar estado de error en DB
        await supabaseService.client
          .from('certificates')
          .update({
            blockchain_status: 'failed',
            blockchain_error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('certificate_id', cert.certificate_id);
        
        failed.push({
          id: cert.certificate_id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Respuesta final
    const response = {
      success: true,
      total: certificateIds.length,
      confirmed: results.length,
      failed: failed.length,
      mode: 'production',
      results: results.concat(failed)
    };
    
    console.log(`📊 Batch emit completed: ${results.length}/${certificateIds.length} successful`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Batch emit error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      mode: req.body.mode || 'unknown'
    });
  }
});
/**
 * @swagger
 * /certificates/force-init:
 *   post:
 *     summary: Force blockchain service initialization
 *     tags: [Certificates]
 */
router.post('/force-init', async (req, res) => {
  try {
    const blockchainService = require('../../services/blockchainService');
    
    console.log('🔄 Forcing blockchain service initialization...');
    await blockchainService.initialize();
    
    const status = blockchainService.getStatus();
    
    res.json({
      success: status.initialized,
      status: status
    });
  } catch (error) {
    console.error('Force init error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /certificates/blockchain-debug:
 *   get:
 *     summary: Debug blockchain service status
 *     tags: [Certificates]
 */
router.get('/blockchain-debug', async (req, res) => {
  try {
    const blockchainService = require('../../services/blockchainService');
    const config = require('../../config');
    
    // Intentar crear wallet manualmente
    const { ethers } = require('ethers');
    let walletTest = null;
    let walletError = null;
    
    try {
      const privateKey = config.blockchain.privateKey || process.env.INSTITUTIONAL_KEY;
      if (privateKey) {
        walletTest = new ethers.Wallet(privateKey);
      }
    } catch (error) {
      walletError = error.message;
    }
    
    const debugInfo = {
      service_status: blockchainService.getStatus(),
      config_check: {
        has_private_key: !!config.blockchain.privateKey,
        has_env_key: !!process.env.INSTITUTIONAL_KEY,
        key_length: config.blockchain.privateKey ? config.blockchain.privateKey.length : 0,
        rpc_configured: !!config.blockchain.rpc,
        contract_configured: !!config.blockchain.contractAddress
      },
      wallet_test: {
        success: !!walletTest,
        address: walletTest ? walletTest.address : null,
        error: walletError
      },
      raw_env_check: {
        total_env_vars: Object.keys(process.env).length,
        has_institutional_key: 'INSTITUTIONAL_KEY' in process.env,
        institutional_key_type: typeof process.env.INSTITUTIONAL_KEY
      }
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * @swagger
 * /certificates/direct-emit:
 *   post:
 *     summary: Direct blockchain emission (bypass service)
 *     tags: [Certificates]
 */
router.post('/direct-emit', async (req, res) => {
  try {
    const { ethers } = require('ethers');
    const { certificateIds } = req.body;
    
    console.log('🚀 Direct emission starting...');
    
    // Configuración directa
    const provider = new ethers.StaticJsonRpcProvider(
      'https://rpc.ibp.network/paseo',
      { chainId: 420420422, name: 'paseo' }
    );
    
    // Private key con 0x
    const privateKey = '0x364b83d0722af52837fc321dbaefd68ccae1396eede1b9a926ae4843a28afeb5';
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`💼 Wallet address: ${wallet.address}`);
    
    // Verificar balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} PAS`);
    
    // Contract
    const contractABI = [
      "function issueCertificate(string memory certificateId, address recipient, string memory ipfsHash, uint256 timestamp) public"
    ];
    
    const contract = new ethers.Contract(
      '0x96950629523b239C2B0d6dd029300dDAe19Be2Cc',
      contractABI,
      wallet
    );
    
    const results = [];
    const certIds = certificateIds || ["DEMO-2025-72978", "DEMO-2025-64511"];
    
    for (const certId of certIds) {
      try {
        console.log(`📝 Emitting: ${certId}`);
        
        const tx = await contract.issueCertificate(
          certId,
          wallet.address,
          '',
          Math.floor(Date.now() / 1000),
          {
            gasLimit: 500000n,
            maxFeePerGas: ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
          }
        );
        
        console.log(`📤 TX Hash: ${tx.hash}`);
        const receipt = await tx.wait(1);
        
        // Actualizar DB
        const supabaseService = require('../../services/supabaseService');
        await supabaseService.client
          .from('certificates')
          .update({
            status: 'confirmed',
            blockchain_status: 'confirmed',
            tx_hash: receipt.hash,
            block_number: receipt.blockNumber.toString(),
            blockchain_network: 'paseo'
          })
          .eq('certificate_id', certId);
        
        results.push({
          certificateId: certId,
          success: true,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber.toString(),
          explorerUrl: `https://paseo.subscan.io/tx/${receipt.hash}`
        });
        
        console.log(`✅ Success: ${certId} - Block: ${receipt.blockNumber}`);
        
      } catch (error) {
        console.error(`❌ Error with ${certId}:`, error.message);
        results.push({
          certificateId: certId,
          success: false,
          error: error.message
        });
      }
      
      // Delay entre emisiones
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    res.json({
      success: true,
      wallet: wallet.address,
      results: results
    });
    
  } catch (error) {
    console.error('Direct emit error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

module.exports = router;