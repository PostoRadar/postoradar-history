import { Kafka, logLevel } from "kafkajs";
import { eventoPrecoAtualizadoSchema } from "../types";
import { inserirRegistro } from "../repository/historico.repository";

const TOPICO = "preco-atualizado";
const GROUP_ID = "postoradar-history";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS ?? "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: "postoradar-history",
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.ERROR,
});

const consumer = kafka.consumer({ groupId: GROUP_ID });

/**
 * Processa uma única mensagem do tópico. Se o payload não for JSON válido ou
 * não passar na validação do schema, apenas logamos e ignoramos a mensagem —
 * uma mensagem malformada não pode derrubar o consumer.
 */
async function processarMensagem(valorBruto: string | undefined): Promise<void> {
  if (!valorBruto) {
    console.warn("[kafka] mensagem sem conteúdo ignorada");
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(valorBruto);
  } catch {
    console.error("[kafka] mensagem ignorada: JSON inválido");
    return;
  }

  const parsed = eventoPrecoAtualizadoSchema.safeParse(json);
  if (!parsed.success) {
    console.error(
      "[kafka] mensagem ignorada: falhou na validação do schema:",
      parsed.error.flatten()
    );
    return;
  }

  await inserirRegistro(parsed.data.dados);
  console.log(
    `[kafka] histórico registrado para posto ${parsed.data.dados.postoId} (${parsed.data.dados.combustivel})`
  );
}

/**
 * Conecta ao Kafka e começa a consumir o tópico "preco-atualizado".
 *
 * Importante (RNF05): se algo aqui falhar, quem chama trata o erro; o servidor
 * HTTP continua no ar. Este serviço é não-crítico e sua indisponibilidade não
 * pode travar o resto do sistema.
 */
export async function iniciarConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICO, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        await processarMensagem(message.value?.toString());
      } catch (erro) {
        // Erro ao gravar (ex.: banco fora): logamos e seguimos. O commit do
        // offset não acontece em caso de throw, mas aqui optamos por não
        // derrubar o consumer inteiro por causa de uma mensagem.
        console.error("[kafka] erro ao processar mensagem:", erro);
      }
    },
  });

  console.log(`[kafka] consumindo o tópico "${TOPICO}"`);
}

/** Desconecta o consumer de forma limpa (usado no shutdown). */
export async function pararConsumer(): Promise<void> {
  await consumer.disconnect();
}
