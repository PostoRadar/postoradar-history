import { Pool } from "pg";

// Pool de conexões com o Postgres do serviço de Histórico.
//
// A string de conexão vem de DATABASE_URL. O default aponta para o ambiente
// de dev local (Postgres do postoradar-infra exposto na porta 5433).
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postoradar_history:postoradar_history@localhost:5433/postoradar_history?schema=public";

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Erros de conexão ociosa não devem derrubar o processo; só logamos.
pool.on("error", (erro) => {
  console.error("[db] erro inesperado no pool do postgres:", erro);
});
