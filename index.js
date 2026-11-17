const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.redirect("/index.html");
});

app.post("/api/chat", async (req, res) => {
    try {
        const { message, messages } = req.body;
        
        let chatMessages = messages;
        if (!chatMessages && message) {
            chatMessages = [{ role: "user", content: message }];
        }

        if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
            return res.status(400).json({ error: "Pesan tidak boleh kosong" });
        }
        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({
                error: "API key belum diatur di file .env"
            });
        }
         // Request ke OpenRouter
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
                },

                body: JSON.stringify({
                    model: process.env.OPENROUTER_MODEL,
                    messages: chatMessages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true
                })
            }
        );
        // Cek error OpenRouter
        if (!response.ok) {
            const errorData = await response.text();

            console.error("OpenRouter Error:", errorData);

            return res.status(response.status).json({
                error: errorData
            });
        }

         // Header untuk SSE (Server-Sent Events)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { 
                stream: true 
            });

            const lines = buffer.split("\n");

            // Simpan baris terakhir ke buffer untuk dibaca di iterasi berikutnya         
            buffer = lines.pop();

            for (const line of lines) {

                const trimmedLine = line.trim();

                if (!trimmedLine) {
                    continue;
                }

                if (!trimmedLine.startsWith("data: ")) {
                    continue;
                }

                const data = trimmedLine.slice(5).trim();

                if (data === "[DONE]") {
                    continue;
                }

                try {
                    const parsedData = JSON.parse(data);

                    const content = parsedData.choices[0].delta.content;

                    if (content) {
                        res.write(`data: ${JSON.stringify(content)}\n\n`);
                    }
                }catch (error) {
                    console.error(
                        "Gagal parsing streaaming data dari OpenRouter:",
                        error
                    );
                }
            }
        }
        res.write("data: [DONE]\n\n");
        res.end();
    }
    catch (error) {
        console.error("Server Error", error);

        if (!res.headersSent) {
            res.status(500).json({
                error: "Terjadi kesalahan pada server"
            })
        } else {
            res.write(
                `data: ${JSON.stringify(
                    "Terjadi Kesalaham pad server"
                )}\n\n`
            );

            res.end();
        }
    }
});   

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
