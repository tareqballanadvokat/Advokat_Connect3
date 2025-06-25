// WebRTCDataChannel.tsx
import React, { useEffect, useRef, useState } from 'react';

interface WebRTCDataChannelProps {
  isOfferer: boolean;             // true: inicjuje połączenie, false: czeka na sygnał
  sendSignal: (data: any) => void; // funkcja do wysłania SDP/ICE innemu peerowi
  incomingSignal?: any;            // dane odebrane z serwera sygnalizacji (SDP lub IceCandidate)
}

const WebRTCDataChannel: React.FC<WebRTCDataChannelProps> = ({
  isOfferer,
  sendSignal,
  incomingSignal
}) => {
  // Ref do RTCPeerConnection (lub null przed inicjalizacją)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  // Ref do RTCDataChannel (lub null dopóki nie zostanie utworzony/otrzymany)
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  // 1) Inicjalizacja PeerConnection i – w zależności od roli – utworzenie DataChannel albo obsługa ondatachannel
  useEffect(() => {
    // a) Utwórz nowy RTCPeerConnection ze STUN-em (Google STUN)
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // b) Jeśli to my (offerer), od razu tworzymy data channel
    if (isOfferer) {
      const dc = pc.createDataChannel('udp-like-channel');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('DataChannel (offerer) OTWARTY');
      };
      dc.onmessage = (e) => {
        setMessages((prev) => [...prev, 'Remote: ' + e.data]);
      };

      // Utwórz ofertę SDP i wyślij do drugiej strony
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          // pc.localDescription nie będzie null
          if (pc.localDescription) {
            sendSignal(pc.localDescription);
          }
        })
        .catch((err) => console.error('Błąd podczas tworzenia oferty:', err));
    } else {
      // c) Jeśli to nie my (answerer), czekamy na ondatachannel
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;

        dc.onopen = () => {
          console.log('DataChannel (answerer) OTWARTY');
        };
        dc.onmessage = (e) => {
          setMessages((prev) => [...prev, 'Remote: ' + e.data]);
        };
      };
    }

    // d) Wymiana ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ candidate: event.candidate });
      }
    };

    // e) Cleanup: przy odmontowaniu komponentu zamykamy peer connection
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      dcRef.current = null;
    };
  }, [isOfferer, sendSignal]);

  // 2) Gdy przychodzą dane sygnałowe (SDP lub IceCandidate) – obsłuż je
  useEffect(() => {
    if (!incomingSignal || !pcRef.current) {
      return;
    }

    const pc = pcRef.current;

    // a) Jeżeli przyszło SDP (offer/answer)
    if (incomingSignal.sdp) {
      const desc = new RTCSessionDescription(incomingSignal.sdp);

      pc.setRemoteDescription(desc)
        .then(() => {
          // Jeśli to był offer, to utwórz odpowiedź (answer)
          if (desc.type === 'offer') {
            return pc.createAnswer();
          }
          // W innym wypadku – nic nie zwracamy
          return null;
        })
        .then((answer) => {
          if (answer) {
            return pc.setLocalDescription(answer);
          }
          return null;
        })
        .then(() => {
          if (pc.localDescription) {
            sendSignal(pc.localDescription);
          }
        })
        .catch((err) => console.error('Błąd przy obsłudze SDP:', err));
    }
    // b) Jeżeli przyszło IceCandidate
    else if (incomingSignal.candidate) {
      const iceCandidate = new RTCIceCandidate(incomingSignal.candidate);
      pc.addIceCandidate(iceCandidate).catch((err) => {
        console.error('Błąd przy dodawaniu IceCandidate:', err);
      });
    }
  }, [incomingSignal, sendSignal]);

  // Funkcja wysyłająca przykładowy tekst przez DataChannel
  const sendMessage = () => {
    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      const text = 'Cześć po UDP-like – ' + new Date().toLocaleTimeString();
      dc.send(text);
      setMessages((prev) => [...prev, 'Local: ' + text]);
    }
  };

  // Render
  return (
    <div style={{ fontFamily: 'sans-serif', margin: '1rem' }}>
      <h3>WebRTC DataChannel (UDP‐like)</h3>

      <button
        onClick={sendMessage}
        disabled={!(dcRef.current && dcRef.current.readyState === 'open')}
      >
        Wyślij wiadomość
      </button>

      <ul style={{ marginTop: '1rem' }}>
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  );
};

export default WebRTCDataChannel;
