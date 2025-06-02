namespace OutlookAddIn.WebAPI.Services
{
    public interface IFileReader
    {
        string ReadFile(int id);
    }

    public class FileReader : IFileReader
    {
        public string ReadFile(int id)
        {
            var data = DatabaseServiceMock.customFileItems.Where(x => x.Id == id).FirstOrDefault();
            if (data != null) return data.Content;

            string filePath = GetFilePath(id);

            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"Plik nie istnieje: {filePath}");
            }

            // Odczytaj plik jako tablicę bajtów
            byte[] fileBytes = File.ReadAllBytes(filePath);

            // Zakoduj jako base64 (jeśli plik binarny)
            return Convert.ToBase64String(fileBytes);
        }

        private string GetFilePath(int id)
        {
            switch (id)
            {
                case 1: return @"C:\Users\ADMIN\Downloads\Dariusz_Ogorek_2025_january.pdf";
                default: return @"C:\Users\ADMIN\Downloads\Dariusz_Ogorek_2025_january.pdf";
            }
        }
    }
}
