-- Add resumo_id FK to getnet_recebiveis_detalhado for composition tracking
ALTER TABLE public.getnet_recebiveis_detalhado 
ADD COLUMN IF NOT EXISTS resumo_id uuid REFERENCES public.getnet_recebiveis_resumo(id);

CREATE INDEX IF NOT EXISTS idx_getnet_det_resumo_id ON public.getnet_recebiveis_detalhado(resumo_id);
