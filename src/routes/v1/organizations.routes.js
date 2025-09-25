const router = require('express').Router();
const { authenticateToken } = require('../../middleware/auth');

// GET todas las organizaciones
router.get('/', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('organizations')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET una organización
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('organizations')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: 'Organization not found'
    });
  }
});

// POST crear organización (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, code } = req.body;
    
    const { data, error } = await req.supabase
      .from('organizations')
      .insert([{ name, code }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;