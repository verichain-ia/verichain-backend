module.exports = {
  blockchain: {
    rpc: process.env.BLOCKCHAIN_RPC || 'https://paseo-rpc.dwellir.com',
    contractAddress: process.env.CONTRACT_ADDRESS || '0x96950629523b239C2B0d6dd029300dDAe19Be2Cc',
    privateKey: process.env.INSTITUTIONAL_KEY // NO default aquí por seguridad
  }
};