-- Up Migration
-- Adicionando a nova categoria de item ('product_direct', 'machine_mro')
ALTER TABLE produtos 
ADD COLUMN category VARCHAR(50) DEFAULT 'product_direct' CHECK (category IN ('product_direct', 'machine_mro'));

-- Documentando a migração
COMMENT ON COLUMN produtos.category IS 'Categoria de uso do item. product_direct: usado em BOM/PCP. machine_mro: peças de manutenção/OS';

-- Down Migration
-- Em caso de rollback, essas linhas seriam executadas (mantidas aqui como referência da estratégia de rollback solicitada)
-- ALTER TABLE produtos DROP COLUMN IF EXISTS category;
