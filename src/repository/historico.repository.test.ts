import { describe, it, expect } from "vitest";
import { montarQueryHistorico } from "./historico.repository";
import { HistoricoQuery } from "../types";

// Normaliza espaços em branco para facilitar as asserções sobre o SQL.
function normalizar(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

const POSTO_ID = "uuid-do-posto";

describe("montarQueryHistorico", () => {
  it("monta a query sem antesDe usando só posto_id e limite", () => {
    const query: HistoricoQuery = { limite: 50 };
    const { texto, valores } = montarQueryHistorico(POSTO_ID, query);
    const sql = normalizar(texto);

    expect(sql).toContain("WHERE posto_id = $1");
    expect(sql).not.toContain("registrado_em <");
    expect(sql).toContain("LIMIT $2");
    expect(valores).toEqual([POSTO_ID, 50]);
  });

  it("inclui o filtro de cursor quando antesDe é informado", () => {
    const query: HistoricoQuery = {
      limite: 20,
      antesDe: "2026-07-01T12:00:00.000Z",
    };
    const { texto, valores } = montarQueryHistorico(POSTO_ID, query);
    const sql = normalizar(texto);

    expect(sql).toContain("posto_id = $1");
    expect(sql).toContain("registrado_em < $2");
    expect(sql).toContain("LIMIT $3");
    expect(valores).toEqual([POSTO_ID, "2026-07-01T12:00:00.000Z", 20]);
  });

  it("sempre ordena por registrado_em DESC", () => {
    const comCursor = normalizar(
      montarQueryHistorico(POSTO_ID, {
        limite: 10,
        antesDe: "2026-07-01T12:00:00.000Z",
      }).texto
    );
    const semCursor = normalizar(
      montarQueryHistorico(POSTO_ID, { limite: 10 }).texto
    );

    expect(comCursor).toContain("ORDER BY registrado_em DESC");
    expect(semCursor).toContain("ORDER BY registrado_em DESC");
  });

  it("sempre inclui posto_nome, bairro e cidade no SELECT", () => {
    const sql = normalizar(
      montarQueryHistorico(POSTO_ID, { limite: 50 }).texto
    );

    expect(sql).toContain("posto_nome");
    expect(sql).toContain("bairro");
    expect(sql).toContain("cidade");
  });
});
