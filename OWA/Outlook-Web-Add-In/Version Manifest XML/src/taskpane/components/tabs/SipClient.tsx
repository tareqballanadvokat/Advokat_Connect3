 

import { useEffect } from 'react';

	let fromDisplayName = "macc";
	let toDisplayName ="macs";
	// Message handler for incoming WebRTC DataChannel messages
   async function writeMessage(event)
	  {
		const data = event.data;
		var text;
		if (data instanceof ArrayBuffer) {
			text = new TextDecoder("utf-8").decode(data);
			console.log("📨 ArrayBuffer:", text);
		} else if (data instanceof Blob) {
			const reader = new FileReader();
			reader.onload = () => {
				console.log("📨 Blob:", reader.result);
				text = reader.result;
			};
			reader.readAsText(data);
		} else if (typeof data === "string") {
			console.log("📨 Tekst:", data);
			text = data;
		} else {
			console.warn("❓ Unknown message type:", typeof data, data);
		}

		console.log("📨 DataChannel message:", text);
		logger.log(text)
	  }
	  
 

let fromUri = "";
let fromTag = "";

class Helper {
	  log(msg) { 
		console.log(msg);
	  }
	  
	  blobToString(b) {
			var u, x;
			u = URL.createObjectURL(b);
			x = new XMLHttpRequest();
			x.open('GET', u, false); // although sync, you're not fetching over internet
			x.send();
			URL.revokeObjectURL(u);
			return x.responseText;
			
			//  return await blob.text();
		}
		
	contentLength(data){
		const encoder = new TextEncoder();
		return encoder.encode(data).length;
		}

	}
const logger = new Helper();

	  
class Registration 
{
 
	private sipUri ="sip:macc@127.0.0.1:8009";// document.getElementById('sipUri').value.trim();
	private wsUri  ="wss://localhost:8009";// document.getElementById('wsUri').value.trim();
	public tag    = Math.random().toString(36).substr(2, 10);
	public callId = Math.random().toString(36).substr(2, 10);
	private cseq     = 1; 
	public IsRegistrationProcessFinished = false;
	 
  public branch = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
	public fromDisplayName = "macc";
	public toDisplayName ="macs";
	public toLineReplaced ="";
public fromUri ="";
public fromTag ="";


	getInitialRegistration()
	{
		logger.log('🔗 WebSocket connected');
        // Building and sending REGISTER
		const register = 
          'REGISTER ' + this.sipUri + ' SIP/2.0\r\n' +
          'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n'  +
          'Max-Forwards: 70\r\n' +
          'To: "' + this.toDisplayName + '" <sip:macs@127.0.0.1:8009>\r\n' +
          'From: "' + this.fromDisplayName + '" <' + this.sipUri + ';transport=wss>;tag=' + this.tag + '\r\n' +
          'Call-ID: ' + this.callId + '\r\n' +
          'CSeq: ' + this.cseq + ' REGISTER\r\n' +
          'Expires: 300\r\n' +
          'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
          'Supported: path,gruu,outbound\r\n' +
          'User-Agent: JsSIP 3.10.0\r\n' +
		  'Contact: <' + this.sipUri + '>\r\n' + 
          'Content-Length: 0\r\n\r\n';
		return register;
	}
	
	createACK(data)
	{
		 this.getFROMParts(data);
			const ack =
				'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' +  this.branch  + '\r\n' +
				'Max-Forwards: 70\r\n' +
				'To: "' + this.toDisplayName + '" <' + fromUri + '>;tag=' + fromTag + '\r\n' +
				'From: "' + this.fromDisplayName + '" <' + this.sipUri + ';transport=wss>;tag=' + this.tag + '\r\n' +
				'Call-ID: ' + this.callId + '\r\n' +
				'CSeq: 3 ACK\r\n' +  
				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +		   
				'Content-Length: 0\r\n\r\n';
			return ack;
	
	}
	
	// Central message router that analyzes incoming SIP messages and determines the appropriate response.
	parseMessage(data)
	{
		if (/SIP\/2\.0 202/.test(data)) 
		{
			logger.log('✔️ ACK sent ');
			return this.createACK(data);
		}
		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&  /CSeq: 4 NOTIFY/.test(data)) //after register
		{
			return this.createACKAfterNotification(data);
		}		
		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&  /CSeq:\s*1 ACK/.test(data)) 
		{
			return this.createConfimation(data);
		}
		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&  /CSeq: 6 NOTIFY/.test(data)) 
		{
			this.IsRegistrationProcessFinished = true;//(data);
		}
		
		return "";
	}

	
	
	
	
	
	
	createACKAfterNotification(data) 
	{
			const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
			const m = data.match(reCallId);
	 
			const fromLineMatch = data.match(/^From:.*$/m);
			const fromLine = fromLineMatch ? fromLineMatch[0] : '';
			const toLine = fromLine.replace(/^From:/i, 'To:');
			this.toLineReplaced = toLine;
			logger.log('📥 Linia From: ' + fromLine);
 
			const ack2 =
				'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
				'Max-Forwards: 70\r\n' +
				toLine + '\r\n' +
				'From: "' + this.fromDisplayName + '" <' + this.sipUri + '>;tag=' + this.tag + '\r\n' +
				'Call-ID: ' + m[1] + '\r\n' +
				'CSeq: ' + 5 + ' ACK\r\n' +  
				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +		   
				'Content-Length: 0\r\n\r\n';
			return ack2;
	}

	 
	createConfimation(data)	 
	{
		const branchAck = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);

		const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
		const m = data.match(reCallId);
 
		const fromLineMatch = data.match(/^From:.*$/m);
		const fromLine = fromLineMatch ? fromLineMatch[0] : '';
		const toLine = fromLine.replace(/^From:/i, 'To:');
this.toLineReplaced = toLine.toString();
		logger.log('📥 Linia From: ' + fromLine);
		 
 
		const ack2 =
			'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
			'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
			'Max-Forwards: 70\r\n' +
			toLine + '\r\n' +
			'From: "' + this.fromDisplayName + '" <' + this.sipUri + '>;tag=' + this.tag + '\r\n' +
			'Call-ID: ' + m[1] + '\r\n' +
			'CSeq: ' + 5 + ' ACK\r\n' +  
			'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +		   
			'Content-Length: 0\r\n\r\n';
 
		return ack2;
	}
		
			
	getFROMParts(data)
	{
		if (fromTag != "" && fromUri != "") return;
		const line = data;//`From: "macs" <sip:macs@127.0.0.1:443;transport=wss>;tag=OVMXIDKBSG`;

		const re = /^From:\s*(?:"([^"]+)"\s*)?<([^>]+)>;tag=(\S+)/m;
		const m  = re.exec(line);

		if (m) {
		  //fromDisplayName = m[1] || null;           // "macs"
		   fromUri        = m[2];                   // sip:macs@127.0.0.1:443;transport=wss
		   fromTag        = m[3];                   // OVMXIDKBSG

		//  logger.log({ fromDisplayName, fromUri, fromTag });
		} else {
		  console.error("Failed to parse From");
		}
	}
}
 
class EstablishingConnection 
{ 
  
 	public sipUri ="sip:macc@127.0.0.1:8009";// document.getElementById('sipUri').value.trim(); 
  private wsUri  ="";// document.getElementById('wsUri').value.trim();
  public tag    = Math.random().toString(36).substr(2, 10);
	private callId = Math.random().toString(36).substr(2, 10);
	private cseq     = 1; 
	public  IsEstablishingConnectionProcessFinished = false;
	public  ConnectionType = "";
	private branch = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
	private fromDisplayName = "macc";
	private toDisplayName ="macs";
 
	private pc = new RTCPeerConnection();
	private dataChannel = undefined;//this.pc.createDataChannel("answer");  
 
	updateData(tag, callId, branch, fromDisplay, toDisplay){
		this.tag    =tag;  
		this.callId = callId; 		
    this.branch = branch;
    
		this.fromDisplayName = fromDisplay;
		this.toDisplayName =toDisplay;
	}
 
	parseMessage(data)
	{		
		if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) ) 
		{ 
			return this.createACKForIsOffer(data);
		}
		if (/^ACK\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) ) {

			return 	this.craateOffer(data) ;		
		}

		 if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) ) {
			this.IsEstablishingConnectionProcessFinished = true;
		}
		
		return undefined;
	} 
  
	createACKForIsOffer(data) //This is when we initiate SDP offer
	{ 
		var isOffering = this.getIsOFeer(data);
		if (isOffering)
		{
		
		this.ConnectionType = "OFFER";
	this.IsEstablishingConnectionProcessFinished = true;
			const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
			const m = data.match(reCallId);

			const toLineMatchOrigin = data.match(/^To:.*$/m);
			const toLineOrigin = toLineMatchOrigin ? toLineMatchOrigin[0] : '';      
			const fromLineOrigin = toLineOrigin.replace(/^To:/i, 'From:');

			const fromLineMatch = data.match(/^From:.*$/m);
			const fromLine = fromLineMatch ? fromLineMatch[0] : '';
			const toLine = fromLine.replace(/^From:/i, 'To:');
			logger.log('📥 createACKForIsOffer Linia From: ' + fromLine);
		 
			const ackOffering =
				'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
				'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch  + '\r\n' +
				'Max-Forwards: 70\r\n' +
				toLine + '\r\n' +
        fromLineOrigin  + '\r\n' +
			//	'From: "' + this.fromDisplayName + '" <' + this.sipUri + '>;tag=' + this.tag + '\r\n' +
				'Call-ID: ' + m[1] + '\r\n' +
				'CSeq: 2 ACK\r\n' +  
				'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +	
				'Content-Type: application/json\r\n' +		   
				'Content-Length: 19\r\n\r\n'+			
				'{"IsOffering":true}'
			return ackOffering; 
		} 
    return undefined;
	 
	}
	
	craateOffer(data)  
	{
		var isOffering = this.getIsOFeer(data);
		if (isOffering)
		{ 
			this.ConnectionType = "ANSWER";
			const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
			const m = data.match(reCallId); 

			const toLineMatchOrigin = data.match(/^To:.*$/m);
			const toLineOrigin = toLineMatchOrigin ? toLineMatchOrigin[0] : '';      
			const fromLineOrigin = toLineOrigin.replace(/^To:/i, 'From:');


			const fromLineMatch = data.match(/^From:.*$/m);
			const fromLine = fromLineMatch ? fromLineMatch[0] : '';
			const toLine = fromLine.replace(/^From:/i, 'To:');
			logger.log('📥 craateOffer Linia From: ' + fromLine);
		
			const ackOffering =
			'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
			'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch  + '\r\n' +
			'Max-Forwards: 70\r\n' +
			toLine + '\r\n' +
      fromLineOrigin + '\r\n' +
			//'From: "' + this.fromDisplayName + '" <' + this.sipUri + '>;tag=' + this.tag + '\r\n' +
			'Call-ID: ' + m[1] + '\r\n' +
			'CSeq: ' + 3 + ' ACK\r\n' +  
			'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +	
			'Content-Type: application/json\r\n' +		   	   
			'Content-Length: 20\r\n\r\n'+				
			'{"IsOffering":false}'

			return ackOffering; 
		}	
    return undefined;
 
	} 
  getIsOFeer(data)
	{
		  const offeringMatch = /\"IsOffering\"\s*:\s*(true|false)/i.exec(data);
		  if (offeringMatch) {
			const isOffering = offeringMatch[1] === 'true';
			logger.log(`📡 IsOffering: ${isOffering}`);
			return isOffering;
		  }		
      return undefined;
	}
 
} 
  
 class Peer2PeerConnection
 {
	// peer connection that handles media/data exchange
     private pc = new RTCPeerConnection();
	 // The DataChannel for sending messages directly between peers
	private dataChannelPeer = undefined; 
	public isOfferSent =false;
	// constructor(){
	// 	this.pc =new RTCPeerConnection();
	// 	this.dataChannelPeer = undefined; 
	// 	this.isOfferSent =false;
	// }
	//We Create ANSWER
	async parseServiceIncomming(data, socket, sipUri, tag) //FOR CREATING ANSWER
	{
		this.dataChannelPeer = this.pc.createDataChannel("answer"); 
		const fromlinematch = data.match(/^from:.*$/mi);
		const fromline = fromlinematch ? fromlinematch[0] : '';
		const toline = fromline.replace(/^from:/i, 'to:');

		const recallid = /^call-id:\s*([^\r\n]+)/mi;
		const m = data.match(recallid);
		const callId = m ? m[1] : "";

		this.pc.onicecandidate = evt => {
			if (evt.candidate) {
				console.log("ICE candidate:", JSON.stringify(evt.candidate));
				//console.log("ICE candidate:", JSON.stringify(RTCPeerConnection.localDescription));
			}
		};

		this.pc.onicegatheringstatechange = () => {
			if (this.pc.iceGatheringState === 'complete') {
				console.log("ICE gathering complete.");
				console.log("Final SDP:", JSON.stringify(this.pc.localDescription));
				const answerMsg = this.sendSDPAnswer(JSON.stringify(this.pc.localDescription), callId, sipUri, tag, toline);
				// Wyślij przez socket (upewnij się, że socket jest dostępny w tym kontekście)
				if (typeof socket !== 'undefined') {
          
        logger.log('Wysyłanie  class Peer2PeerConnection :\n' + answerMsg); 
					socket.send(answerMsg);
				} else {
					console.warn("⚠️ socket nie jest dostępny w tej klasie");
				}
			}
		};

		// DataChannel events
		this.pc.ondatachannel = (ev) => {
		  console.log("datachannel found");

          ev.channel.onopen = () => {
              console.log("🟢 DataChannel opened: ", ev.channel.label);
          };

		  ev.channel.onmessage = writeMessage

          ev.channel.onclose = () => {
              console.log("🔴 DataChannel closed");
          };

          ev.channel.onerror = err => {
              console.error("❌ DataChannel error:", err);
          };		 
		};

		this.dataChannelPeer = this.pc.createDataChannel("answer");
		this.dataChannelPeer.onopen = () => {
                console.log("🟢 DataChannel opened: answer");
			  };

			  this.dataChannelPeer.onclose = () => {
				console.log("🔴 DataChannel closed");
			  };

			  this.dataChannelPeer.onerror = err => {
				console.error("❌ DataChannel error:", err);
			  };
			 
		// SDP Processing
		const sdpblockmatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
		if (sdpblockmatch) {
			try {
				const sdpblock = sdpblockmatch[1];
				console.log('SDP JSON block:', sdpblock);

				const sdpinit = JSON.parse(sdpblock);
				const desc = new RTCSessionDescription(sdpinit);

				// Ustawienie remoteDescription
				await this.pc.setRemoteDescription(desc);

				// Teraz bezpiecznie tworzysz odpowiedź
				const answer = await this.pc.createAnswer();
				await this.pc.setLocalDescription(answer);

				console.log("✔️ Local SDP Answer set:", JSON.stringify(this.pc.localDescription));
			} catch (err) {
				console.error("❌ Błąd SDP lub WebRTC:", err);
			}
		} else {
			console.warn("⚠️ Nie znaleziono bloku SDP");
		}
	}

	
	
	sendSDPAnswer(answer, callId, sipUri, tag, toLine)
	{
		const branch = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
		
		const lenght = logger.contentLength(answer);
		const sdpAnswer = 
          'SERVICE ' + sipUri + ' SIP/2.0\r\n' +
          'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branch + '\r\n'  +
          'Max-Forwards: 70\r\n' +
		  toLine+ '\r\n' + 
          'From: "' + fromDisplayName + '" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
          'Call-ID: ' + callId + '\r\n' +
          'CSeq: ' + 5 + ' SERVICE\r\n' +
          'Expires: 300\r\n' +
          'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
          'Supported: path,gruu,outbound\r\n' +
          'User-Agent: JsSIP 3.10.0\r\n' +
		  'Content-Type: application/sdp\r\n' +		   
		  'Contact: <' + sipUri + '>\r\n' + 
          'Content-Length: '+lenght+'\r\n\r\n'+
		  ''+answer+'';
		 return sdpAnswer;	
	}
	
 
	//WE CREATE OFFER
	async createAndSendOffer(socket, callId, sipUri, tag, toLine ) //FOR OFFER
	{
		this.isOfferSent =true; 
		const branch = 'z9hG4bK' + Math.random().toString(36).substr(2, 9);
		//this.pc = new RTCPeerConnection();

		// Stworzenie DataChannel
		this.dataChannelPeer = this.pc.createDataChannel("offer");
		this.dataChannelPeer.onopen = () => {
			console.log("🟢 DataChannel OFFER opened");
			this.dataChannelPeer.send("Hello from OFFER side");
		};
		this.dataChannelPeer.onmessage = event => {
			const text = new TextDecoder("utf-8").decode(event.data);
			console.log("📨 Received on offer channel:", text);
		};
		this.dataChannelPeer.onerror = err => {
			console.error("❌ Offer DataChannel error:", err);
		};

			// DataChannel zdarzenia
		this.pc.ondatachannel = (ev) => 
		{
		  console.log("datachannel found");

          ev.channel.onopen = () => {
              console.log("🟢 DataChannel opened: ", ev.channel.label);
          };

		  ev.channel.onmessage = writeMessage

          ev.channel.onclose = () => {
              console.log("🔴 DataChannel closed");
          };

          ev.channel.onerror = err => {
              console.error("❌ DataChannel error:", err);
          };		 
		};

		// Obsługa ICE candidates
		this.pc.onicecandidate = evt => {
			if (evt.candidate) {
				console.log("📤 ICE candidate (offer):", JSON.stringify(evt.candidate));
			}
		};

		this.pc.onicegatheringstatechange = () => {
			if (this.pc.iceGatheringState === 'complete') {
				console.log("✅ ICE gathering complete (offer)");
				const offerSDP = JSON.stringify(this.pc.localDescription);
				const offerMsg = this.sendSDPOffer(offerSDP, callId, sipUri, tag, toLine, branch);
				socket.send(offerMsg);
			}
		};

		// Utwórz i ustaw ofertę
		const offer = await this.pc.createOffer();
		await this.pc.setLocalDescription(offer);

		//const offerMsg = this.sendSDPOffer( JSON.stringify(offer.sdp), callId, sipUri, tag, toLine, branch);
		//socket.send(offerMsg);
		console.log("📤 SDP Offer created:", JSON.stringify(offer));
 
	}

	sendSDPOffer(offerSDP, callId, sipUri, tag, toLine, branch) {
		const lenght = logger.contentLength(offerSDP);
		return (
			'SERVICE ' + sipUri + ' SIP/2.0\r\n' +
			'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branch + '\r\n' +
			'Max-Forwards: 70\r\n' +
			toLine + '\r\n' +
			'From: "' + fromDisplayName + '" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
			'Call-ID: ' + callId + '\r\n' +
			'CSeq: 4 SERVICE\r\n' +
			'Expires: 300\r\n' +
			'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
			'Supported: path,gruu,outbound\r\n' +
			'User-Agent: JsSIP 3.10.0\r\n' +
			'Content-Type: application/sdp\r\n' +
			'Contact: <' + sipUri + '>\r\n' +
			'Content-Length: '+lenght+'\r\n\r\n' +
			 offerSDP 
		);
	}

	async parseIncommingAnswer(data){
		if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)  &&  /CSeq:\s*5 SERVICE/.test(data)) {
			const sdpblockmatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
			if (sdpblockmatch) {
				try 
				{
					const sdpblock = sdpblockmatch[1];
					const sdpObj = JSON.parse(sdpblock);
					await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
					 
							
				}
				catch (err) 
				{
					console.error("❌ Błąd SDP lub WebRTC:", err);
				}
			} else {
				console.warn("⚠️ Nie znaleziono bloku SDP");
			}
		}
	}
	
	getActiveDataChannel(){
		if (this.dataChannelPeer != undefined) return this.dataChannelPeer;
	}
} 
// Main instances
const registrationObj = new Registration();
const establishingConnectionObject = new EstablishingConnection();
const peer2PeerConnectionObject = new Peer2PeerConnection();

/**
 * Główna funkcja inicjalizująca SIP
 * @returns obiekty z których możesz korzystać w innych komponentach
 */
export function initializeSipClient() {
  const sipUri = "sip:macc@127.0.0.1:8009";
  const wsUri = "wss://localhost:8009";
  const tag = Math.random().toString(36).substr(2, 10);
  const callId = Math.random().toString(36).substr(2, 10);
  let cseq = 1;
  fromUri = "";
  fromTag = "";

  const socket = new WebSocket(wsUri, 'sip');

  socket.onopen = () => {
    const registerMsg = registrationObj.getInitialRegistration();
    socket.send(registerMsg);
    logger.log('🔄 sent register');
  };

  socket.onmessage = async event => {
    const data = logger.blobToString(event.data);
    logger.log('📥 Received:\n' + data);

    if (!registrationObj.IsRegistrationProcessFinished) {
      const request = registrationObj.parseMessage(data);
      if (request) socket.send(request);

      if (registrationObj.IsRegistrationProcessFinished) {
        establishingConnectionObject.updateData(
          registrationObj.tag,
          registrationObj.callId,
          registrationObj.branch,
          registrationObj.fromDisplayName,
          registrationObj.toDisplayName
        );
      }
    }

    if (registrationObj.IsRegistrationProcessFinished &&
        !establishingConnectionObject.IsEstablishingConnectionProcessFinished) {

      const request = establishingConnectionObject.parseMessage(data);
      if (request) socket.send(request);

      if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&
          establishingConnectionObject.IsEstablishingConnectionProcessFinished) {

        await peer2PeerConnectionObject.parseServiceIncomming(
          data, socket,
          establishingConnectionObject.sipUri,
          establishingConnectionObject.tag
        );
      }
    }

    if (establishingConnectionObject.ConnectionType === "OFFER" &&
        !peer2PeerConnectionObject.isOfferSent) {

      const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
      const m = data.match(reCallId);
      await peer2PeerConnectionObject.createAndSendOffer(
        socket, m[1],
        establishingConnectionObject.sipUri,
        establishingConnectionObject.tag,
        registrationObj.toLineReplaced
      );
    }

    if (peer2PeerConnectionObject.isOfferSent) {
      await peer2PeerConnectionObject.parseIncommingAnswer(data);
    }
  };

  socket.onerror = err => logger.log('❌ Błąd WebSocket: ' + err);
  socket.onclose = () => logger.log('🔌 Połączenie WebSocket zamknięte');

  return {
    registration: registrationObj,
    connection: establishingConnectionObject,
    peer2peer: peer2PeerConnectionObject,
    socket,
  };
}

export default initializeSipClient;