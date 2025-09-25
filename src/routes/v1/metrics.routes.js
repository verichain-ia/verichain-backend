const express = require('express');
const router = express.Router();
const metricsController = require('../../controllers/metricsController');

/**
 * @swagger
 * /metrics/dashboard:
 *   get:
 *     summary: Get dashboard metrics
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Dashboard metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/dashboard', metricsController.getDashboard);

module.exports = router;