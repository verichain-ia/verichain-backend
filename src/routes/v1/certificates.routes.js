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

module.exports = router;