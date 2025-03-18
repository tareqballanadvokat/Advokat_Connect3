using System;

public enum RTCMethodsEnum
{
    STUN,
    TURN

}
public struct RTCOwnIceServer
{
    public string url;
    public string username;
    public string credential;
    public RTCMethodsEnum type;
    public override string ToString()
    {
        return $"{type} {url} {username} {credential}";
    }
}
