export const AppGlobals = {
  userEmail: null,
  isOfficeReady: false,
  selectedCaseId: null,
  dataChannel:null
};

// const logEl = document.getElementById('log');
// let fromUri = "";
// let fromTag = "";
// let fromDisplayName = "macc";
// let toDisplayName ="macs";
// var pc =new RTCPeerConnection();
//   async function writeMessage(event)
//   {
//        text = await event.data.text();
//        console.log("📨 DataChannel message:", text);
//        log(text)
//   }
//   pc.ondatachannel = (ev) => {
// 	  console.log("datachannel found");
//        ev.channel.onopen = () => {
//            console.log("🟢 DataChannel opened: ", ev.channel.label);
//        };
// 	  ev.channel.onmessage = writeMessage
//        ev.channel.onclose = () => {
//            console.log("🔴 DataChannel closed");
//        };
//        ev.channel.onerror = err => {
//            console.error("❌ DataChannel error:", err);
//        };		 
//   };
// 	var dataChannelAnswer = pc.createDataChannel("answer");
// 		dataChannelAnswer.onopen = () => {
//              console.log("🟢 DataChannel opened: answer");
// 		  };
// 		  dataChannelAnswer.onclose = () => {
// 			console.log("🔴 DataChannel closed");
// 		  };
// 		  dataChannelAnswer.onerror = err => {
// 			console.error("❌ DataChannel error:", err);
// 		  };
// 		 AppGlobals.dataChannel = dataChannelAnswer;
 
 
// function getIsOFeer(data)
// {
// 	  const offeringMatch = /\"IsOffering\"\s*:\s*(true|false)/i.exec(data);
// 	  if (offeringMatch) {
// 		const isOffering = offeringMatch[1] === 'true';
// 		log(`📡 IsOffering: ${isOffering}`);
// 		return isOffering;
// 	  }		
// }

// function sendSDPAnswer(answer, callId, sipUri, tag, toLine)
// {
// 	const branch = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
// 	const sdpAnswer = 
//        'SERVICE ' + sipUri + ' SIP/2.0\r\n' +
//        'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branch + '\r\n'  +
//        'Max-Forwards: 70\r\n' +
// 	  toLine+ '\r\n' + 
//        'From: "' + fromDisplayName + '" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
//        'Call-ID: ' + callId + '\r\n' +
//        'CSeq: ' + 5 + ' SERVICE\r\n' +
//        'Expires: 300\r\n' +
//        'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
//        'Supported: path,gruu,outbound\r\n' +
//        'User-Agent: JsSIP 3.10.0\r\n' +
// 	  'Content-Type: application/sdp\r\n' +		   
// 	  'Contact: <' + sipUri + '>\r\n' + 
//        'Content-Length: 0\r\n\r\n'+
// 	  ''+answer+'';
// 	 return sdpAnswer;	
// }
 

// function blobToString(b) {
// 	var u, x;
// 	u = URL.createObjectURL(b);
// 	x = new XMLHttpRequest();
// 	x.open('GET', u, false); // although sync, you're not fetching over internet
// 	x.send();
// 	URL.revokeObjectURL(u);
// 	return x.responseText;
// }
// function getFROMParts(data)
// {
// 	if (fromTag != "" && fromUri != "") return;
// 	const line = data;//`From: "macs" <sip:macs@127.0.0.1:443;transport=wss>;tag=OVMXIDKBSG`;
// 	const re = /^From:\s*(?:"([^"]+)"\s*)?<([^>]+)>;tag=(\S+)/m;
// 	const m  = re.exec(line);
// 	if (m) {
// 	  //fromDisplayName = m[1] || null;           // "macs"
// 	  fromUri        = m[2];                   // sip:macs@127.0.0.1:443;transport=wss
// 	  fromTag        = m[3];                   // OVMXIDKBSG
// 	  console.log({ fromDisplayName, fromUri, fromTag });
// 	} else {
// 	  console.error("Nie udało się sparsować From");
// 	}
// }
// function log(msg) {
//   const ts = new Date().toLocaleTimeString();

//   console.log(msg);
// }

//     // startBtn.addEventListener('click', () => {
//   function  startBtn()
//   {
//       const sipUri ="sip:macc@127.0.0.1:443"; 
//       const tag    = Math.random().toString(36).substr(2, 10);
//       const callId = Math.random().toString(36).substr(2, 10);
//       let cseq     = 1;
// 		fromUri = "";
// 		fromTag = "";

//       const socket = new WebSocket("wss://localhost:443", 'sip');

//       socket.onopen = () => {
//         log('🔗 Połączono WebSocket');
//         // Budowa i wysłanie REGISTER
//         const branch = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
// 		const register = 
//           'REGISTER ' + sipUri + ' SIP/2.0\r\n' +
//           'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branch + '\r\n'  +
//           'Max-Forwards: 70\r\n' +
//           'To: "' + toDisplayName + '" <sip:macs@127.0.0.1:443>\r\n' +
//           'From: "' + fromDisplayName + '" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
//           'Call-ID: ' + callId + '\r\n' +
//           'CSeq: ' + cseq + ' REGISTER\r\n' +
//           'Expires: 300\r\n' +
//           'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
//           'Supported: path,gruu,outbound\r\n' +
//           'User-Agent: JsSIP 3.10.0\r\n' +
// 		  'Contact: <' + sipUri + '>\r\n' + 
//           'Content-Length: 0\r\n\r\n';
//         socket.send(register);
		
//         log('🔄 Wysłano REGISTER (CSeq=' + cseq + ')');
//       };



//       socket.onmessage = async event => {
// 		const data =   blobToString(event.data);
//         log('📥 Otrzymano:\n' + data); 
		
		
//         // Sprawdź 202 ACCEPTED DLA REGISTER
//         if (/SIP\/2\.0 202/.test(data)) {
//           // Wyślij ACK
//           cseq++;
// 			getFROMParts(data);

//           const branchAck = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);

			
// 			const ack =
// 				'ACK ' + sipUri + ' SIP/2.0\r\n' +
// 				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
// 				'Max-Forwards: 70\r\n' +
// 				'To: "' + toDisplayName + '" <' + fromUri + '>;tag=' + fromTag + '\r\n' +
// 				'From: "' + fromDisplayName + '" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
// 				'Call-ID: ' + callId + '\r\n' +
// 				'CSeq: ' + 3 + ' ACK\r\n' +  
// 				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +		   
// 				'Content-Length: 0\r\n\r\n';
			
//           socket.send(ack);
//           log('✔️ Wysłano ACK (CSeq=' + cseq + ')');

//         //  socket.close();
//           log('🔌 Zamknięto WebSocket');
//         }
		
// 		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&  /CSeq: 4 NOTIFY/.test(data)) //after register
// 		{
// 			const branchAck = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
	
// 			const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
// 			const m = data.match(reCallId);
	 
// 			const fromLineMatch = data.match(/^From:.*$/m);
// 			const fromLine = fromLineMatch ? fromLineMatch[0] : '';
// 			const toLine = fromLine.replace(/^From:/i, 'To:');
// 			log('📥 Linia From: ' + fromLine);
			 
 
// 			const ack2 =
// 				'ACK ' + sipUri + ' SIP/2.0\r\n' +
// 				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
// 				'Max-Forwards: 70\r\n' +
// 				toLine + '\r\n' +
// 				'From: "' + fromDisplayName + '" <' + sipUri + '>;tag=' + tag + '\r\n' +
// 				'Call-ID: ' + m[1] + '\r\n' +
// 				'CSeq: ' + 5 + ' ACK\r\n' +  
// 				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +		   
// 				'Content-Length: 0\r\n\r\n';
//           socket.send(ack2);
// 		}
		
		
// 		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&  /CSeq:\s*1 ACK/.test(data)) 
// 		{
// 			const branchAck = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
	
// 			const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
// 			const m = data.match(reCallId);
	 
// 			const fromLineMatch = data.match(/^From:.*$/m);
// 			const fromLine = fromLineMatch ? fromLineMatch[0] : '';
// 			const toLine = fromLine.replace(/^From:/i, 'To:');
// 			log('📥 Linia From: ' + fromLine);
			 
 
// 			const ack2 =
// 				'ACK ' + sipUri + ' SIP/2.0\r\n' +
// 				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
// 				'Max-Forwards: 70\r\n' +
// 				toLine + '\r\n' +
// 				'From: "' + fromDisplayName + '" <' + sipUri + '>;tag=' + tag + '\r\n' +
// 				'Call-ID: ' + m[1] + '\r\n' +
// 				'CSeq: ' + 5 + ' ACK\r\n' +  
// 				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +		   
// 				'Content-Length: 0\r\n\r\n';
 
// 				socket.send(ack2);
// 		}
		
// 		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) ) 
// 		{
		
// 			const branchAck = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
// 			var isOffering = getIsOFeer(data);
// 			if (isOffering)
// 			{
// 				const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
// 				const m = data.match(reCallId);
// 				const fromLineMatch = data.match(/^From:.*$/m);
// 				const fromLine = fromLineMatch ? fromLineMatch[0] : '';
// 				const toLine = fromLine.replace(/^From:/i, 'To:');
// 				log('📥 Linia From: ' + fromLine);
			 
// 				const ackOffering =
// 				'ACK ' + sipUri + ' SIP/2.0\r\n' +
// 				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
// 				'Max-Forwards: 70\r\n' +
// 				toLine + '\r\n' +
// 				'From: "' + fromDisplayName + '" <' + sipUri + '>;tag=' + tag + '\r\n' +
// 				'Call-ID: ' + m[1] + '\r\n' +
// 				'CSeq: ' + 2 + ' ACK\r\n' +  
// 				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +	
// 'Content-Type: application/json\r\n' +		   
// 				'Content-Length: 0\r\n\r\n'+			
// 				'{"IsOffering":true}'
 
// 				socket.send(ackOffering);
// 			}
		 
// 		}
	
	
// 		if (/^ACK\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) ) 
// 		{
// 			var isOffering = getIsOFeer(data);
// 			if (isOffering)
// 			{ 
// 				const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
// 				const m = data.match(reCallId);
// 				const branchAck = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
// 				const fromLineMatch = data.match(/^From:.*$/m);
// 				const fromLine = fromLineMatch ? fromLineMatch[0] : '';
// 				const toLine = fromLine.replace(/^From:/i, 'To:');
// 				log('📥 Linia From: ' + fromLine);
			 
// 				const ackOffering =
// 				'ACK ' + sipUri + ' SIP/2.0\r\n' +
// 				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
// 				'Max-Forwards: 70\r\n' +
// 				toLine + '\r\n' +
// 				'From: "' + fromDisplayName + '" <' + sipUri + '>;tag=' + tag + '\r\n' +
// 				'Call-ID: ' + m[1] + '\r\n' +
// 				'CSeq: ' + 3 + ' ACK\r\n' +  
// 				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +	
// 'Content-Type: application/json\r\n' +		   	   
// 				'Content-Length: 0\r\n\r\n'+				
// 				'{"IsOffering":false}'
 
// 				socket.send(ackOffering);
// 			}
		 
// 		}
	
	
		
// 		if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) ) 
// 		{
// 			const fromLineMatch = data.match(/^From:.*$/m);
// 			const fromLine = fromLineMatch ? fromLineMatch[0] : '';
// 			const toLine = fromLine.replace(/^From:/i, 'To:');
				 
//             pc.onicecandidate = evt => evt.candidate && console.log(JSON.stringify(evt.candidate));
// 			pc.onclose= () => {
// 			   console.log("pc close");
// 			};
// 			const sdpBlockMatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
// 			if (sdpBlockMatch) 
// 			{
// 				const sdpBlock = sdpBlockMatch[1];
// 				console.log('SDP JSON block:', sdpBlock);
				
// 				const sdpInit = JSON.parse(sdpBlock);
// 				const desc = new RTCSessionDescription(sdpInit);
// 				await pc.setRemoteDescription(desc);
// 			}
			 
// 			const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
// 			const m = data.match(reCallId);
// 			pc.createAnswer()
// 				.then((answer) => pc.setLocalDescription(answer))
// 				.then(() => 
// 				{ 
// 				console.log(JSON.stringify(pc.localDescription));
// 					//socket.send(sendSDPAnswer(JSON.stringify(pc.localDescription), m[1] , sipUri, tag, toLine))
// 				});
// 			 pc.onicegatheringstatechange = () => {
// 			  if (pc.iceGatheringState === 'complete') {
// 				console.log("ICE gathering complete.");
// 				// Teraz localDescription zawiera pełne SDP z ICE candidates
// 				console.log("Final SDP:", JSON.stringify(pc.localDescription));
// 				socket.send(sendSDPAnswer(JSON.stringify(pc.localDescription), m[1], sipUri, tag, toLine));
// 			  }
			  
// 			  pc.getSenders().forEach(sender => {
// 				const transport = sender.transport;
// 				if (transport) {
// 					transport.ondtlsstatechange = () => {
// 						console.log("DTLS state:", transport.dtlsTransport.state);
// 					};
// 				}
// 			});
// 			};
// 		}
//       };

//       socket.onerror = err => log('❌ Błąd WebSocket: ' + err.message);
//       socket.onclose = () => log('🔌 Połączenie WebSocket zamknięte');
//   };
 
// const dcInput = document.getElementById('dcInput');
// const sendDcBtn = document.getElementById('sendDcBtn');

// // Domyślny kanał do wysyłania – ustawiony po stronie offerera
// let activeDataChannel = dataChannelAnswer; // Możesz tu przypisać offer/answer zależnie od roli
// let activeDataChannel2 = dataChannelAnswer; // Możesz tu przypisać offer/answer zależnie od roli


//     startBtn();


