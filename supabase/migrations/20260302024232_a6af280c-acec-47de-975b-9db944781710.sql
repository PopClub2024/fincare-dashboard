
-- Add missing values to forma_pagamento enum
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'boleto';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'transferencia';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'debito_automatico';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'ted_doc';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'pix';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'cartao_credito';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'cartao_debito';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'dinheiro';
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'outros';

-- Add raw field for original AI output
ALTER TABLE contas_pagar_lancamentos ADD COLUMN IF NOT EXISTS forma_pagamento_raw text;
