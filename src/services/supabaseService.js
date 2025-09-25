require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

class SupabaseService {
  constructor() {
    this.supabase = supabase;
  }

  async createCertificate(data) {
    const { data: certificate, error } = await supabase
      .from('certificates')
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return certificate;
  }

  async getCertificate(id) {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async getCertificates(limit = 100, offset = 0) {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async updateCertificate(id, updates) {
    const { data, error } = await supabase
      .from('certificates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getMetrics() {
    const { data, error } = await supabase
      .from('certificates')
      .select('*');
    
    if (error) throw error;
    
    const now = new Date();
    const thisMonth = data?.filter(cert => {
      const date = new Date(cert.issue_date || cert.created_at);
      return date.getMonth() === now.getMonth() && 
             date.getFullYear() === now.getFullYear();
    }).length || 0;
    
    return {
      total: data?.length || 0,
      confirmed: data?.filter(c => c.blockchain_status === 'confirmed').length || 0,
      pending: data?.filter(c => !c.blockchain_status || c.blockchain_status === 'pending').length || 0,
      thisMonth,
      verifications: data?.reduce((sum, c) => sum + (c.verification_count || 0), 0) || 0
    };
  }

  async getOrganization(id) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  }
}

module.exports = new SupabaseService();