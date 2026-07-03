import { describe, it, expect } from "vitest";
import { eventoPrecoAtualizadoSchema } from "./types";

// Payload válido de referência, no formato exato publicado pela API principal.
function eventoValido() {
  return {
    evento: "preco-atualizado",
    eventId: "uuid-do-evento",
    ocorridoEm: "2026-07-01T12:00:00.000Z",
    dados: {
      postoId: "uuid-do-posto",
      nomePosto: "Posto Boa Viagem",
      bairro: "Boa Viagem",
      cidade: "Recife",
      latitude: -8.12,
      longitude: -34.9,
      combustivel: "gasolina",
      valor: 5.99,
      reportadoPor: "uuid-do-usuario",
      atualizadoEm: "2026-07-01T12:00:00.000Z",
    },
  };
}

describe("eventoPrecoAtualizadoSchema", () => {
  it("aceita um payload válido", () => {
    const resultado = eventoPrecoAtualizadoSchema.safeParse(eventoValido());
    expect(resultado.success).toBe(true);
  });

  it('rejeita quando "evento" é diferente de "preco-atualizado"', () => {
    const payload = { ...eventoValido(), evento: "outro-evento" };
    const resultado = eventoPrecoAtualizadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it('rejeita quando falta o campo "dados"', () => {
    const payload = eventoValido() as Record<string, unknown>;
    delete payload.dados;
    const resultado = eventoPrecoAtualizadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("rejeita quando falta um campo obrigatório dentro de dados", () => {
    const payload = eventoValido();
    delete (payload.dados as Record<string, unknown>).valor;
    const resultado = eventoPrecoAtualizadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it('rejeita "atualizadoEm" que não é ISO 8601 válido', () => {
    const payload = eventoValido();
    payload.dados.atualizadoEm = "01/07/2026";
    const resultado = eventoPrecoAtualizadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });
});
