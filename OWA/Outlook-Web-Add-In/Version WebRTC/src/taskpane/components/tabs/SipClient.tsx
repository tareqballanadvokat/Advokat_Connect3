// src/components/SipRegister.tsx
import React, { useEffect, useState } from 'react';
import {
  UserAgent,
  Registerer,
  RegistererOptions,
  UserAgentOptions,
 // TransportOptions
} from 'sip.js';
import { TransportOptions } from 'sip.js/lib/platform/web';

interface SipRegisterProps {
  uri: string;          // np. "sip:1001@192.168.0.xxx:5060"
  wsServer: string;     // np. "ws://192.168.0.xxx:8081/ws"
  authorizationUsername: string; // np. "1001"
  authorizationPassword: string; // np. "TwojeHaslo"
}

export default function SipRegister({
  uri,
  wsServer,
  authorizationUsername,
  authorizationPassword
}: SipRegisterProps) {
  const [registered, setRegistered] = useState(false);
  const [ua, setUa] = useState<UserAgent | null>(null);
  const [registerer, setRegisterer] = useState<Registerer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1) Ustawiamy opcje transportu (WebSocket)
    const transportOptions: TransportOptions = {
      server: wsServer
    };

    // 2) Konfiguracja UserAgent (UA)
    const userAgentOptions: UserAgentOptions = {
      uri: UserAgent.makeURI(uri)!,
      transportOptions,
      authorizationUsername,
      authorizationPassword
    };

    const userAgent = new UserAgent(userAgentOptions);
    setUa(userAgent);

    // 3) Tworzymy “registerer” i wysyłamy REGISTER
    const registererOptions: RegistererOptions = {
      // opcje dodatkowe, np. expiring: 600, // żywotność w sekundach
    };
    const reg = new Registerer(userAgent, registererOptions);
    setRegisterer(reg);

    // 4) Włączamy UA i rejestrację
    userAgent
      .start()              // otwiera WebSocket → serwer
      .then(() => reg.register()) // wysyła REGISTER
      .catch(err => {
        console.error('Błąd przy otwieraniu UA lub REGISTER:', err);
        setError(String(err));
      });

    // 5) Słuchamy na zdarzenia rejestracji
    userAgent.delegate = {
      onRegister: () => {
        debugger;
        console.log('REGISTERED ✔️');
        setRegistered(true);
      }//,
    //   onUnRegister: () => {
    //     console.log('UNREGISTERED');
    //     setRegistered(false);
    //   },
    //   onRegistrationFailed: ({ response, error }) => {
    //     const msg = response?.reasonPhrase || error?.message;
    //     console.error('Rejestracja nie powiodła się:', msg);
    //     setError(msg || 'Registration failed');
    //   }
    };

    // 6) Cleanup przy rozmontowaniu komponentu: wyrejestruj i zatrzymaj UA
    return () => {
      reg.unregister().catch(console.error);
      userAgent.stop().catch(console.error);
    };
  }, [uri, wsServer, authorizationUsername, authorizationPassword]);

  return (
    <div>
      <h3>SIP.js REGISTER w React</h3>
      {registered ? (
        <p style={{ color: 'green' }}>✅ Zarejestrowano jako {authorizationUsername}</p>
      ) : error ? (
        <p style={{ color: 'red' }}>❌ Błąd: {error}</p>
      ) : (
        <p>⏳ Rejestracja w toku...</p>
      )}
    </div>
  );
}
