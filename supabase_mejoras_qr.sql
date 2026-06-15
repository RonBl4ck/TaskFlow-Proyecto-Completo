-- Script SQL para mejorar la tabla public.documentos_firmas de Supabase
-- Añade soporte para configurar la ubicación del Código QR de forma independiente de la firma.

ALTER TABLE public.documentos_firmas
ADD COLUMN IF NOT EXISTS qr_x_coord NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS qr_y_coord NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS qr_ancho NUMERIC DEFAULT 70,
ADD COLUMN IF NOT EXISTS qr_alto NUMERIC DEFAULT 70,
ADD COLUMN IF NOT EXISTS qr_pagina_num INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.documentos_firmas.qr_x_coord IS 'Coordenada X del código QR en el PDF (origen abajo-izquierda)';
COMMENT ON COLUMN public.documentos_firmas.qr_y_coord IS 'Coordenada Y del código QR en el PDF (origen abajo-izquierda)';
COMMENT ON COLUMN public.documentos_firmas.qr_ancho IS 'Ancho del código QR en puntos PDF';
COMMENT ON COLUMN public.documentos_firmas.qr_alto IS 'Alto del código QR en puntos PDF';
COMMENT ON COLUMN public.documentos_firmas.qr_pagina_num IS 'Número de página donde se estampará el código QR (1-indexed)';
