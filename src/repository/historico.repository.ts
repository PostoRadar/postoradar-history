import { pool } from "../db/pool";
import {
  DadosPrecoAtualizado,
  HistoricoQuery,
  RegistroHistorico,
} from "../types";

// Colunas devolvidas em toda consulta de histórico. Mantemos posto_nome,
// bairro e cidade aqui para o frontend exibir o histórico com contexto legível.
const COLUNAS_SELECT = `
  id,
  posto_id,
  posto_nome,
  bairro,
  cidade,
  tipo_combustivel,
  preco_antigo,
  preco_novo,
  autor_id,
  registrado_em
`;

export type QueryHistorico = {
  texto: string;
  valores: unknown[];
};

/**
 * Monta a query SQL (texto + valores parametrizados) da consulta de histórico
 * de um posto. Função pura, sem tocar no banco, justamente para ser testável
 * sem infraestrutura.
 *
 * Regras:
 *  - sempre filtra por posto_id
 *  - se "antesDe" for informado, traz só registros anteriores àquela data
 *    (cursor de paginação)
 *  - sempre ordena do mais recente para o mais antigo (registrado_em DESC)
 *  - sempre aplica o LIMIT
 */
export function montarQueryHistorico(
  postoId: string,
  query: HistoricoQuery
): QueryHistorico {
  const valores: unknown[] = [postoId];
  const condicoes = ["posto_id = $1"];

  if (query.antesDe) {
    valores.push(query.antesDe);
    condicoes.push(`registrado_em < $${valores.length}`);
  }

  valores.push(query.limite);
  const limiteParam = `$${valores.length}`;

  const texto = `
    SELECT ${COLUNAS_SELECT}
    FROM historico_precos
    WHERE ${condicoes.join(" AND ")}
    ORDER BY registrado_em DESC
    LIMIT ${limiteParam}
  `;

  return { texto, valores };
}

// Converte uma linha crua do banco no formato de resposta (camelCase).
function mapearLinha(linha: any): RegistroHistorico {
  return {
    id: linha.id,
    postoId: linha.posto_id,
    postoNome: linha.posto_nome,
    bairro: linha.bairro,
    cidade: linha.cidade,
    tipoCombustivel: linha.tipo_combustivel,
    // NUMERIC volta como string no driver pg; normalizamos para número.
    precoAntigo: linha.preco_antigo === null ? null : Number(linha.preco_antigo),
    precoNovo: Number(linha.preco_novo),
    autorId: linha.autor_id,
    registradoEm:
      linha.registrado_em instanceof Date
        ? linha.registrado_em.toISOString()
        : String(linha.registrado_em),
  };
}

/**
 * Busca o último preço já registrado para um posto+combustível.
 * É assim que descobrimos o "preço antigo" de um novo registro, já que o
 * evento não traz esse dado. Retorna null se nunca houve registro.
 */
export async function buscarUltimoPreco(
  postoId: string,
  tipoCombustivel: string
): Promise<number | null> {
  const resultado = await pool.query(
    `SELECT preco_novo
     FROM historico_precos
     WHERE posto_id = $1 AND tipo_combustivel = $2
     ORDER BY registrado_em DESC
     LIMIT 1`,
    [postoId, tipoCombustivel]
  );

  if (resultado.rowCount === 0) {
    return null;
  }

  return Number(resultado.rows[0].preco_novo);
}

/**
 * Insere um novo registro de histórico a partir dos dados do evento.
 * Antes de inserir, calcula o preço antigo consultando o último registro
 * daquele posto+combustível.
 */
export async function inserirRegistro(
  dados: DadosPrecoAtualizado
): Promise<void> {
  const precoAntigo = await buscarUltimoPreco(dados.postoId, dados.combustivel);

  await pool.query(
    `INSERT INTO historico_precos (
       posto_id, posto_nome, bairro, cidade, tipo_combustivel,
       preco_antigo, preco_novo, autor_id, registrado_em
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      dados.postoId,
      dados.nomePosto,
      dados.bairro,
      dados.cidade,
      dados.combustivel,
      precoAntigo,
      dados.valor,
      dados.reportadoPor,
      dados.atualizadoEm,
    ]
  );
}

/**
 * Consulta o histórico de um posto, do mais recente para o mais antigo,
 * com paginação por cursor de data.
 */
export async function buscarHistorico(
  postoId: string,
  query: HistoricoQuery
): Promise<RegistroHistorico[]> {
  const { texto, valores } = montarQueryHistorico(postoId, query);
  const resultado = await pool.query(texto, valores);
  return resultado.rows.map(mapearLinha);
}
