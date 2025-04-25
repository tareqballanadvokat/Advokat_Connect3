import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { addToAdvocat, searchCases } from "../helpers/webApiReqests";
 
 
export function initEmail() 
{
    // document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure; 
    // document.getElementById("search-case-id").onclick = CaseSearchStructure;
    
    document.getElementById("email-search-button").onclick = EmailSearchStructure;
    document.getElementById("email-transfer-btn").onclick = AddToAdvocat;
    setOptions();
    showSuccess("EmailOpened", "Your Message"); 
}


export async function EmailSearchStructure()
{
  const initialData =  document.getElementById('email-search-structure-input').value;
 
  searchCases(initialData)
  .then(data => {
    const $results = $("#email-search-results-container");
    $results.empty();  

    data.forEach(item => {
      const $row = $("<div>", { class: "result-row" });

      $row.append($("<div>", {class:"name"}).text(item.name));
      $row.append($("<div>", {class:"causa"}).text(item.causa));

      const $div = $("<div>", {"data-node-id": item.id, class: "button"})
      .html(`<button>--></button>`)
      .on("click", async function () 
         {
          const nodeId = $(this).data("node-id");
          console.log(nodeId);
          $("#email-case-id-input").val(nodeId);
          
        //  var dataToLoad = await addCaseToFavorites(nodeId);
        //  initCaseStructure(dataToLoad, true);
         }
      );

      $row.append($div);
      $results.append($row);
    });
  })
  .catch(err => {
    showError(err, "Search case failed"); 
  });
}

export async function AddToAdvocat()
{
    const model = {
        caseId: $("#email-case-id-input").val(),
        serviceAbbreviationType:  $("#email-abbreviation-select").value, ///to nie zwraca popwanej wartosci z select'a
        srviceSB:  $("#email-sb-input").val(),
        serviceTime:  $("#email-time-input").val(),
        serviceText:  $("#email-text-input").val()
      };

    addToAdvocat(model);

    console.log("email");
    debugger;
    const item = Office.context.mailbox.item;
  
    item.getAllInternetHeadersAsync((asyncResult) => {
      if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
        const headers = asyncResult.value;
        const internetMessageId = headers.match(/Message-ID: (.+)/i);
  
        if (internetMessageId) {
          console.log("Internet Message ID:", internetMessageId[1].trim());
        } else {
          console.warn("Missing Message-ID in header.");
        }
      } else {
        console.error("Error:", asyncResult.error);
      }
    }); 
}