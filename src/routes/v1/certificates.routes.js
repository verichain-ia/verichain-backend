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
    
    // Si es modo demo, solo actualizar estado
    if (mode === 'demo') {
      for (const certId of certificateIds) {
        await supabaseService.supabase
          .from('certificates')
          .update({
            blockchain_status: 'demo',
            tx_hash: 'DEMO-' + Date.now()
          })
          .eq('id', certId);
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
    const results = [];
    
    // Obtener datos de los certificados
    const { data: certificates } = await supabaseService.supabase
      .from('certificates')
      .select('*')
      .in('id', certificateIds);
    
    // Emitir en lotes de 5
    const batchSize = 5;
    for (let i = 0; i < certificates.length; i += batchSize) {
      const batch = certificates.slice(i, i + batchSize);
      
      for (const cert of batch) {
        try {
          const blockchainResult = await blockchainService.issueCertificate(
            cert.id,
            cert.student_name,
            cert.course_name,
            'Universidad Demo'
          );
          
          if (blockchainResult.success) {
            // Actualizar en DB con TX real
            await supabaseService.supabase
              .from('certificates')
              .update({
                blockchain_status: 'confirmed',
                tx_hash: blockchainResult.txHash,
                block_number: blockchainResult.blockNumber
              })
              .eq('id', cert.id);
            
            results.push({ 
              id: cert.id, 
              status: 'success',
              txHash: blockchainResult.txHash 
            });
          } else {
            results.push({ 
              id: cert.id, 
              status: 'failed',
              error: blockchainResult.error 
            });
          }
        } catch (error) {
          console.error(`Error emitting ${cert.id}:`, error);
          results.push({ 
            id: cert.id, 
            status: 'error',
            error: error.message 
          });
        }
      }
      
      // Delay entre lotes
      if (i + batchSize < certificates.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    res.json({
      success: true,
      total: certificateIds.length,
      confirmed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status !== 'success').length,
      mode: 'production',
      results: results
    });
    
  } catch (error) {
    console.error('Batch emit error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;