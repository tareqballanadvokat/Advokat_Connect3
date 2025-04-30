import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { addToAdvocat, searchCases, getRegisteredEmails } from "../helpers/webApiReqests";
 
 
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

        $row.append($("<div style='width:350px'>", {class:"name"}).text(item.name));
        $row.append($("<div>", {class:"causa"}).text(item.causa));

        const $div = $("<div>", {"data-node-id": item.id, class: "button"})
        .html(`<button><img width="16" id="email-search-button" height="16" src="/assets/icon-16.png" alt="Insert" title="Insert"/></button>`)
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

// const getAttachments = async () => {
//     const result = [];
  
//     for (const att of item.attachments) {
//       await new Promise((resolve) => {
//         item.getAttachmentContentAsync(att.id, (res) => {
//           if (res.status === Office.AsyncResultStatus.Succeeded) {
//             result.push({
//               fileName: att.name,
//               contentBase64: res.value.content
//             });
//           }
//           resolve();
//         });
//       });
//     }
  
//     return result;
//   };

export async function AddToAdvocat()
{
    const isEmailChecked = document.getElementById('email-transfer-btn-checkbox').checked;
    const isAttachementChecked = document.getElementById('email-transfer-attachement-btn-checkbox').checked;
    const item = Office.context.mailbox.item;
    const attachmentDict = new Map();
//    item.getAttachmentsAsync\
// const attachemnt =[];
    if (!isComposeMode(item)) 
    {    
        console.log("readmode"); // to teraz wykona się PO zakończeniu    
        var attachements = await getReadModeAttachmentsAsync(item,' _att.id');
    
   
        // if (item.attachments.length > 0) 
        // {
        //     for (var i = 0 ; i < item.attachments.length ; i++) 
        //     {
        //         var _att = item.attachments[i];
        //         const attachemnetContent = await getReadModeAttachmentsAsync(item, _att.id);
        //         attachemnt.push({
        //             fileName: _att.name,
        //             contentBase64: attachemnetContent.content
        //           });
        //     }
        // }        
    } else 
    {
        console.log("compose mode"); // to teraz wykona się PO zakończeniu
        const attachements = await getComposeModeAttachmentsAsync(item);
    }

    try {
      const internetMessageId = await getInternetMessageIdAsync(item);
      const emailContent = await getEmailAsync(item);
       
    //   const attachments = [];
    //   for (const [key, value] of attachmentDict) {
    //     console.log(key, value);
    //     const attachemntModel = {
    //         name: key,           
    //         emailContent: value.content
    //     };
    
    //   }
  

    //      attachments = [
    //     {
    //       fileName: "umowa.pdf",
    //       contentBase64: "JVBERi0xLjcKJc..." // przykładowy base64
    //     },
    //     {
    //       fileName: "plik.txt",
    //       contentBase64: "U29tZSBjb250ZW50IGhlcmU=" // też base64
    //     }
    //   ];

      const model = {
        caseId: $("#email-case-id-input").val(),
        serviceAbbreviationType:  $('#email-abbreviation-select').find(":selected").text(), ///to nie zwraca popwanej wartosci z select'a
        srviceSB:  $("#email-sb-input").val(),
        serviceTime:  $("#email-time-input").val(),
        serviceText:  $("#email-text-input").val(),
        internetMessageId : internetMessageId[1].trim(),
        userId :1,
        emailContent: emailContent,
        attachments : attachements
      };

     
      await addToAdvocat(model);
      await GetEmailsInLast7Days(); // jeśli zwraca Promise – jeśli nie, usuń await
  
    } catch (error) {
      console.error("Błąd:", error);
    }
  
    console.log("email"); // to teraz wykona się PO zakończeniu
}





export function GetEmailsInLast7Days() 
{
   
    getRegisteredEmails()
    .then(data => {
        const $results = $("#email-tab-last-7-days-registered");
        $results.empty();  

        data.forEach(item => {
        const $row = $("<div>", { class: "result-row" });

        $row.append($("<div>", {class:"name"}).text(item.caseId));
        $row.append($("<div>", {class:"causa"}).text(item.internetMessageId));

        const $div = $("<div>", {"data-node-id": item.caseId, class: "button"});

        $row.append($div);
        $results.append($row);
        });
    })
    .catch(err => {
        showError(err, "Search case failed"); 
    });
}
  


function getInternetMessageIdAsync(item) {
    return new Promise((resolve, reject) => {
      item.getAllInternetHeadersAsync((asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
          const headers = asyncResult.value;
          const match = headers.match(/Message-ID: (.+)/i);
          if (match) {
            resolve(match[1].trim());
          } else {
            reject("Brak Message-ID w nagłówkach.");
          }
        } else {
          reject(asyncResult.error.message);
        }
      });
    });
}


function getEmailAsync(item) {
    return new Promise((resolve, reject) => {

       item.getAsFileAsync(  (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
            resolve( asyncResult.value)
          } else {
            reject(asyncResult.error.message);
          }
        });
    });
}

async function  getReadModeAttachmentsAsync(item, attachemntId) {

    //  return new Promise((resolve, reject) => {
        
    
    //     item.getAttachmentContentAsync(attachemntId, (asyncResult) => {
    //      if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
    //          resolve( asyncResult.value)
    //        } else {
    //          reject(asyncResult.error.message);
    //        }
    //      });
   
    //  });

     var result=[];

for (const att of item.attachments) {
      await new Promise((resolve) => {
        item.getAttachmentContentAsync(att.id, (res) => {
          if (res.status === Office.AsyncResultStatus.Succeeded) {
            result.push({
              fileName: att.name,
              contentBase64: res.value.content
            });
          }
          resolve();
        });
      });
    }
    // if (item.attachments.length > 0) 
    //     {
    //         for (var i = 0 ; i < item.attachments.length ; i++) 
    //         {
    //             var _att = item.attachments[i];
           
    //             attachemnt.push({
    //                 fileName: _att.name,
    //                 contentBase64: attachemnetContent.content
    //               });
    //         }
    //     }        
    return result;;
}
 

function getComposeModeAttachmentsAsync(item) 
{
    const options = {asyncContext: {currentItem: item}};
    item.getAttachmentsAsync(options, callback); //in compose mode
 
}




function callback(result) {
    if (result.value.length > 0) {
        for (let i = 0 ; i < result.value.length ; i++) {
            result.asyncContext.currentItem.getAttachmentContentAsync(result.value[i].id, handleAttachmentsCallback);
        }
    }
}

function handleAttachmentsCallback(result) {
    // Parse string to be a url, an .eml file, a base64-encoded string, or an .icalendar file.
    switch (result.value.format) {
        case Office.MailboxEnums.AttachmentContentFormat.Base64:
            // Handle file attachment.
            break;
        case Office.MailboxEnums.AttachmentContentFormat.Eml:
            // Handle email item attachment.
            break;
        case Office.MailboxEnums.AttachmentContentFormat.ICalendar:
            // Handle .icalender attachment.
            break;
        case Office.MailboxEnums.AttachmentContentFormat.Url:
            // Handle cloud attachment.
            break;
        default:
            // Handle attachment formats that are not supported.
    }
}


function isComposeMode(item) {
    return item.itemType === Office.MailboxEnums.ItemType.Message &&
     item.body.getTypeAsync !== undefined;
}