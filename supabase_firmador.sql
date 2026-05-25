-- 1. Agregar columnas a la tabla de usuarios
alter table public.users
add column if not exists can_sign_documents boolean not null default false;

alter table public.users
add column if not exists signature_image_url text default null;


-- 2. Crear la tabla de documentos de firmas
create table if not exists public.documentos_firmas (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  gdrive_file_id_temp text default null, -- Archivo original en Drive o ruta local temp
  gdrive_file_id_final text default null, -- Archivo firmado final en Drive o ruta local firmada
  estado text not null default 'PENDIENTE', -- PENDIENTE, APROBADO, RECHAZADO
  x_coord numeric not null,
  y_coord numeric not null,
  ancho numeric not null default 150,
  alto numeric not null default 80,
  pagina_num integer not null default 1,
  emisor_id uuid references public.users(id) on delete set null,
  firmante_id uuid references public.users(id) on delete set null,
  motivo_rechazo text default null,
  creado_at timestamp with time zone default timezone('utc'::text, now()) not null,
  actualizado_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Habilitar RLS (Row Level Security) - opcional si el resto de tablas lo tienen
-- alter table public.documentos_firmas enable row level security;
