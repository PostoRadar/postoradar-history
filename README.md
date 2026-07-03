# postoradar-history

Serviço de **Histórico** do PostoRadar (projeto de Sistemas Distribuídos —
UFRPE).

Ele faz duas coisas:

1. **Consome** o tópico Kafka `preco-atualizado`, publicado pela API principal
   (`postoradar-api`) toda vez que um preço é atualizado, e grava cada
   atualização como um registro **imutável** de histórico.
2. **Expõe** `GET /postos/:id/historico` para consultar esse histórico, do mais
   recente para o mais antigo, com paginação simples.

O serviço é **stateful**: tem seu próprio banco Postgres (`postoradar_history`),
separado dos outros serviços, seguindo o padrão "um banco por serviço" já usado
no projeto.

## Por que Kafka em vez de REST síncrono?

A comunicação com a API principal é feita por **mensageria assíncrona**, não por
uma chamada REST síncrona, por três razões ligadas aos requisitos não-funcionais
do projeto:

- **RNF02 (Comunicação):** eventos de atualização de preço são justamente o caso
  em que o requisito manda usar mensageria assíncrona (REST/HTTP fica para a
  comunicação síncrona entre módulos; eventos vão por mensageria).
- **RNF05 (Disponibilidade):** o Histórico é um módulo **não-crítico**. Se ele
  cair, a API principal continua atualizando preços normalmente — ela só publica
  o evento e segue a vida, sem esperar por este serviço. Da mesma forma, se o
  Kafka estiver fora quando este serviço sobe, o HTTP de consulta continua no ar
  servindo o histórico já gravado.
- **RNF06 (Tolerância a Falhas):** eventos de atualização **não podem ser
  perdidos**. Com o Kafka retendo as mensagens, se este consumidor ficar
  temporariamente indisponível, ao voltar ele retoma do offset e processa o que
  perdeu — nada de escrever "em cima" da API principal e perder eventos.

## Contrato do evento

Tópico: `preco-atualizado` — chave da mensagem: o `eventId`.

O evento vem **envelopado**: metadados no nível de fora, dados de negócio dentro
de `dados`.

```json
{
  "evento": "preco-atualizado",
  "eventId": "uuid-do-evento",
  "ocorridoEm": "2026-07-01T12:00:00.000Z",
  "dados": {
    "postoId": "uuid-do-posto",
    "nomePosto": "Posto Boa Viagem",
    "bairro": "Boa Viagem",
    "cidade": "Recife",
    "latitude": -8.12,
    "longitude": -34.90,
    "combustivel": "gasolina",
    "valor": 5.99,
    "reportadoPor": "uuid-do-usuario",
    "atualizadoEm": "2026-07-01T12:00:00.000Z"
  }
}
```

Mensagens que não forem JSON válido ou que não passarem na validação do schema
(`evento` diferente de `"preco-atualizado"`, campo faltando ou com tipo errado)
são **logadas e ignoradas** — uma mensagem malformada não derruba o consumer.

## Como o "preço antigo" é calculado

O evento **não traz** o preço antigo. Este serviço descobre isso sozinho:

> Antes de inserir um novo registro, ele consulta o **último registro já salvo
> por este mesmo serviço** para aquele `postoId` + `combustivel` (ordenado por
> `registrado_em DESC`, `LIMIT 1`) e usa o `preco_novo` daquele registro como
> `preco_antigo` do novo. Se não houver registro anterior, `preco_antigo` fica
> `null` (primeiro preço conhecido daquele posto+combustível).

Guardamos também `posto_nome`, `bairro` e `cidade` na tabela, mesmo sendo
redundante com o que a API principal tem, porque o evento já traz esses dados de
graça — assim o frontend exibe o histórico com contexto legível sem precisar de
uma segunda chamada.

## Endpoints

### `GET /postos/:id/historico`

Histórico de um posto, do mais recente para o mais antigo.

Query params opcionais:

| Param     | Tipo               | Default | Descrição                                                        |
| --------- | ------------------ | ------- | ---------------------------------------------------------------- |
| `limite`  | inteiro (máx. 200) | `50`    | Quantos registros trazer.                                        |
| `antesDe` | ISO 8601           | —       | Cursor de paginação: traz registros com `registradoEm` anterior. |

Para paginar, use o `registradoEm` do último item da página anterior como
`antesDe` da próxima chamada.

**Request:**

```
GET /postos/uuid-do-posto/historico?limite=2
```

**Response `200`:**

```json
{
  "postoId": "uuid-do-posto",
  "limite": 2,
  "registros": [
    {
      "id": "8f1c...",
      "postoId": "uuid-do-posto",
      "postoNome": "Posto Boa Viagem",
      "bairro": "Boa Viagem",
      "cidade": "Recife",
      "tipoCombustivel": "gasolina",
      "precoAntigo": 5.79,
      "precoNovo": 5.99,
      "autorId": "uuid-do-usuario",
      "registradoEm": "2026-07-01T12:00:00.000Z"
    },
    {
      "id": "2a44...",
      "postoId": "uuid-do-posto",
      "postoNome": "Posto Boa Viagem",
      "bairro": "Boa Viagem",
      "cidade": "Recife",
      "tipoCombustivel": "gasolina",
      "precoAntigo": null,
      "precoNovo": 5.79,
      "autorId": "uuid-do-usuario",
      "registradoEm": "2026-06-28T09:30:00.000Z"
    }
  ]
}
```

### `GET /health`

```json
{ "status": "ok", "servico": "postoradar-history" }
```

## Como rodar localmente

Pré-requisitos: Postgres e Kafka no ar. Em geral eles sobem pelo
`postoradar-infra` (`docker compose up`), que expõe o Postgres em `5433` e o
Kafka em `9092`.

```bash
npm install
npm run dev      # sobe com tsx watch (hot reload)
# ou
npm run build && npm start
```

Variáveis de ambiente (veja `.env.example`):

| Variável        | Default                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `PORT`          | `3335`                                                                                            |
| `DATABASE_URL`  | `postgresql://postoradar_history:postoradar_history@localhost:5433/postoradar_history?schema=public` |
| `KAFKA_BROKERS` | `localhost:9092`                                                                                 |

## Banco de dados

A **tabela** `historico_precos` fica em [`postgres/init.sql`](postgres/init.sql)
(deste repositório).

O **role e o database**, porém, são criados pelo `init.sql` do repositório
`postoradar-infra`, junto com os dos outros serviços. **Passo manual pendente:**
adicionar lá as linhas:

```sql
CREATE ROLE postoradar_history LOGIN PASSWORD 'postoradar_history';
CREATE DATABASE postoradar_history OWNER postoradar_history;
```

Depois de criado o database, aplique o schema da tabela:

```bash
psql "postgresql://postoradar_history:postoradar_history@localhost:5433/postoradar_history" \
  -f postgres/init.sql
```

## Testes

```bash
npm test
```

Cobrem a lógica pura, sem infraestrutura externa:

- validação do schema zod do evento (`src/types.test.ts`);
- montagem da query de histórico `montarQueryHistorico`
  (`src/repository/historico.repository.test.ts`).
