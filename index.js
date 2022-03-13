require('dotenv').config()
const lp = require('node-lp')
const { Telegraf, Markup } = require('telegraf')
const fs = require('fs')
const html2Pdf = require('html-pdf-node')
const axios = require('axios')
const stream = require('stream')
const { promisify } = require('util')

const finished = promisify(stream.finished)

const html2PdfOptions = { format: 'A4', pageRanges: '1' }

const daysArray = [7, 0, 1, 2, 3, 4, 5, 6]

const bot = new Telegraf(process.env.BOT_TOKEN)

const printer = lp({})

function log (txt) {
  console.log(`[${new Date().toLocaleString()}]`, txt)
}

function checkChatIdAuthorized (chatId) {
  if (!fs.existsSync('./authorizedChatIds.json')) {
    fs.writeFileSync('./authorizedChatIds.json', JSON.stringify([]))
  }
  const authorizedChatIds = JSON.parse(fs.readFileSync('./authorizedChatIds.json'))
  log(`ChatId: ${chatId} / Authorized: ${authorizedChatIds.includes(chatId)}`)
  return authorizedChatIds.includes(chatId)
}

async function downloadFile (fileUrl, outputLocationPath) {
  const writer = fs.createWriteStream(outputLocationPath)
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream'
  }).then(async response => {
    response.data.pipe(writer)
    return finished(writer)
  })
}

async function sendImagePrintRequest (ctx, msgLog, photoFileId) {
  try {
    const photoUrl = await ctx.telegram.getFileLink(photoFileId).catch((err) => { log(err) }).then((link) => link.href)
    log(photoUrl)
    const date = new Date()
    for (let i = 1; i <= 7; i++) if ((date.getDay() !== daysArray[i]) && (date.getDay() !== daysArray[i] + 1) && (fs.existsSync(`./pdfTemp/${daysArray[i]}`))) fs.rmSync(`./pdfTemp/${daysArray[i]}`, { recursive: true })
    const id = `${date.getDay()}-${ctx.message.chat.id.toString().replace('-', 'G')}-${ctx.message.message_id}`
    const idArray = id.split('-')
    const dir = `./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}`
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(🔁) Gerando PDF! Aguarde...', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id })
    const html = {
      content: `
            <html>

            <head>
                <style>
                    body {
                        height: 284.44mm;
                        width: 210mm;
                        /* border: 1px solid red; */
                        display: table-cell;
                        vertical-align: middle;
                        text-align: center;
                    }
            
                    #page {
                        height: 94.5%;
                        width: 95%;
                        /* border: 1px solid yellow; */
                        display: inline-block;
                        vertical-align: middle;
                        text-align: center;
                    }
            
                    #log {
                        height: 4%;
                        width: 99.5%;
                        font-size: 8px;
                        text-align: center;
                        /* border: 1px solid blue; */
                        display: inline-block;
                        vertical-align: middle;
                        text-align: center;
                    }

                    #log h1 {
                        font-size: 12px;
                        text-align: center;
                        /* border: 1px solid blue; */
                        display: inline-block;
                        vertical-align: middle;
                        text-align: center;
                        font-family: Arial;
                    }
            
                    #image {
                        height: 95.5%;
                        width: 99.5%;
                        text-align: center;
                        margin: auto 0;
                        margin: auto 0;
                        /* border: 1px solid green; */
                        display: inline-block;
                        vertical-align: middle;
                        text-align: center;
                    }
            
                    #image img {
                        max-height: 100%;
                        max-width: 100%;
                        margin: auto auto;
                        display: inline-block;
                        vertical-align: middle;
                        text-align: center;
                    }
                </style>
            </head>
            
            <body>
                <div class="flex-container" id="page">
                    <div id="log">
                        <h1>(${date.toLocaleString()}) --- (ID: ${id})</h1>
                    </div>
                    <div id="image">
                        <img src="${photoUrl}" />
                    </class>
                </class>
            </body>
            
            </html>
        `
    }
    const pdfBuffer = await html2Pdf.generatePdf(html, html2PdfOptions).then((pdfBuffer) => pdfBuffer).catch((err) => { log(err) })
    const pdf = Buffer.from(pdfBuffer, 'base64')
    fs.writeFileSync(`${dir}/print.pdf`, pdf)
    const pdfMsg = await bot.telegram.sendDocument(ctx.message.chat.id, { source: `${dir}/print.pdf`, filename: 'print.pdf' }, { caption: `ID: ${id}`, reply_to_message_id: ctx.message.message_id }).catch((err) => { log(err) })
    bot.telegram.deleteMessage(msgLog.chat.id, msgLog.message_id).catch((err) => { log(err) })
    await ctx.telegram.sendMessage(pdfMsg.chat.id, 'Deseja imprimir o PDF?', {
      parse_mode: 'Markdown',
      reply_to_message_id: pdfMsg.message_id,
      ...Markup.inlineKeyboard([
        Markup.button.callback('(🖨) Imprimir', `print-${id}`),
        Markup.button.callback('(❌) Não imprimir', `cancel-${id}`)
      ])
    }).catch((err) => { log(err) })
  } catch (err) { log(err) }
}

async function sendPdfPrintRequest (ctx, msgLog, photoFileId) {
  try {
    const pdfUrl = await ctx.telegram.getFileLink(photoFileId).catch((err) => { log(err) }).then((link) => link.href)
    log(pdfUrl)
    const date = new Date()
    for (let i = 1; i <= 7; i++) if ((date.getDay() !== daysArray[i]) && (date.getDay() !== daysArray[i] + 1) && (fs.existsSync(`./pdfTemp/${daysArray[i]}`))) fs.rmSync(`./pdfTemp/${daysArray[i]}`, { recursive: true })
    const id = `${date.getDay()}-${ctx.message.chat.id.toString().replace('-', 'G')}-${ctx.message.message_id}`
    const idArray = id.split('-')
    const dir = `./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}`
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(🧡) Salvando PDF! Aguarde...', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id })
    await downloadFile(pdfUrl, `${dir}/print.pdf`).catch((err) => { log(err) })
    if (!fs.existsSync(`${dir}/print.pdf`)) return bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(❌) Erro no donwload do arquivo!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id })
    const pdfMsg = await bot.telegram.sendDocument(ctx.message.chat.id, { source: `${dir}/print.pdf`, filename: 'print.pdf' }, { caption: `ID: ${id}`, reply_to_message_id: ctx.message.message_id }).catch((err) => { log(err) })
    bot.telegram.deleteMessage(msgLog.chat.id, msgLog.message_id).catch((err) => { log(err) })
    await ctx.telegram.sendMessage(pdfMsg.chat.id, 'Deseja imprimir o PDF?', {
      parse_mode: 'Markdown',
      reply_to_message_id: pdfMsg.message_id,
      ...Markup.inlineKeyboard([
        Markup.button.callback('(🖨) Imprimir', `print-${id}`),
        Markup.button.callback('(❌) Não imprimir', `cancel-${id}`)
      ])
    }).catch((err) => { log(err) })
  } catch (err) { log(err) }
}

log('Starting!')

bot.on('document', async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.message.chat.id.toString().replace('-', 'G'))) return ctx.reply('(❌) Infelizmente esse chat não está autorizado! Utilize o comando /autorizar (senha) para autoriza-lo!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    if (ctx.message.document.mime_type === 'image/png' || ctx.message.document.mime_type === 'image/jpeg') {
      const msgLog = await ctx.reply('(👍) Foto recebida!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
      if (!msgLog) return
      const photoFileId = ctx.message.document.file_id
      await sendImagePrintRequest(ctx, msgLog, photoFileId)
    } else if (ctx.message.document.mime_type === 'application/pdf') {
      const msgLog = await ctx.reply('(👍) PDF recebido!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
      const pdfFileId = ctx.message.document.file_id
      // ...Donwload pdf and save in the folder like image with ids
      await sendPdfPrintRequest(ctx, msgLog, pdfFileId)
    }
  } catch (err) { log(err) }
})

bot.on('photo', async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.message.chat.id.toString().replace('-', 'G'))) return ctx.reply('(❌) Infelizmente esse chat não está autorizado! Utilize /autorizar junto com sua senha de liberação para autoriza-lo!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    const msgLog = await ctx.reply('(👍) Foto recebida!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    if (!msgLog) return
    const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id
    await sendImagePrintRequest(ctx, msgLog, photoFileId)
  } catch (err) { log(err) }
})

bot.action(/print-/gi, async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.update.callback_query.message.chat.id.toString().replace('-', 'G'))) return
    const idArray = ctx.match.input.split('-')
    idArray.shift()
    log(idArray)
    if (!fs.existsSync(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}/print.pdf`)) return ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(❌) O arquivo não foi encontrado na base de dados! Por favor reenvie-o para tentar imprimir!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(🖨) Prerando impressão...', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    fs.writeFileSync(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}/printed.txt`, `${new Date().toLocaleString()}`)
    printer.queue(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}/print.pdf`, (err, jobId) => {
      if (err) {
        log(err)
        return ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(❌) Erro ao imprimir arquivo! Por favor reenvie-o para tentar novamente!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
      }
      log(jobId)
      ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(✅) O arquivo foi para impressão com sucesso!', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('(🖨) Imprimir novamente', `print-${idArray.join('-')}`),
          Markup.button.callback('(❌) Não imprimir', `cancel-${idArray.join('-')}`)
        ])
      }).catch((err) => { log(err) })
    })
  } catch (err) { log(err) }
})

bot.action(/cancel-/gi, async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.update.callback_query.message.chat.id.toString().replace('-', 'G'))) return
    const idArray = ctx.match.input.split('-')
    idArray.shift()
    log(idArray)
    if (fs.existsSync(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}/printed.txt`)) {
      return ctx.telegram.editMessageText(
        ctx.update.callback_query.message.chat.id,
        ctx.update.callback_query.message.message_id,
        null,
        `(❌) O arquivo de ID (${idArray[0]}-${idArray[1]}-${idArray[2]}) já foi impresso em ${fs.readFileSync(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}/printed.txt`).toString().replace(',', ' as')}`,
        { parse_mode: 'HTML' }
      ).catch((err) => { log(err) })
    }
    await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(💢) Ok! O arquivo não será impresso!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    if (fs.existsSync(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}`)) fs.rmSync(`./pdfTemp/${idArray[0]}/${idArray[1]}/${idArray[2]}`, { recursive: true })
  } catch (err) { log(err) }
})

bot.command('autorizar', async (ctx) => {
  try {
    if (checkChatIdAuthorized(ctx.message.chat.id.toString().replace('-', 'G'))) return ctx.reply('(👍) Esse canal já foi autorizado!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    const password = ctx.message.text.split(' ')[1]
    if (!password) return ctx.reply('(❌) Você deve informar uma senha de liberação junto com o /autorizar !', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    if (password === process.env.PASSWORD) {
      await ctx.reply('(✅) Parabéns! Esse canal foi autorizado!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
      const authorizedChatIds = JSON.parse(fs.readFileSync('./authorizedChatIds.json'))
      authorizedChatIds.push(ctx.message.chat.id.toString().replace('-', 'G'))
      fs.writeFileSync('./authorizedChatIds.json', JSON.stringify(authorizedChatIds))
    } else {
      await ctx.reply('(❌) Senha incorreta! Por favor tente novamente!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    }
  } catch (err) { log(err) }
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
