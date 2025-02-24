const WebSocket = require('ws');
const serverIP = "92.205.233.81"; // Zamień na swój adres IP
const port = 8081;

const server = new WebSocket.Server({ host: serverIP, port });

 
  
let clients = new Set();

server.on("connection", (ws) => {
    clients.add(ws);
    console.log("Nowy klient połączony. Aktualna liczba klientów:", clients.size);

    ws.on("message", (message) => {
        console.log(`📩 Otrzymano wiadomość od klienta: ${message}`);

        clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
                console.log(`➡️ Przekazano wiadomość do innego klienta.`);
            }
        });
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log("Klient rozłączony. Aktualna liczba klientów:", clients.size);
    });
});
console.log("Serwer sygnalizacyjny WebRTC działa na ws://92.205.233.81:8081");
