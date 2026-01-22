# TURN/STUN Server Deployment - Work Steps

## Overview
Deploy coturn TURN/STUN server on Azure for WebRTC NAT traversal. Server will have public IP accessible to all clients.

---

## Step 1: Azure CLI Setup

**Install Azure CLI:** // DONE
```powershell
# Download and install
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi
Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'

# Verify (reopen PowerShell)
az --version

# Login
az login // DONE
```

---

## Step 2: Create Azure Resources

**Create Resource Group:** // DONE
```powershell
az group create --name rg-turnserver --location westeurope
```//

// Result
{
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver",
  "location": "westeurope",
  "managedBy": null,
  "name": "rg-turnserver",
  "properties": {
    "provisioningState": "Succeeded"
  },
  "tags": null,
  "type": "Microsoft.Resources/resourceGroups"
}

**Create Static Public IP:** // DONE
```powershell
az network public-ip create --resource-group rg-turnserver --name turnserver-public-ip --allocation-method Static --sku Standard --location westeurope


// RESULT
{
  "publicIp": {
    "ddosSettings": {
      "protectionMode": "VirtualNetworkInherited"
    },
    "etag": "W/\"27d423df-6875-4ac7-989c-3ae9dae388ef\"",
    "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Network/publicIPAddresses/turnserver-public-ip",
    "idleTimeoutInMinutes": 4,
    "ipAddress": "108.143.154.176",
    "ipTags": [],
    "location": "westeurope",
    "name": "turnserver-public-ip",
    "provisioningState": "Succeeded",
    "publicIPAddressVersion": "IPv4",
    "publicIPAllocationMethod": "Static",
    "resourceGroup": "rg-turnserver",
    "resourceGuid": "bfd0d600-114c-4780-8b22-e005a472f020",
    "sku": {
      "name": "Standard",
      "tier": "Regional"
    },
    "type": "Microsoft.Network/publicIPAddresses"
  }
}

# Get the IP // DONE
az network public-ip show --resource-group rg-turnserver --name turnserver-public-ip --query ipAddress --output tsv
```

// RESULT 
108.143.154.176

**Create VM:**
```powershell
 az vm create --resource-group rg-turnserver --name turnserver-vm --image Ubuntu2204 --size Standard_D2s_v5 --admin-username azureuser --generate-ssh-keys --public-ip-address turnserver-public-ip --public-ip-sku Standard

```
// RESULT

{
  "fqdns": "",
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Compute/virtualMachines/turnserver-vm",
  "location": "westeurope",
  "macAddress": "7C-ED-8D-98-06-DA",
  "powerState": "VM running",
  "privateIpAddress": "10.0.0.4",
  "publicIpAddress": "108.143.154.176",
  "resourceGroup": "rg-turnserver"
}
---

## Step 3: Configure Firewall (NSG)

**Open TURN/STUN ports:**

```powershell
# Get NSG name
az network nsg list --resource-group rg-turnserver --output table

//RESULT 
Location -> westeurope
Name -> turnserver-vmNSG
ProvisioningState -> Succeeded
ResourceGroup -> rg-turnserver
ResourceGuid -> 5f52d66c-d6e2-4959-ad17-409e95cf884c


# STUN/TURN UDP
az network nsg rule create --resource-group rg-turnserver --nsg-name turnserver-vmNSG --name Allow-STUN-UDP --priority 1100 --direction Inbound --access Allow --protocol Udp --destination-port-ranges 3478

// RESULT
{
  "access": "Allow",
  "destinationAddressPrefix": "*",
  "destinationAddressPrefixes": [],
  "destinationPortRange": "3478",
  "destinationPortRanges": [],
  "direction": "Inbound",
  "etag": "W/\"710f2a5b-b2cf-449b-a2f5-6314aa176a3a\"",
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Network/networkSecurityGroups/turnserver-vmNSG/securityRules/Allow-STUN-UDP",
  "name": "Allow-STUN-UDP",
  "priority": 1100,
  "protocol": "Udp",
  "provisioningState": "Succeeded",
  "resourceGroup": "rg-turnserver",
  "sourceAddressPrefix": "*",
  "sourceAddressPrefixes": [],
  "sourcePortRange": "*",
  "sourcePortRanges": [],
  "type": "Microsoft.Network/networkSecurityGroups/securityRules"
}

# STUN/TURN TCP
az network nsg rule create --resource-group rg-turnserver --nsg-name turnserver-vmNSG --name Allow-STUN-TCP --priority 1101 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 3478

// RESULT
{
  "access": "Allow",
  "destinationAddressPrefix": "*",
  "destinationAddressPrefixes": [],
  "destinationPortRange": "3478",
  "destinationPortRanges": [],
  "direction": "Inbound",
  "etag": "W/\"787fa857-0e4a-4290-bf65-d1ed6c808809\"",
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Network/networkSecurityGroups/turnserver-vmNSG/securityRules/Allow-STUN-TCP",
  "name": "Allow-STUN-TCP",
  "priority": 1101,
  "protocol": "Tcp",
  "provisioningState": "Succeeded",
  "resourceGroup": "rg-turnserver",
  "sourceAddressPrefix": "*",
  "sourceAddressPrefixes": [],
  "sourcePortRange": "*",
  "sourcePortRanges": [],
  "type": "Microsoft.Network/networkSecurityGroups/securityRules"
}

# TURNS UDP
az network nsg rule create --resource-group rg-turnserver --nsg-name turnserver-vmNSG --name Allow-TURNS-UDP --priority 1102 --direction Inbound --access Allow --protocol Udp --destination-port-ranges 5349

{
  "access": "Allow",
  "destinationAddressPrefix": "*",
  "destinationAddressPrefixes": [],
  "destinationPortRange": "5349",
  "destinationPortRanges": [],
  "direction": "Inbound",
  "etag": "W/\"9f225a90-9f40-4098-9ba8-7286ee81214d\"",
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Network/networkSecurityGroups/turnserver-vmNSG/securityRules/Allow-TURNS-UDP",
  "name": "Allow-TURNS-UDP",
  "priority": 1102,
  "protocol": "Udp",
  "provisioningState": "Succeeded",
  "resourceGroup": "rg-turnserver",
  "sourceAddressPrefix": "*",
  "sourceAddressPrefixes": [],
  "sourcePortRange": "*",
  "sourcePortRanges": [],
  "type": "Microsoft.Network/networkSecurityGroups/securityRules"
}

# TURNS TCP
az network nsg rule create --resource-group rg-turnserver --nsg-name turnserver-vmNSG --name Allow-TURNS-TCP --priority 1103 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 5349

// RESULT
{
  "access": "Allow",
  "destinationAddressPrefix": "*",
  "destinationAddressPrefixes": [],
  "destinationPortRange": "5349",
  "destinationPortRanges": [],
  "direction": "Inbound",
  "etag": "W/\"20a14d19-4e3b-4406-b194-d7bcd7330a1e\"",
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Network/networkSecurityGroups/turnserver-vmNSG/securityRules/Allow-TURNS-TCP",
  "name": "Allow-TURNS-TCP",
  "priority": 1103,
  "protocol": "Tcp",
  "provisioningState": "Succeeded",
  "resourceGroup": "rg-turnserver",
  "sourceAddressPrefix": "*",
  "sourceAddressPrefixes": [],
  "sourcePortRange": "*",
  "sourcePortRanges": [],
  "type": "Microsoft.Network/networkSecurityGroups/securityRules"
}

# Relay ports
az network nsg rule create --resource-group rg-turnserver --nsg-name turnserver-vmNSG --name Allow-Relay-Ports --priority 1104 --direction Inbound --access Allow --protocol Udp --destination-port-ranges 49152-65535

//RESULT
{
  "access": "Allow",
  "destinationAddressPrefix": "*",
  "destinationAddressPrefixes": [],
  "destinationPortRange": "49152-65535",
  "destinationPortRanges": [],
  "direction": "Inbound",
  "etag": "W/\"80eea898-dfe9-4f85-9234-082f169cb763\"",
  "id": "/subscriptions/ac4d8f0d-c882-41ad-856a-a22e670d0a97/resourceGroups/rg-turnserver/providers/Microsoft.Network/networkSecurityGroups/turnserver-vmNSG/securityRules/Allow-Relay-Ports",
  "name": "Allow-Relay-Ports",
  "priority": 1104,
  "protocol": "Udp",
  "provisioningState": "Succeeded",
  "resourceGroup": "rg-turnserver",
  "sourceAddressPrefix": "*",
  "sourceAddressPrefixes": [],
  "sourcePortRange": "*",
  "sourcePortRanges": [],
  "type": "Microsoft.Network/networkSecurityGroups/securityRules"
}

```

---

## Step 4: Install Docker on VM

**SSH to VM:**
```powershell
> ssh azureuser@108.143.154.176
The authenticity of host '108.143.154.176 (108.143.154.176)' can't be established.
ED25519 key fingerprint is SHA256:o/Bt5p5KvlsdD5re1Dm8C82VWg04nm6gPQyOPlb7L9s.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? YES
```

**Install Docker:**
```bash
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo systemctl start docker
sudo systemctl enable docker
```

---

## Step 5: Deploy TURN Server

**Create configuration:**
```bash
mkdir -p ~/turnserver
cd ~/turnserver

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM coturn/coturn:latest

COPY turnserver.conf /etc/coturn/turnserver.conf

EXPOSE 3478/tcp 3478/udp
EXPOSE 5349/tcp 5349/udp
EXPOSE 49152-65535/udp

CMD ["turnserver", "-c", "/etc/coturn/turnserver.conf", "--log-file=stdout"]
EOF

# Create turnserver.conf (TURN relay server - optimized for NAT traversal)
cat > turnserver.conf << 'EOF'
# Network Configuration
listening-ip=0.0.0.0
external-ip=108.143.154.176

# Ports
listening-port=3478
tls-listening-port=5349

# Relay port range (for media/data channels)
min-port=49152
max-port=65535

# Authentication (long-term credentials)
lt-cred-mech
user=USERNAME:PASSWORD

# Realm
realm=advokatconnect.com
server-name=advokatconnect.com

# Security
fingerprint
no-cli
no-loopback-peers
no-multicast-peers

# Logging
verbose
log-file=stdout

# TURN Configuration (NOT STUN-only)
# This server will act as TURN relay server
# STUN functionality is included by default in TURN

# Session limits
max-allocate-lifetime=3600
channel-lifetime=600
permission-lifetime=300

# Bandwidth limits (1 Mbps per allocation)
max-bps=1000000
bps-capacity=0

# Allow TURN for all users
no-stun
EOF

# Update with actual IP
PUBLIC_IP=$(curl -s -H Metadata:true "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text")
sed -i "s/REPLACE_WITH_YOUR_IP/$PUBLIC_IP/g" turnserver.conf

# Set credentials (CHANGE THIS PASSWORD!)
sed -i "s/USERNAME:PASSWORD/advokatuser:123456Advokat/g" turnserver.conf

# Verify config
cat turnserver.conf
```

**Build and run:**
```bash
sudo docker build -t turnserver:latest .

sudo docker run -d --name turnserver --restart=always --network host -v ~/turnserver/turnserver.conf:/etc/coturn/turnserver.conf:ro turnserver:latest

// If you want to stop the server first:
sudo docker stop turnserver
sudo docker rm turnserver

# Check logs
sudo docker logs turnserver
```

---

## Step 6: Test TURN Server

**From VM:**
```bash
sudo ss -tulpn | grep 3478
```
// RESULT
udp   UNCONN 0      0            0.0.0.0:3478      0.0.0.0:*    users:(("turnserver",pid=3991,fd=18))
udp   UNCONN 0      0            0.0.0.0:3478      0.0.0.0:*    users:(("turnserver",pid=3991,fd=16))
tcp   LISTEN 0      1024         0.0.0.0:3478      0.0.0.0:*    users:(("turnserver",pid=3991,fd=17))
tcp   LISTEN 0      1024         0.0.0.0:3478      0.0.0.0:*    users:(("turnserver",pid=3991,fd=11))

**Troubleshoot (if Docker logs show errors):**
```bash
# Check detailed logs
sudo docker logs turnserver 2>&1 | grep -i error

# Verify config inside container
sudo docker exec turnserver cat /etc/coturn/turnserver.conf

# Test port binding
sudo netstat -tulpn | grep -E '3478|5349|49152'
```

**From browser:**
1. Go to: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. Remove all default servers
3. Add servers in this order:
   - **Google STUN**: `stun:stun.l.google.com:19302` (no credentials)
   - **Azure TURN**: `turn:108.143.154.176:3478` (Username: `advokatuser`, Password: `123456Advokat`)
4. Click "Gather candidates"
5. **Expected results:**
   - `host` - local interfaces
   - `srflx` - from Google STUN (public IP)
   - `relay` - from Azure TURN (relay through your server)

**If no relay candidates:**
```bash
# SSH to VM and check
sudo docker logs turnserver | tail -50

# Look for authentication errors or allocation failures
# Common issues:
# - Wrong credentials
# - external-ip/relay-ip mismatch
# - Firewall blocking relay ports (49152-65535)
```

---

## Step 7: Update Add-in Configuration

**Edit:** `src/config/defaults.ts`

**IMPORTANT:** Use Google STUN + your TURN server:
```typescript
webrtc: {
  iceServers: [
    // Google STUN for srflx candidates (fast, reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    
    // Your Azure TURN for relay candidates (fallback)
    { 
      urls: 'turn:108.143.154.176:3478',
      username: 'advokatuser',
      credential: '123456Advokat'
    },
  ],
},
```

**Why this configuration:**
- **Google STUN** generates srflx candidates (80-85% of connections use direct P2P)
- **Your Azure TURN** generates relay candidates (15-20% fallback when P2P fails)
- This minimizes bandwidth costs (relay only used when necessary)
- **CRITICAL:** Never add `stun:108.143.154.176:3478` to your app - use Google STUN for that
- Your server is dedicated to TURN relay only, not for STUN discovery
- TURN servers can handle STUN requests, but using Google is more efficient

**DO NOT add your Azure server as STUN in the app** - it will work but wastes your bandwidth.

---

## Step 8: SSL/TLS Setup (Optional - Production)

**Requirements:**
- Domain name pointed to Azure IP

**Install Certbot:**
```bash
sudo apt install -y certbot

# Temporarily open port 80
# (Run from local PowerShell)
az network nsg rule create \
  --resource-group rg-turnserver \
  --nsg-name turnserver-vmNSG \
  --name Allow-HTTP-80 \
  --priority 1005 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 80

# Get certificate (on VM)
sudo docker stop turnserver
sudo certbot certonly --standalone -d turn.yourdomain.com
sudo docker start turnserver

# Copy certs
sudo mkdir -p ~/turnserver/certs
sudo cp /etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem ~/turnserver/certs/cert.pem
sudo cp /etc/letsencrypt/live/turn.yourdomain.com/privkey.pem ~/turnserver/certs/privkey.pem
sudo chmod 644 ~/turnserver/certs/cert.pem
sudo chmod 600 ~/turnserver/certs/privkey.pem

# Add to turnserver.conf
echo "cert=/etc/coturn/certs/cert.pem" | sudo tee -a ~/turnserver/turnserver.conf
echo "pkey=/etc/coturn/certs/privkey.pem" | sudo tee -a ~/turnserver/turnserver.conf

# Restart with certs
sudo docker stop turnserver
sudo docker rm turnserver
sudo docker run -d \
  --name turnserver \
  --restart=always \
  --network host \
  -v ~/turnserver/turnserver.conf:/etc/coturn/turnserver.conf:ro \
  -v ~/turnserver/certs:/etc/coturn/certs:ro \
  turnserver:latest

# Close port 80
az network nsg rule delete \
  --resource-group rg-turnserver \
  --nsg-name turnserver-vmNSG \
  --name Allow-HTTP-80
```

**Auto-renewal:**
```bash
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet --post-hook "docker restart turnserver"
```

---

## Management Commands

**View logs:**
```bash
sudo docker logs -f turnserver
```

**Restart server:**
```bash
sudo docker restart turnserver
```

**Update config:**
```bash
nano ~/turnserver/turnserver.conf
sudo docker restart turnserver
```

**Monitor costs:**
```powershell
az consumption usage list --resource-group rg-turnserver --output table
```

**Cleanup (delete all):**
```powershell
az group delete --name rg-turnserver --yes
```

---

## Cost Estimate
Quick Restart After VM Shutdown

**When VM is stopped (after laptop shutdown):**
```powershell
# From local PowerShell
az vm start --resource-group rg-turnserver --name turnserver-vm

# Wait 1-2 minutes, then test
Test-NetConnection 108.143.154.176 -Port 3478
```

Docker container auto-starts (because of `--restart=always` flag).

---

## Notes

- **Azure IP:** 108.143.154.176
- **Username:** advokatuser
- **Password:** 123456Advokat (CHANGE THIS!)
- **Domain (if SSL):** N/A (optional for production)
- **Deployment date:** January 20, 2026
- **Server role:** TURN relay server (STUN disabled, using Google STUN instead)

## Notes

- Azure IP saved: ________________
- Username: ________________
- Password: ________________
- Domain (if SSL): ________________
- Deployment date: ________________
