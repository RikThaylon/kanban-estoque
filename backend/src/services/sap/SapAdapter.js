class SapAdapter {
  constructor() {
    // Interface para futura implementação de conexão (OData, RFC, REST, etc)
  }

  async connect() {
    throw new Error('Not implemented: SAP integration is pending.');
  }

  async fetchMaterials() {
    throw new Error('Not implemented: SAP integration is pending.');
  }

  async fetchStock() {
    throw new Error('Not implemented: SAP integration is pending.');
  }
}

module.exports = { SapAdapter };
