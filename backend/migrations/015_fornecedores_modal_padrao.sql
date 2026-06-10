-- Alinha os modais de fornecedor aceitos pela tela com a regra do banco.

ALTER TABLE fornecedores
  DROP CONSTRAINT IF EXISTS fornecedores_modal_padrao_check;

ALTER TABLE fornecedores
  ADD CONSTRAINT fornecedores_modal_padrao_check CHECK (
    modal_padrao IS NULL OR modal_padrao IN (
      'rodoviario',
      'aereo',
      'maritimo',
      'ferroviario',
      'expresso',
      'motoboy',
      'correios'
    )
  );
