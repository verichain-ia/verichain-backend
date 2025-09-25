const supabaseService = require('../services/supabaseService');

class MetricsController {
  async getDashboard(req, res) {
    try {
      const metrics = await supabaseService.getMetrics();
      
      res.json({
        success: true,
        data: {
          ...metrics,
          costSavings: (metrics.total * 5 - metrics.total * 0.01).toFixed(2),
          efficiency: '99.8%'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching metrics',
        error: error.message
      });
    }
  }
}

module.exports = new MetricsController();