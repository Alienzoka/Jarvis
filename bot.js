const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const express = require("express");
const crypto = require("crypto");

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const PORT = process.env.PORT || 3000;

const MAX_QUANTIDADE = 100;
const MAX_MODIFICADOR = 1000;

const DADOS_PERMITIDOS = [6, 12, 20, 100];

// =====================================================
// SERVIDOR HTTP
// =====================================================

const app = express();

app.get("/", (req, res) => {
    res.status(200).send(
        "🎲 Bot de dados do WhatsApp está online!"
    );
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        bot: "bot-dados-whatsapp"
    });
});

app.listen(PORT, () => {
    console.log(
        `🌐 Servidor HTTP funcionando na porta ${PORT}`
    );
});

// =====================================================
// ROLAR DADOS
// =====================================================

function rolarDados(quantidade, lados) {

    const resultados = [];

    for (let i = 0; i < quantidade; i++) {

        const resultado =
            crypto.randomInt(1, lados + 1);

        resultados.push(resultado);
    }

    return resultados;
}

// =====================================================
// CONEXÃO COM WHATSAPP
// =====================================================

let reconectando = false;

async function iniciarBot() {

    console.log(
        "🔄 Iniciando conexão com o WhatsApp..."
    );

    const { state, saveCreds } =
        await useMultiFileAuthState(
            "auth_info"
        );

    const sock = makeWASocket({

        auth: state,

        logger: P({
            level: "silent"
        }),

        markOnlineOnConnect: false,

        syncFullHistory: false,

        generateHighQualityLinkPreview: false,

        keepAliveIntervalMs: 30000,

        connectTimeoutMs: 60000,

        defaultQueryTimeoutMs: 60000
    });

    // =================================================
    // SALVAR SESSÃO
    // =================================================

    sock.ev.on(
        "creds.update",
        saveCreds
    );

    // =================================================
    // CONEXÃO
    // =================================================

    sock.ev.on(
        "connection.update",
        ({
            connection,
            lastDisconnect,
            qr
        }) => {

            if (qr) {

                console.log("");
                console.log(
                    "===================================="
                );
                console.log(
                    "📱 QR CODE GERADO"
                );
                console.log(
                    "===================================="
                );
                console.log(
                    "Escaneie usando o WhatsApp."
                );
                console.log(
                    "===================================="
                );
                console.log("");
            }

            if (connection === "open") {

                reconectando = false;

                console.log("");
                console.log(
                    "===================================="
                );
                console.log(
                    "✅ WHATSAPP CONECTADO!"
                );
                console.log(
                    "===================================="
                );
                console.log(
                    "🎲 BOT DE DADOS ONLINE!"
                );
                console.log("");
            }

            if (connection === "close") {

                const statusCode =
                    lastDisconnect
                        ?.error
                        ?.output
                        ?.statusCode;

                console.log(
                    "⚠️ Conexão encerrada."
                );

                console.log(
                    "Código:",
                    statusCode || "desconhecido"
                );

                if (
                    statusCode ===
                    DisconnectReason.loggedOut
                ) {

                    console.log(
                        "❌ WhatsApp foi desconectado."
                    );

                    return;
                }

                if (reconectando) {
                    return;
                }

                reconectando = true;

                console.log(
                    "🔄 Reconectando em 5 segundos..."
                );

                setTimeout(() => {

                    reconectando = false;

                    iniciarBot();

                }, 5000);
            }
        }
    );

    // =================================================
    // MENSAGENS
    // =================================================

    sock.ev.on(
        "messages.upsert",
        async ({ messages }) => {

            for (const msg of messages) {

                try {

                    if (!msg.message) {
                        continue;
                    }

                    if (msg.key.fromMe) {
                        continue;
                    }

                    const texto =
                        msg.message.conversation ||
                        msg.message
                            .extendedTextMessage
                            ?.text;

                    if (!texto) {
                        continue;
                    }

                    const comando =
                        texto
                            .trim()
                            .toLowerCase();

                    console.log(
                        `📩 ${comando}`
                    );

                    // =================================================
                    // COMANDOS ACEITOS
                    //
                    // #d6
                    // 3#d6
                    // #d20+5
                    // #d20-2
                    // 5#d20+3
                    // 5#d20-4
                    // #d100+10
                    //
                    // =================================================

                    const match =
                        comando.match(
                            /^(?:(\d+)#)?d(6|12|20|100)(?:([+-])(\d+))?$/
                        );

                    if (!match) {
                        continue;
                    }

                    // Quantidade
                    const quantidade =
                        match[1]
                            ? Number(match[1])
                            : 1;

                    // Tipo de dado
                    const lados =
                        Number(match[2]);

                    // Sinal do modificador
                    const sinal =
                        match[3] || "+";

                    // Valor do modificador
                    const valorModificador =
                        match[4]
                            ? Number(match[4])
                            : 0;

                    // Aplicar sinal
                    const modificador =
                        sinal === "-"
                            ? -valorModificador
                            : valorModificador;

                    // =================================================
                    // VALIDAÇÕES
                    // =================================================

                    if (
                        quantidade < 1 ||
                        quantidade > MAX_QUANTIDADE
                    ) {

                        await sock.sendMessage(
                            msg.key.remoteJid,
                            {
                                text:
                                    "❌ Você pode rolar de 1 a 100 dados."
                            }
                        );

                        continue;
                    }

                    if (
                        !DADOS_PERMITIDOS.includes(
                            lados
                        )
                    ) {

                        await sock.sendMessage(
                            msg.key.remoteJid,
                            {
                                text:
                                    "❌ Dados disponíveis: d6, d12, d20 e d100."
                            }
                        );

                        continue;
                    }

                    if (
                        valorModificador >
                        MAX_MODIFICADOR
                    ) {

                        await sock.sendMessage(
                            msg.key.remoteJid,
                            {
                                text:
                                    "❌ O modificador máximo é ±1000."
                            }
                        );

                        continue;
                    }

                    // =================================================
                    // ROLAR
                    // =================================================

                    const resultados =
                        rolarDados(
                            quantidade,
                            lados
                        );

                    // Soma dos dados
                    const soma =
                        resultados.reduce(
                            (total, valor) =>
                                total + valor,
                            0
                        );

                    // Total final
                    const total =
                        soma + modificador;

                    // =================================================
                    // RESPOSTA
                    // =================================================

                    let resposta =
                        `🎲 ${quantidade}#d${lados}`;

                    if (valorModificador !== 0) {

                        resposta +=
                            `${sinal}${valorModificador}`;
                    }

                    resposta +=
                        `\n\n${resultados.join(", ")}`;

                    if (quantidade > 1) {

                        resposta +=
                            `\n\n📊 Soma: ${soma}`;
                    }

                    if (valorModificador !== 0) {

                        resposta +=
                            `\n${sinal === "+"
                                ? "➕"
                                : "➖"} Modificador: ${sinal}${valorModificador}`;
                    }

                    resposta +=
                        `\n🔥 Total: ${total}`;

                    // =================================================
                    // ENVIAR
                    // =================================================

                    await sock.sendMessage(
                        msg.key.remoteJid,
                        {
                            text: resposta
                        }
                    );

                    // =================================================
                    // LOG
                    // =================================================

                    console.log(
                        `🎲 ${quantidade}#d${lados}${sinal}${valorModificador} → ${total}`
                    );

                } catch (erro) {

                    console.error(
                        "❌ Erro:",
                        erro
                    );
                }
            }
        }
    );
}

// =====================================================
// INICIAR BOT
// =====================================================

iniciarBot().catch((erro) => {

    console.error(
        "❌ Erro fatal:",
        erro
    );

    process.exit(1);
});

"qrcode": "^1.5.4"

🎲 BOT DE DADOS

WhatsApp
┌──────────────┐
│              │
│   QR CODE    │
│              │
└──────────────┘

Escaneie este QR Code
pelo WhatsApp