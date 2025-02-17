//using System;
//using System.Security.Cryptography;
//using System.Security.Cryptography.X509Certificates;

//public class CertificateGenerator
//{
//    public static void Main()
//    {
//        string certificatePath = "c:\\cert\\selfsigned.pfx";
//        string certificatePassword = "p@ssw0rd";

//        using (RSA rsa = RSA.Create(2048))
//        {
//            var request = new CertificateRequest(
//                "CN=localhost",
//                rsa,
//                HashAlgorithmName.SHA256,
//                RSASignaturePadding.Pkcs1);

//            // Add extensions to the certificate (optional)
//            request.CertificateExtensions.Add(
//                new X509BasicConstraintsExtension(false, false, 0, false));
//            request.CertificateExtensions.Add(
//                new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, false));
//            request.CertificateExtensions.Add(
//                new X509SubjectKeyIdentifierExtension(request.PublicKey, false));

//            // Create the self-signed certificate
//            var certificate = request.CreateSelfSigned(
//                DateTimeOffset.Now,
//                DateTimeOffset.Now.AddYears(5));

//            // Export the certificate to a PFX file
//            byte[] pfxBytes = certificate.Export(X509ContentType.Pfx, certificatePassword);
//            System.IO.File.WriteAllBytes(certificatePath, pfxBytes);

//            Console.WriteLine($"Self-signed certificate generated and saved to {certificatePath}");
//        }
//    }
//}