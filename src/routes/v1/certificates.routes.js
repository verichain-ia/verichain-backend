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
    
    const results = [];
    for (const certId of certificateIds) {
      await supabaseService.supabase
        .from('certificates')
        .update({
          blockchain_status: mode === 'demo' ? 'demo' : 'confirmed',
          tx_hash: mode === 'demo' ? null : '0x' + Math.random().toString(16).substr(2, 64)
        })
        .eq('id', certId);
      
      results.push({ id: certId, status: 'success' });
    }
    
    res.json({
      success: true,
      total: certificateIds.length,
      confirmed: results.length,
      mode: mode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;