
      const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const PORT = process.env.PORT || 3000;

const MAX_QUANTIDADE = 100;
const MAX_MODIFICADOR = 1000;

const DADOS_PERMITIDOS = [6, 12, 20, 100];

// Guarda o QR atual
let qrAtual = null;

// Estado do WhatsApp
let whatsappConectado = false;

// =====================================================
// SERVIDOR WEB
// =====================================================

const app = express();

app.get("/", async (req, res) => {

    if (whatsappConectado) {

        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width, initial-scale=1.0">

                <meta http-equiv="refresh" content="10">

                <title>🎲 Bot de Dados</title>

                <style>
                    body {
                        background: #111;
                        color: white;
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 40px 20px;
                    }

                    .box {
                        max-width: 500px;
                        margin: auto;
                        padding: 30px;
                        background: #1e1e1e;
                        border-radius: 20px;
                    }

                    h1 {
                        font-size: 30px;
                    }

                    .online {
                        color: #00ff88;
                        font-size: 20px;
                        font-weight: bold;
                    }
                </style>
            </head>

            <body>

                <div class="box">

                    <h1>🎲 Bot de Dados</h1>

                    <p class="online">
                        🟢 WhatsApp conectado!
                    </p>

                    <p>
                        O bot está funcionando normalmente.
                    </p>

                    <p>
                        🎲 #d6<br>
                        🎲 #d12<br>
                        🎲 #d20<br>
                        🎲 #d100
                    </p>

                </div>

            </body>
            </html>
        `);

        return;
    }

    if (!qrAtual) {

        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">

            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width, initial-scale=1.0">

                <meta http-equiv="refresh" content="5">

                <title>🎲 Bot de Dados</title>

                <style>
                    body {
                        background: #111;
                        color: white;
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 40px 20px;
                    }

                    .box {
                        max-width: 500px;
                        margin: auto;
                        padding: 30px;
                        background: #1e1e1e;
                        border-radius: 20px;
                    }

                    .loading {
                        font-size: 20px;
                    }
                </style>

            </head>

            <body>

                <div class="box">

                    <h1>🎲 Bot de Dados</h1>

                    <p class="loading">
                        ⏳ Aguardando QR Code...
                    </p>

                    <p>
                        Atualize a página em alguns segundos.
                    </p>

                </div>

            </body>
            </html>
        `);

        return;
    }

    res.send(`
        <!DOCTYPE html>

        <html lang="pt-BR">

        <head>

            <meta charset="UTF-8">

            <meta name="viewport"
                  content="width=device-width, initial-scale=1.0">

            <meta http-equiv="refresh" content="5">

            <title>🎲 Conectar WhatsApp</title>

            <style>

                body {
                    background: #111;
                    color: white;
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 25px 15px;
                }

                .box {
                    max-width: 500px;
                    margin: auto;
                    padding: 25px;
                    background: #1e1e1e;
                    border-radius: 20px;
                }

                h1 {
                    font-size: 28px;
                }

                .qr {
                    background: white;
                    padding: 15px;
                    border-radius: 15px;
                    display: inline-block;
                    margin: 20px 0;
                }

                .qr img {
                    width: 280px;
                    max-width: 80vw;
                }

                .instruction {
                    font-size: 17px;
                    line-height: 1.6;
                }

            </style>

        </head>

        <body>

            <div class="box">

                <h1>🎲 Bot de Dados</h1>

                <h2>📱 Conectar WhatsApp</h2>

                <div class="qr">

                    <img src="${qrAtual}" alt="QR Code">

                </div>

                <div class="instruction">

                    <p>
                        Abra o WhatsApp no celular.
                    </p>

                    <p>
                        Vá em:
                    </p>

                    <strong>
                        Configurações → Dispositivos conectados
                    </strong>

                    <p>
                        Depois toque em
                        <strong>Conectar dispositivo</strong>
                        e escaneie o QR Code acima.
                    </p>

                </div>

            </div>

        </body>

        </html>
    `);
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {

    res.status(200).json({
        status: "online",
        whatsapp: whatsappConectado
            ? "connected"
            : "waiting"
    });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, () => {

    console.log(
        `🌐 Servidor funcionando na porta ${PORT}`
    );

});

// =====================================================
// ROLAR DADOS
// =====================================================

function rolarDados(quantidade, lados) {

    const resultados = [];

    for (let i = 0; i < quantidade; i++) {

        resultados.push(
            crypto.randomInt(1, lados + 1)
        );

    }

    return resultados;
}

// =====================================================
// CONEXÃO WHATSAPP
// =====================================================

let reconectando = false;

async function iniciarBot() {

    console.log(
        "🔄 Iniciando WhatsApp..."
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
    // SALVAR CREDENCIAIS
    // =================================================

    sock.ev.on(
        "creds.update",
        saveCreds
    );

    // =================================================
    // ATUALIZAÇÃO DA CONEXÃO
    // =================================================

    sock.ev.on(
        "connection.update",
        async ({
            connection,
            lastDisconnect,
            qr
        }) => {

            // -----------------------------------------
            // NOVO QR
            // -----------------------------------------

            if (qr) {

                console.log(
                    "📱 Novo QR Code recebido."
                );

                try {

                    qrAtual =
                        await QRCode.toDataURL(qr);

                    whatsappConectado = false;

                    console.log(
                        "✅ QR Code disponível na página web."
                    );

                } catch (erro) {

                    console.error(
                        "❌ Erro ao gerar QR:",
                        erro
                    );

                }

            }

            // -----------------------------------------
            // CONECTADO
            // -----------------------------------------

            if (connection === "open") {

                whatsappConectado = true;

                qrAtual = null;

                reconectando = false;

                console.log("");
                console.log(
                    "================================="
                );
                console.log(
                    "✅ WHATSAPP CONECTADO!"
                );
                console.log(
                    "🎲 BOT DE DADOS ONLINE!"
                );
                console.log(
                    "================================="
                );
                console.log("");

            }

            // -----------------------------------------
            // DESCONECTADO
            // -----------------------------------------

            if (connection === "close") {

                whatsappConectado = false;

                const statusCode =
                    lastDisconnect
                        ?.error
                        ?.output
                        ?.statusCode;

                console.log(
                    "⚠️ WhatsApp desconectado."
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
                        "❌ Sessão encerrada pelo usuário."
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
    // RECEBER MENSAGENS
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
                    // COMANDOS
                    //
                    // #d6
                    // 5#d6
                    // #d20+5
                    // 5#d20-4
                    //
                    // =================================================

                    const match =
                        comando.match(
                            /^(?:(\d+)#)?d(6|12|20|100)(?:([+-])(\d+))?$/
                        );

                    if (!match) {
                        continue;
                    }

                    const quantidade =
                        match[1]
                            ? Number(match[1])
                            : 1;

                    const lados =
                        Number(match[2]);

                    const sinal =
                        match[3] || "+";

                    const valorModificador =
                        match[4]
                            ? Number(match[4])
                            : 0;

                    const modificador =
                        sinal === "-"
                            ? -valorModificador
                            : valorModificador;

                    // =================================================
                    // VALIDAR QUANTIDADE
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

                    // =================================================
                    // VALIDAR DADO
                    // =================================================

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

                    // =================================================
                    // VALIDAR MODIFICADOR
                    // =================================================

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

                    const soma =
                        resultados.reduce(
                            (total, valor) =>
                                total + valor,
                            0
                        );

                    const total =
                        soma + modificador;

                    // =================================================
                    // RESPOSTA
                    // =================================================

                    let resposta =
                        `🎲 ${quantidade}#d${lados}`;

                    if (
                        valorModificador !== 0
                    ) {

                        resposta +=
                            `${sinal}${valorModificador}`;

                    }

                    resposta +=
                        `\n\n${resultados.join(", ")}`;

                    if (
                        quantidade > 1
                    ) {

                        resposta +=
                            `\n\n📊 Soma: ${soma}`;

                    }

                    if (
                        valorModificador !== 0
                    ) {

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

                    console.log(
                        `🎲 ${quantidade}#d${lados}${sinal}${valorModificador} → ${total}`
                    );

                } catch (erro) {

                    console.error(
                        "❌ Erro ao processar mensagem:",
                        erro
                    );

                }

            }

        }
    );
}

// =====================================================
// INICIAR
// =====================================================

iniciarBot().catch((erro) => {

    console.error(
        "❌ Erro fatal:",
        erro
    );

    process.exit(1);

});