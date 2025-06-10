
$password=$args[0]

$certname = "127.0.0.1"

$cert = New-SelfSignedCertificate -Subject "CN=$certname" -CertStoreLocation "Cert:\CurrentUser\My" -KeyExportPolicy Exportable -KeySpec Signature -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256 -KeyFriendlyName "WebRTCLocalhost test" -DnsName "localhost", "127.0.0.1"

$mypwd = ConvertTo-SecureString -String $password -Force -AsPlainText
$currentDirectory = Get-Location

$fullFilePath = ($currentDirectory + "\" +$certname + ".pfx")

Export-PfxCertificate -Cert $cert -FilePath $fullFilePath -Password $mypwd