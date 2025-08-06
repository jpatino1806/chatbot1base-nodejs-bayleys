const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("baileys");
const QRCode = require("qrcode")
const nodeHtmlToImage = require('node-html-to-image')
const ffmpeg = require("fluent-ffmpeg")

// express para vizualizar el QR
const express = require("express");
let lecturaQR = null;

const app = express();

// servicios end point para qr
app.get("/qr", (req, res) =>{
    if(lecturaQR){
        return res.send(`<img src="${lecturaQR}" />`);
    }else{
        return res.send(`Qr no disponible, ¿Ya estás autenticado?`);
    }
});

// leventar el servidor express
app.listen(3000, () => {
    console.log("Servidor iniciado en http://127.0.0.1:3000");
})


// BAILEYS

async function conectarWhatsapp(){

    // conectar con whatsapp + (auth)
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys")

    const sock = makeWASocket({
        auth: state
    })

    sock.ev.on("creds.update", saveCreds);

    // conexion + qr
    sock.ev.on("connection.update", async(update) => {
        const { connection, lastDisconnect, qr } = update;

        if(connection === 'close'){
            const puedeConectarse = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if(puedeConectarse){
                conectarWhatsapp()
            }
        }else if(connection === 'open'){
            console.log("CONEXION ABIERTA");
        }
        if(qr){
            lecturaQR = await QRCode.toDataURL(qr);
            console.log(await QRCode.toString(qr, {type: 'terminal', small: true}))
        }
    });

    // recibir y enviar mensajes
    sock.ev.on("messages.upsert", async (event) => {
        // console.log(event);
        for(const m of event.messages){
            console.log(m)
            const id = m.key.remoteJid;
            if(event.type != "notify" || m.key.fromMe || id.includes("@g.us") || id.includes("@broadcast")){
                return;
            }
            // recibir mensaje 
            const mensaje = m.message.conversation || m.message?.extendedTextMessage?.text;
            // mensaje = mensaje.toLowerCase();
            // Leer Mensajes
            await sock.readMessages([m.key]);

            // Escribiendo...
            await delay(100);
            await sock.sendPresenceUpdate("composing", id);
            await delay(1000);
            const nombre = m.pushName;
            
            if(['Menu', 'MENU', 'Menú', 'menu'].includes(mensaje)){
                
                await sock.sendMessage(id, {text: `*Hola* ${nombre} 👋 Bienvenid@ a *miBOT* 🌟. Selecciona una opción:\n- 👉 *A*: Mensaje Texto\n- 👉 *B*: Respuesta de Mensaje\n- 👉 *C*: Menscion\n- 👉 *D*: Ubicación📱\n- 👉 *Encuesta*📱\n- 👉 *E*: Contactos\n- 👉 *F*: Reacción\n- 👉 *G*: Links\n- 👉 *H*: Imagenes\n- 👉 *I*: Videos\n- 👉 *J*: Documentos\n- 👉 *K*: Audio\n\n> *Indícanos una opción!*`});

            }else if(['A', 'a'].includes(mensaje)){
                await sock.sendMessage(id, {text: `Hola Mundo`});
            }else if(['B', 'b'].includes(mensaje)){
                // respuesta de mensajes
                await sock.sendMessage(id, { text: 'Hola Mundo' }, { quoted: m })
            }else if(['C', 'c'].includes(mensaje)){
                await sock.sendMessage(id, {text: 'Hola, @59173277937 este es un mensaje de tipo mencion', mentions: ['59173277937@s.whatsapp.net']})
            }else if(['D', 'd'].includes(mensaje)){
                await sock.sendMessage(id, {
                    location: {
                        degreesLatitude: 24.121231,
                        degreesLongitude: 55.1121221,
                        address: 'Av. 123. Zona: ABC (el CENTRO)'
                    }
                })
            }else if(['Encuesta', 'encuesta'].includes(mensaje)){
                await sock.sendMessage(id, {
                    poll: {
                        name: 'Eres Frontend o Backend?',
                        values: ['Soy Frontend', 'Soy Backend'],
                        selectableCount: 1,
                        toAnnouncementGroup: false
                    }
                })
            }else if(['E', 'e'].includes(mensaje)){
                const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
                + 'VERSION:3.0\n' 
                + 'FN:Cristian\n' // full name
                + 'ORG:Blumbit;\n' // the organization of the contact
                + 'TEL;type=CELL;type=VOICE;waid=59173277937:+59173277937\n' // WhatsApp ID + phone number
                + 'END:VCARD'

                await sock.sendMessage(
                    id,
                    { 
                        contacts: { 
                            displayName: 'Cristian', 
                            contacts: [{ vcard }] 
                        }
                    }
                )
            }else if(['F', 'f'].includes(mensaje)){
                await sock.sendMessage(
                    id,
                    {
                        react: {
                            text: '💖', // use an empty string to remove the reaction
                            key: m.key
                        }
                    }
                )
            }else if(['G', 'g'].includes(mensaje)){
                await sock.sendMessage(id, { text: "Hola visita mi repositorio click aqui: https://github.com/cchura94" });
            }else if(['H', 'h'].includes(mensaje)){
                await sock.sendMessage(id, { image: {url: 'https://blumbitvirtual.edtics.com/pluginfile.php/5252/course/overviewfiles/post-fullstack-9-junio%20%281%29.png'} });
                await sock.sendMessage(id, { image: {url: './Media/imagen_test.png'} });
                await sock.sendMessage(id, { image: {url: './Media/imagen_test.png'}, caption: `Este es un *curso* avanzado de servicios Web Api rest con *Node.js y Nest*.\n\n conectando a bases de datos sql + APIS` });

                nodeHtmlToImage({
                    output: './Media/mi-imagen.png',
                    html: `
                    <html>
<head>
    <style>
        body {
            margin: 10px;
        }
    </style>
</head>
<body style="margin:20px">
    <h1>Recibo #111</h1>
    <h1>Hola ${nombre} Saludos!</h1>
</body>
</html>
                    `
                  })
                    .then(async () => {
                        
                        console.log('Imagen Creado!')
                        await sock.sendMessage(id, { image: {url: './Media/mi-imagen.png'} });
                    })


            }else if(['I', 'i'].includes(mensaje)){
                await sock.sendMessage(id, {video: {url: './Media/mi-video.mp4'}})
                await sock.sendMessage(id, {video: {url: './Media/mi-video.mp4'}, caption: 'Hola este es un video (descripción)'})
                await sock.sendMessage(id, {video: {url: './Media/mi-video.mp4'}, ptv: true})
                await sock.sendMessage(id, {video: {url: './Media/mi-video.mp4'}, gifPlayback: true})
            }else if(['J', 'j'].includes(mensaje)){
                
                await sock.sendMessage(id, {document: {url: "https://ceccsica.info/wp-content/uploads/2024/03/Volumen_25.pdf"}, fileName: 'Mi libro.pdf', caption: 'este es un libro'})

            }else if(['K', 'k'].includes(mensaje)){
                const mp3Path = "./Media/mi-audio.mp3";
                const opusPath = mp3Path.replace(/\.mp3$/, ".opus");
                await convertirMp3AOpus(mp3Path, opusPath);

                await sock.sendMessage(id, {audio: {url: './Media/mi-audio.opus'}, ptt: true})
            }
            
            else{
                await sock.sendMessage(id, {text: `Escribe su mensaje o envíe la palabra MENU para conecer el menu de opciones.`});
            }



        }

    })

}

conectarWhatsapp();


function convertirMp3AOpus(inputPath, outputPath){
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioCodec('libopus')
            .format("opus")
            .audioBitrate(64)
            .on("end", () => resolve(outputPath))
            .on("error", reject)
            .save(outputPath);
    })
}