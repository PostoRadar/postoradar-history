-- Schema do banco do Serviço de Histórico (postoradar_history).
--
-- Cada atualização de preço recebida pelo tópico Kafka "preco-atualizado"
-- vira uma linha aqui. Registros são imutáveis: só inserimos, nunca alteramos.
--
-- Este script cria apenas a TABELA. A criação do ROLE e do DATABASE
-- (CREATE ROLE postoradar_history / CREATE DATABASE postoradar_history) é
-- responsabilidade do init.sql do postoradar-infra, junto com os outros
-- serviços (padrão "um banco por serviço"). Veja o README.

-- Necessário para gen_random_uuid() em instalações mais antigas do Postgres.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS historico_precos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id         UUID NOT NULL,
  -- Guardamos nome/bairro/cidade do posto de forma redundante de propósito:
  -- o evento já traz esses dados de graça, então o frontend consegue exibir
  -- o histórico com contexto legível sem uma segunda chamada à API principal.
  posto_nome       TEXT NOT NULL,
  bairro           TEXT NOT NULL,
  cidade           TEXT NOT NULL,
  tipo_combustivel TEXT NOT NULL,
  -- Preço anterior. Fica nulo quando é o primeiro registro daquele
  -- posto+combustível (o evento não traz preço antigo; nós o calculamos).
  preco_antigo     NUMERIC(10, 3),
  preco_novo       NUMERIC(10, 3) NOT NULL,
  autor_id         UUID NOT NULL,
  registrado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice principal da consulta de histórico (mais recente primeiro por posto).
CREATE INDEX IF NOT EXISTS idx_historico_posto_data
  ON historico_precos (posto_id, registrado_em DESC);

-- Índice usado pela busca do último preço de um posto+combustível específico,
-- necessária para descobrir o "preço antigo" de cada novo registro.
CREATE INDEX IF NOT EXISTS idx_historico_posto_combustivel_data
  ON historico_precos (posto_id, tipo_combustivel, registrado_em DESC);
