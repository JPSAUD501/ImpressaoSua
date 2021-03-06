// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

require('dotenv').config()
const { Telegraf, Markup } = require('telegraf')
const fs = require('fs')
const html2Pdf = require('html-pdf-node')
const axios = require('axios')
const stream = require('stream')
const { promisify } = require('util')
const cmd = require('node-cmd')
const YAML = require('yaml')

const finished = promisify(stream.finished)

const dbPath = './AllFiles'
const html2PdfOptions = { format: 'A4', pageRanges: '1' }

const bot = new Telegraf(process.env.BOT_TOKEN)

function log (...args) {
  console.log(`[${new Date().toLocaleString('pt-BR')}]`, ...args)
}

async function print (filePath) {
  return new Promise((resolve, reject) => {
    cmd.run(`lp ${filePath}`, function (err, data, stderr) {
      if (err) {
        log(err)
        reject(err)
      }
      log(data)
      resolve(data)
    })
  })
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
    const id = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${ctx.message.chat.id.toString().replace('-', 'G')}-${ctx.message.message_id}`
    const idArray = id.split('-')
    const dir = `${dbPath}/${idArray.join('/')}`
    if (!fs.existsSync(`${dir}`)) fs.mkdirSync(`${dir}`, { recursive: true })
    bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(????) Gerando PDF! Aguarde...', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
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
                        <h1>(${date.toLocaleString('pt-BR')}) --- (ID: ${id})</h1>
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
    if (!pdfBuffer) return bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(???) Erro ao gerar PDF! Por favor tente novamente.', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    const pdf = Buffer.from(pdfBuffer, 'base64')
    if (!pdf) return bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(???) Erro ao gerar PDF! Por favor tente novamente.', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    fs.writeFileSync(`${dir}/print.pdf`, pdf)
    const fileDataJson = {
      FileId: idArray.join('-'),
      Created: {
        Date: date.toLocaleString('pt-BR'),
        Unix: date.getTime()
      },
      Updated: {
        Date: date.toLocaleString('pt-BR'),
        Unix: date.getTime()
      },
      TimesPrinted: 0
    }
    fs.writeFileSync(`${dir}/info.yaml`, YAML.stringify(fileDataJson))
    const pdfMsg = await bot.telegram.sendDocument(ctx.message.chat.id, { source: `${dir}/print.pdf`, filename: 'print.pdf' }, { caption: `ID: ${id}`, reply_to_message_id: ctx.message.message_id }).catch((err) => { log(err) })
    if (!pdfMsg) return bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(???) Erro ao enviar arquivo! Por favor tente novamente.', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    bot.telegram.deleteMessage(msgLog.chat.id, msgLog.message_id).catch((err) => { log(err) })
    await ctx.telegram.sendMessage(pdfMsg.chat.id, 'Deseja imprimir o PDF?', {
      parse_mode: 'Markdown',
      reply_to_message_id: pdfMsg.message_id,
      ...Markup.inlineKeyboard([
        Markup.button.callback('(????) Imprimir', `print-${idArray.join('-')}`),
        Markup.button.callback('(???) N??o imprimir', `cancel-${idArray.join('-')}`)
      ])
    }).catch((err) => { log(err) })
  } catch (err) { log(err) }
}

async function sendPdfPrintRequest (ctx, msgLog, photoFileId) {
  try {
    const pdfUrl = await ctx.telegram.getFileLink(photoFileId).catch((err) => { log(err) }).then((link) => link.href)
    log(pdfUrl)
    const date = new Date()
    const id = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${ctx.message.chat.id.toString().replace('-', 'G')}-${ctx.message.message_id}`
    const idArray = id.split('-')
    const dir = `${dbPath}/${idArray.join('/')}`
    if (!fs.existsSync(`${dir}`)) fs.mkdirSync(`${dir}`, { recursive: true })
    bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(????) Salvando PDF! Aguarde...', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id })
    await downloadFile(pdfUrl, `${dir}/print.pdf`).catch((err) => { log(err) })
    if (!fs.existsSync(`${dir}/print.pdf`)) return bot.telegram.editMessageText(msgLog.chat.id, msgLog.message_id, null, '(???) Erro no download do arquivo!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id })
    const fileDataJson = {
      FileId: idArray.join('-'),
      Created: {
        Date: date.toLocaleString('pt-BR'),
        Unix: date.getTime()
      },
      Updated: {
        Date: date.toLocaleString('pt-BR'),
        Unix: date.getTime()
      },
      TimesPrinted: 0
    }
    fs.writeFileSync(`${dir}/info.yaml`, YAML.stringify(fileDataJson))
    const pdfMsg = await bot.telegram.sendDocument(ctx.message.chat.id, { source: `${dir}/print.pdf`, filename: 'print.pdf' }, { caption: `ID: ${id}`, reply_to_message_id: ctx.message.message_id }).catch((err) => { log(err) })
    bot.telegram.deleteMessage(msgLog.chat.id, msgLog.message_id).catch((err) => { log(err) })
    await ctx.telegram.sendMessage(pdfMsg.chat.id, 'Deseja imprimir o PDF?', {
      parse_mode: 'Markdown',
      reply_to_message_id: pdfMsg.message_id,
      ...Markup.inlineKeyboard([
        Markup.button.callback('(????) Imprimir', `print-${id}`),
        Markup.button.callback('(???) N??o imprimir', `cancel-${id}`)
      ])
    }).catch((err) => { log(err) })
  } catch (err) { log(err) }
}

log('Starting!')

bot.catch(e => {
  log(e)
})

bot.on('document', async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.message.chat.id.toString().replace('-', 'G'))) return ctx.reply('(???) Infelizmente esse chat n??o est?? autorizado! Utilize o comando /autorizar (senha) para autoriza-lo!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    if (ctx.message.document.mime_type === 'image/png' || ctx.message.document.mime_type === 'image/jpeg') {
      const msgLog = await ctx.reply('(????) Foto recebida!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
      if (!msgLog) return
      const photoFileId = ctx.message.document.file_id
      await sendImagePrintRequest(ctx, msgLog, photoFileId)
    } else if (ctx.message.document.mime_type === 'application/pdf') {
      const msgLog = await ctx.reply('(????) PDF recebido!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
      const pdfFileId = ctx.message.document.file_id
      await sendPdfPrintRequest(ctx, msgLog, pdfFileId)
    }
  } catch (err) { log(err) }
})

bot.on('photo', async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.message.chat.id.toString().replace('-', 'G'))) return ctx.reply('(???) Infelizmente esse chat n??o est?? autorizado! Utilize /autorizar junto com sua senha de libera????o para autoriza-lo!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    const msgLog = await ctx.reply('(????) Foto recebida!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
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
    const dir = `${dbPath}/${idArray.join('/')}`
    log('Printing:', idArray)
    if (!fs.existsSync(`${dir}/print.pdf`)) return ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(???) O arquivo n??o foi encontrado no banco de dados! Por favor reenvie-o para tentar imprimir!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(????) Preparando impress??o...', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    if (fs.existsSync(`${dir}/info.yaml`)) {
      const fileDataJson = YAML.parse(fs.readFileSync(`${dir}/info.yaml`, 'utf8'))

      fileDataJson.Updated = {
        Date: new Date().toLocaleString('pt-BR'),
        Unix: new Date().getTime()
      }

      fileDataJson.LastPrinted = new Date().toLocaleString('pt-BR')

      if (!fileDataJson.TimesPrinted) {
        fileDataJson.TimesPrinted = 1
      } else {
        fileDataJson.TimesPrinted = fileDataJson.TimesPrinted + 1
      }

      if (!fileDataJson.PrintedDates) {
        fileDataJson.PrintedDates = [new Date().toLocaleString('pt-BR')]
      } else {
        fileDataJson.PrintedDates.push(new Date().toLocaleString('pt-BR'))
      }
      fs.writeFileSync(`${dir}/info.yaml`, YAML.stringify(fileDataJson))
    } else {
      const fileDataJson = {
        FileId: idArray.join('-'),
        Updated: {
          Date: new Date().toLocaleString('pt-BR'),
          Unix: new Date().getTime()
        },
        TimesPrinted: 1,
        LastPrinted: new Date().toLocaleString('pt-BR'),
        PrintedDates: [new Date().toLocaleString('pt-BR')]
      }
      fs.writeFileSync(`${dir}/info.yaml`, YAML.stringify(fileDataJson))
    }
    print(`${dir}/print.pdf`).catch((err) => {
      log(err)
      return ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(???) Erro ao imprimir arquivo! Por favor reenvie-o para tentar novamente!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    })
    const printedCopies = YAML.parse(fs.readFileSync(`${dir}/info.yaml`, 'utf8')).TimesPrinted
    ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(???) O arquivo foi para impress??o com sucesso!', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback(`(????) Imprimir ${printedCopies + 1}?? c??pia`, `print-${idArray.join('-')}`),
        Markup.button.callback('(???) Informa????es', `info-${idArray.join('-')}`)
      ])
    }).catch((err) => { log(err) })
  } catch (err) { log(err) }
})

bot.action(/cancel-/gi, async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.update.callback_query.message.chat.id.toString().replace('-', 'G'))) return
    const idArray = ctx.match.input.split('-')
    idArray.shift()
    const dir = `${dbPath}/${idArray.join('/')}`
    log('Canceling:', idArray)
    if (fs.existsSync(`${dir}/info.yaml`)) {
      const fileDataJson = YAML.parse(fs.readFileSync(`${dir}/info.yaml`, 'utf8'))
      if (!fileDataJson.TimesPrinted) {
        fileDataJson.TimesPrinted = 0
        fs.writeFileSync(`${dir}/info.yaml`, YAML.stringify(fileDataJson))
      }
      if (fileDataJson.TimesPrinted <= 0) {
        if (fs.existsSync(`${dir}`)) fs.rmSync(`${dir}`, { recursive: true })
        return ctx.telegram.editMessageText(
          ctx.update.callback_query.message.chat.id,
          ctx.update.callback_query.message.message_id,
          null,
          '(????) Ok! O arquivo n??o ser?? impresso e j?? foi deletado do banco de dados!',
          { parse_mode: 'HTML' }
        ).catch((err) => { log(err) })
      } else {
        return ctx.telegram.editMessageText(
          ctx.update.callback_query.message.chat.id,
          ctx.update.callback_query.message.message_id,
          null,
        `(????) Ok! O arquivo n??o ser?? impresso novamente! Numero de c??pias impressas: ${fileDataJson.TimesPrinted}`,
        { parse_mode: 'HTML' }
        ).catch((err) => { log(err) })
      }
    }
    if (fs.existsSync(`${dir}`)) fs.rmSync(`${dir}`, { recursive: true })
    await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(????) Ok! O arquivo n??o ser?? impresso!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
  } catch (err) { log(err) }
})

bot.action(/info-/gi, async (ctx) => {
  try {
    if (!checkChatIdAuthorized(ctx.update.callback_query.message.chat.id.toString().replace('-', 'G'))) return
    const idArray = ctx.match.input.split('-')
    idArray.shift()
    const dir = `${dbPath}/${idArray.join('/')}`
    log('Sending info.yaml:', idArray)
    if (fs.existsSync(`${dir}/info.yaml`)) {
      const fileDataJson = YAML.parse(fs.readFileSync(`${dir}/info.yaml`, 'utf8'))
      const fileDataString = fs.readFileSync(`${dir}/info.yaml`, 'utf8')
      if (!fileDataJson || !fileDataString) return ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(???) O arquivo de informa????es n??o foi encontrado, por favor envie o arquivo novamente!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
      await bot.telegram.sendDocument(ctx.update.callback_query.message.chat.id, { source: `${dir}/info.yaml`, filename: 'info.yaml' }, { caption: fileDataString, reply_to_message_id: ctx.update.callback_query.message.message_id }).catch((err) => { log(err) })
    } else {
      ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, null, '(???) O arquivo de informa????es n??o foi encontrado, por favor envie o arquivo novamente!', { parse_mode: 'HTML' }).catch((err) => { log(err) })
    }
  } catch (err) { log(err) }
})

bot.command('autorizar', async (ctx) => {
  try {
    if (checkChatIdAuthorized(ctx.message.chat.id.toString().replace('-', 'G'))) return ctx.reply('(????) Esse canal j?? foi autorizado!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    const password = ctx.message.text.split(' ')[1]
    if (!password) return ctx.reply('(???) Voc?? deve informar uma senha de libera????o junto com o /autorizar !', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    if (password === process.env.PASSWORD) {
      await ctx.reply('(???) Parab??ns! Esse canal foi autorizado!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
      const authorizedChatIds = JSON.parse(fs.readFileSync('./authorizedChatIds.json'))
      authorizedChatIds.push(ctx.message.chat.id.toString().replace('-', 'G'))
      fs.writeFileSync('./authorizedChatIds.json', JSON.stringify(authorizedChatIds))
    } else {
      await ctx.reply('(???) Senha incorreta! Por favor tente novamente!', { parse_mode: 'HTML', reply_to_message_id: ctx.update.message.message_id }).catch((err) => { log(err) })
    }
  } catch (err) { log(err) }
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
