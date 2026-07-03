import express from "express";
import { historicoRouter } from "./routes/historico.routes";
import { iniciarConsumer, pararConsumer } from "./kafka/consumer";

const app = express();
const PORTA = process.env.PORT ? Number(process.env.PORT) : 3335;

app.use(express.json());
app.use(historicoRouter);

app.listen(PORTA, () => {
  console.log(`postoradar-history rodando na porta ${PORTA}`);
});

// Sobe o consumer do Kafka em paralelo ao HTTP. Se o Kafka estiver fora no
// boot, NÃO derrubamos o processo (RNF05): logamos o erro e seguimos servindo
// as consultas de histórico já gravado. O serviço é não-crítico e sua
// indisponibilidade não pode travar o resto do sistema.
iniciarConsumer().catch((erro) => {
  console.error(
    "[kafka] falha ao iniciar o consumer; o HTTP continua no ar:",
    erro
  );
});

// Encerramento limpo: desconecta o consumer antes de sair.
async function encerrar(): Promise<void> {
  console.log("encerrando postoradar-history...");
  try {
    await pararConsumer();
  } catch (erro) {
    console.error("[kafka] erro ao desconectar o consumer:", erro);
  }
  process.exit(0);
}

process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);
