namespace WebRTCLibrary.SIP.Utils
{
    public class SIPDialogEventArgs : EventArgs
    {
        public string SourceTag { get; private set; }
        public string RemoteTag { get; private set; }

        public SIPDialogEventArgs(string sourceTag, string remoteTag)
        {
            this.SourceTag = sourceTag;
            this.RemoteTag = remoteTag;
        }
    }
}
