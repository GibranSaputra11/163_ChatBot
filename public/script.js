const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const quickPingBtn = document.getElementById("quick-ping-btn");
const resetBtn = document.getElementById("reset-btn");
const sendBtn = document.getElementById("send-btn");

const messages = [];

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(text, sender, isError = false) {
    const message = document.createElement("div");
    message.classList.add("message", sender);
    if (isError) message.classList.add("error");

    const content = document.createElement("div");
    content.classList.add("message-content");
    content.textContent = text;

    const timeDiv = document.createElement("div");
    timeDiv.classList.add("message-time");
    timeDiv.textContent = getCurrentTime();

    content.appendChild(timeDiv);
    message.appendChild(content);
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;

    return content;
}

function setLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    if (quickPingBtn) quickPingBtn.disabled = isLoading;
    if (isLoading) {
        sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>`;
    } else {
        sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    }
}

async function sendMessage(messageText) {
    if (!messageText.trim()) return;

    addMessage(messageText, "user");
    messages.push({ role: "user", content: messageText });
    userInput.value = "";
    setLoading(true);

    const startTime = Date.now();
    const botContent = addMessage("", "bot");
    let botResponse = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Terjadi kesalahan pada server");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

                const data = trimmedLine.slice(5).trim();
                if (data === "[DONE]") continue;

                try {
                    const token = JSON.parse(data);
                    botResponse += token;
                    botContent.textContent = botResponse;
                    const latency = ((Date.now() - startTime) / 1000).toFixed(1);
                    let timeDiv = botContent.querySelector(".message-time");
                    if (!timeDiv) {
                        timeDiv = document.createElement("div");
                        timeDiv.classList.add("message-time");
                        botContent.appendChild(timeDiv);
                    }
                    timeDiv.textContent = `${getCurrentTime()} • ${latency}s`;
                    chatBox.scrollTop = chatBox.scrollHeight;
                } catch (e) {
                    console.error("Gagal parsing token:", e);
                }
            }
        }

        messages.push({ role: "assistant", content: botResponse });

    } catch (error) {
        console.error(error);
        botContent.parentElement.remove();
        addMessage(`Error: ${error.message}`, "bot", true);
    } finally {
        setLoading(false);
        userInput.focus();
    }
}

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(userInput.value.trim());
});

if (quickPingBtn) {
    quickPingBtn.addEventListener("click", () => {
        sendMessage("Halo, tes koneksi API!");
    });
}

if (resetBtn) {
    resetBtn.addEventListener("click", () => {
        messages.length = 0;
        chatBox.innerHTML = "";
        addMessage("Percakapan direset. Siap untuk tes baru.", "bot");
    });
}