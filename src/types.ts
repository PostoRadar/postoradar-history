import { z } from "zod";

// Contrato do evento publicado pela API principal no tópico "preco-atualizado".
//
// O evento vem envelopado: os metadados ficam no nível de fora e os dados de
// negócio ficam dentro de "dados". Este serviço não confia cegamente no que
// chega do Kafka, então valida tudo com zod antes de gravar.

// Dados de negócio de uma atualização de preço.
export const dadosPrecoAtualizadoSchema = z.object({
  postoId: z.string(),
  nomePosto: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  combustivel: z.string(),
  valor: z.number(),
  reportadoPor: z.string(),
  // Data em que o preço foi atualizado na origem (ISO 8601).
  atualizadoEm: z.string().datetime(),
});

// Envelope completo do evento, do jeito que chega na mensagem do Kafka.
export const eventoPrecoAtualizadoSchema = z.object({
  // Literal: só aceitamos este tipo de evento neste tópico.
  evento: z.literal("preco-atualizado"),
  eventId: z.string(),
  ocorridoEm: z.string().datetime(),
  dados: dadosPrecoAtualizadoSchema,
});

export type DadosPrecoAtualizado = z.infer<typeof dadosPrecoAtualizadoSchema>;
export type EventoPrecoAtualizado = z.infer<typeof eventoPrecoAtualizadoSchema>;

// Query params aceitos por GET /postos/:id/historico.
//
// Como vêm da querystring (sempre string), fazemos coerção/parse aqui:
//  - limite: default 50, máximo 200
//  - antesDe: cursor de paginação por data (ISO 8601), opcional
export const historicoQuerySchema = z.object({
  limite: z.coerce.number().int().positive().max(200).default(50),
  antesDe: z.string().datetime().optional(),
});

export type HistoricoQuery = z.infer<typeof historicoQuerySchema>;

// Um registro de histórico, do jeito que sai do banco / vai pra resposta.
export type RegistroHistorico = {
  id: string;
  postoId: string;
  postoNome: string;
  bairro: string;
  cidade: string;
  tipoCombustivel: string;
  precoAntigo: number | null;
  precoNovo: number;
  autorId: string;
  registradoEm: string;
};
