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

module.exports = router;