const WebSocket = require('ws');
const serverIP = "92.205.233.81"; // Zamień na swój adres IP
const port = 8081;

const wss = new WebSocket.Server({ host: serverIP, port });

let clients = {};

wss.on('connection', (ws) => {
    console.log("🔗 Nowy klient połączony!");

    ws.on('message', (message) => {
        let data = JSON.parse(message);
        
        switch (data.type) {
            case "register":
                clients[data.id] = ws;
                console.log(`✅ Klient zarejestrowany: ${data.id}`);
                break;

            case "offer":
            case "answer":
            case "candidate":
                if (clients[data.target]) {
                    console.log(`📡 Przekazuję ${data.type} do: ${data.target}`);
                    clients[data.target].send(JSON.stringify(data));
                }
                break;
        }
    });

 

wss.on('connection', (ws) => {
    console.log("🔗 Nowy klient połączony!");

    ws.on('message', (message) => {
        console.log(`📩 [Server] Otrzymano wiadomość: ${message}`);

        let data;
        try {
            data = JSON.parse(message);
        } catch (err) {
            console.error("❌ [Server] Błąd parsowania JSON:", err);
            return;
        }

        if (data.type === "answer") {
            console.log("📡 [Server] Przekazuję Answer do:", data.target);
        }
    });
});

    ws.on('close', () => {
        console.log("❌ Klient rozłączony!");
        for (let id in clients) {
            if (clients[id] === ws) {
                delete clients[id];
                console.log(`🗑️ Usunięto klienta: ${id}`);
            }
        }
    });
});

console.log(`🚀 Serwer sygnalizacyjny działa na ws://${serverIP}:${port}`);
