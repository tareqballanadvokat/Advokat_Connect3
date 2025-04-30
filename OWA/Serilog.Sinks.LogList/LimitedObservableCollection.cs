namespace Serilog.Sinks.LogList
{
    using System.Collections.ObjectModel;
    using System.Collections.Specialized;

    public class LimitedObservableCollection<T> : ObservableCollection<T>
    {
        private int Limit { get; set; }

        public LimitedObservableCollection(int limit)
            : base()
        {
            this.Limit = limit;
        }

        public LimitedObservableCollection(IEnumerable<T> collection, int limit)
            : base(collection)
        {
            this.Limit = limit;
        }

        public LimitedObservableCollection(List<T> list, int limit)
            : base(list)
        {
            this.Limit = limit;
        }

        protected override void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
        {
            if (e.Action == NotifyCollectionChangedAction.Add)
            {
                if (this.Count > this.Limit)
                {
                    base.OnCollectionChanged(e);
                    this.RemoveAt(0);
                    return;
                }
            }

            base.OnCollectionChanged(e);
        }
    }
}
