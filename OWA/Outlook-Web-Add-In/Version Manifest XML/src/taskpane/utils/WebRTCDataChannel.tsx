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

  // 1) Initialize PeerConnection and - depending on the role - create DataChannel or handle ondatachannel
  useEffect(() => {
    // a) Create new RTCPeerConnection with STUN (Google STUN)
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // b) If it's us (the offerer), we immediately create a data channel
    if (isOfferer) {
      const dc = pc.createDataChannel('udp-like-channel');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('DataChannel (offerer) Open');
      };
      dc.onmessage = (e) => {
        setMessages((prev) => [...prev, 'Remote: ' + e.data]);
      };

      // Create SDP offer and send to other party
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          // pc.localDescription will not be null
          if (pc.localDescription) {
            sendSignal(pc.localDescription);
          }
        })
        .catch((err) => console.error('Błąd podczas tworzenia oferty:', err));
    } else {
      // c) If it's not us (the answerer), we're waiting for ondatachannel
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;

        dc.onopen = () => {
          console.log('DataChannel (answerer) Open');
        };
        dc.onmessage = (e) => {
          setMessages((prev) => [...prev, 'Remote: ' + e.data]);
        };
      };
    }

    // d) ICE candidates exchange
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ candidate: event.candidate });
      }
    };

    // e) Cleanup: when unmounting a component we close the peer connection
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      dcRef.current = null;
    };
  }, [isOfferer, sendSignal]);

  // 2)When signal data comes in (SDP or IceCandidate) – handle it
  useEffect(() => {
    if (!incomingSignal || !pcRef.current) {
      return;
    }

    const pc = pcRef.current;

    // a) If SDP (offer/answer) came
    if (incomingSignal.sdp) {
      const desc = new RTCSessionDescription(incomingSignal.sdp);

      pc.setRemoteDescription(desc)
        .then(() => {
          // If this was an offer, then create an answer
          if (desc.type === 'offer') {
            return pc.createAnswer();
          }
          // Otherwise, we return nothing
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
    // b) If IceCandidate came
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
