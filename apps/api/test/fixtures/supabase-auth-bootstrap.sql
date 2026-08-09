-- TEST-ONLY SUPABASE AUTH COMPATIBILITY BOOTSTRAP
-- 
-- Este script cria a infraestrutura minima do Supabase (schema auth e tabela auth.users)
-- para permitir que as migrations do Prisma rodem em um PostgreSQL 16 puro no ambiente E2E.
-- Ele simula apenas os campos referenciados nas migrations e nos inserts de setup dos testes.
--
-- ATENÇÃO: NÃO EXECUTAR EM STAGING/PRODUÇÃO (onde o Supabase já fornece essa infraestrutura).

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    instance_id UUID,
    email TEXT UNIQUE,
    aud TEXT,
    role TEXT,
    encrypted_password TEXT,
    raw_user_meta_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
