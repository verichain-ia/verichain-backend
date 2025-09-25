const supabaseService = require('../services/supabaseService');
const { generateCertificateId } = require('../utils/idGenerator');

class CertificateController {
  async create(req, res) {
    try {
      const {
        studentName,
        studentEmail,
        courseName,
        issueDate,
        useBlockchain = false,
        organizationId
      } = req.body;

      // Validación básica
      if (!studentName || !studentEmail || !courseName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Generar ID único
      const certificateId = generateCertificateId(useBlockchain);

      // Preparar datos
      const certificateData = {
        id: certificateId,
        student_name: studentName,
        student_email: studentEmail,
        course_name: courseName,
        issue_date: issueDate || new Date().toISOString(),
        organization_id: organizationId || 'b1891ae6-15ef-4ce9-b48f-3442fd6d321f',
        blockchain_status: useBlockchain ? 'pending' : null,
        tx_hash: null,
        verification_count: 0,
        created_at: new Date().toISOString()
      };

      // Guardar en base de datos
      const certificate = await supabaseService.createCertificate(certificateData);

      // Si es blockchain, simular procesamiento (por ahora)
      if (useBlockchain) {
        setTimeout(async () => {
          await supabaseService.updateCertificate(certificateId, {
            blockchain_status: 'confirmed',
            tx_hash: '0x' + Math.random().toString(36).substring(2, 66),
            block_number: Math.floor(Math.random() * 1000000) + 1500000
          });
        }, 3000);
      }

      res.status(201).json({
        success: true,
        message: 'Certificate created successfully',
        data: {
          certificateId: certificate.id,
          studentName: certificate.student_name,
          courseName: certificate.course_name,
          blockchain: useBlockchain,
          status: certificate.blockchain_status
        }
      });

    } catch (error) {
      console.error('Error creating certificate:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating certificate',
        error: error.message
      });
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const certificate = await supabaseService.getCertificate(id);

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found'
        });
      }

      res.json({
        success: true,
        data: certificate
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching certificate',
        error: error.message
      });
    }
  }

  async list(req, res) {
    try {
      const { limit = 100, offset = 0 } = req.query;
      const certificates = await supabaseService.getCertificates(
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: certificates,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: certificates.length
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error listing certificates',
        error: error.message
      });
    }
  }

  async verify(req, res) {
    try {
      const { id } = req.params;
      const certificate = await supabaseService.getCertificate(id);

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: 'Certificate not found',
          valid: false
        });
      }

      // Incrementar contador de verificaciones
      await supabaseService.updateCertificate(id, {
        verification_count: (certificate.verification_count || 0) + 1
      });

      res.json({
        success: true,
        valid: true,
        data: {
          id: certificate.id,
          studentName: certificate.student_name,
          courseName: certificate.course_name,
          issueDate: certificate.issue_date,
          organization: certificate.organization_name || 'Universidad Demo',
          blockchainStatus: certificate.blockchain_status,
          txHash: certificate.tx_hash
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error verifying certificate',
        error: error.message
      });
    }
  }
}

module.exports = new CertificateController();