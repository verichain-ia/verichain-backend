function generateCertificateId(useBlockchain = false) {
  const prefix = useBlockchain ? 'TECH' : 'DEMO';
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `${prefix}-${year}-${random}`;
}

module.exports = {
  generateCertificateId
};