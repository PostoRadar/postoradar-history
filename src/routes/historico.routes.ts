import { Router, Request, Response } from "express";
import { historicoQuerySchema } from "../types";
import { buscarHistorico } from "../repository/historico.repository";

export const historicoRouter = Router();

/**
 * GET /postos/:id/historico
 *
 * Consulta o histórico de preços de um posto, do mais recente para o mais
 * antigo. Query params opcionais:
 *  - limite: quantos registros trazer (default 50, máximo 200)
 *  - antesDe: cursor de paginação (ISO 8601) — traz registros anteriores a
 *    essa data. Use o "registradoEm" do último item da página anterior.
 */
historicoRouter.get(
  "/postos/:id/historico",
  async (req: Request, res: Response) => {
    const parsed = historicoQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        erro: "Parâmetros de consulta inválidos",
        detalhes: parsed.error.flatten(),
      });
    }

    try {
      const registros = await buscarHistorico(req.params.id, parsed.data);
      return res.status(200).json({
        postoId: req.params.id,
        limite: parsed.data.limite,
        registros,
      });
    } catch (erro) {
      console.error("[http] erro ao consultar histórico:", erro);
      return res.status(500).json({ erro: "Erro ao consultar histórico" });
    }
  }
);

historicoRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", servico: "postoradar-history" });
});
