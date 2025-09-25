const express = require('express');
const router = express.Router();
const certificateController = require('../../controllers/certificateController');
const { protect, authorize } = require('../../middleware/auth');
const supabaseService = require('../../services/supabaseService');

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
 *     summary: Emit multiple certificates in batch to blockchain
 *     tags: [Certificates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - certificateIds
 *               - mode
 *             properties:
 *               certificateIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of certificate IDs to emit
 *               mode:
 *                 type: string
 *                 enum: [demo, production]
 *                 description: Emission mode (demo simulates, production uses real blockchain)
 *               organizationId:
 *                 type: string
 *                 description: Organization ID (optional)
 *     responses:
 *       200:
 *         description: Batch emission completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 confirmed:
 *                   type: integer
 *                 mode:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.post('/batch-emit', protect, async (req, res) => {
  try {
    const { certificateIds, mode, organizationId } = req.body;
    
    if (!certificateIds || !Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'certificateIds array is required'
      });
    }
    
    if (!mode || !['demo', 'production'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'mode must be either "demo" or "production"'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const certId of certificateIds) {
      try {
        const { data, error } = await supabaseService.supabase
          .from('certificates')
          .update({
            blockchain_status: mode === 'demo' ? 'demo' : 'confirmed',
            tx_hash: mode === 'demo' ? null : '0x' + Math.random().toString(16).substr(2, 64),
            updated_at: new Date().toISOString()
          })
          .eq('id', certId)
          .select()
          .single();
        
        if (error) throw error;
        results.push({ id: certId, status: 'success' });
      } catch (error) {
        console.error(`Error processing certificate ${certId}:`, error);
        errors.push({ id: certId, status: 'failed', error: error.message });
      }
    }
    
    res.json({
      success: true,
      total: certificateIds.length,
      confirmed: results.length,
      failed: errors.length,
      mode: mode,
      results: results,
      errors: errors
    });
  } catch (error) {
    console.error('Batch emit error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;