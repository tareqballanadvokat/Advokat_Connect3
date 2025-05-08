import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { addToAdvocat, getCurrentItem, searchCases, getRegisteredEmails, getStructureApi, getAbbreviationApi } from "../helpers/webApiReqests";
  
export async function initEmail() 
{
    // document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure; 
    // document.getElementById("search-case-id").onclick = CaseSearchStructure;
    
    document.getElementById("email-search-button").onclick = EmailSearchStructure;
    document.getElementById("email-transfer-btn").onclick = SendEmailAndAttachment;
    setOptions();
    
    CalculateEmailInfoAndAttachment();
    GetAbbreviationAsync();
    showSuccess("EmailOpened", "Your Message"); 
    
  //  options =
}

//////
//Onclick events
/////
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

        const $div = $("<div>", {"data-node-id": item.id, "data-node-text":item.name, class: "button"})
        .html(`<button><img width="16" id="email-search-button" height="16" src="/assets/icon-16.png" alt="Insert" title="Insert"/></button>`)
        .on("click", async function () 
            {
            const nodeId = $(this).data("node-text");
            // const nodeId = $(this).data("node-id");
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

export async function SendEmailAndAttachment()
{    
    const isEmailChecked = document.getElementById('email-transfer-btn-checkbox').checked;
    const item = Office.context.mailbox.item;
    var attachements = [];
    var isReadOnlyMode = !isComposeMode(item);
    var emailContent ='';
    var itemId;
    if (item !== undefined)
    {
        if (isReadOnlyMode) 
        {    
            console.log("readmode"); // to teraz wykona się PO zakończeniu    
            attachements = await getReadModeAttachmentsAsync(item,' _att.id');
        } else 
        {
            console.log("compose mode"); // to teraz wykona się PO zakończeniu
            attachements = await getComposeModeAttachmentsAsync(item);
        }

        itemId = await getUniqueEmailItemId(isReadOnlyMode, item);// item.itemId;
        if (isEmailChecked)
        {
            emailContent = await getEmailContentAsync(item);
        }
    }
    try {
      const model = {
        caseId: $("#email-case-id-input").val(),
        serviceAbbreviationType:  $('#email-abbreviation-select').find(":selected").text(), ///to nie zwraca popwanej wartosci z select'a
        srviceSB:  $("#email-sb-input").val(),
        serviceTime:  $("#email-time-input").val(),
        serviceText:  $("#email-text-input").val(),
        internetMessageId :itemId,// internetMessageId[1].trim(),
        userId :1,
        emailName: item.subject,
        emailContent: emailContent,
        attachments : attachements
      };     
      await addToAdvocat(model);
      await GetEmailsInLast7Days(); // jeśli zwraca Promise – jeśli nie, usuń await
  
    } catch (error) 
    {
      console.error("Błąd:", error);
      showError(error);
    }
  
    console.log("email"); // to teraz wykona się PO zakończeniu
}

//WebAPI functions
async function GetFolders()
{

    const options = [
        { value: "", text: "-- wybierz --" }
      ];
 
    await getStructureApi()
    .then(data => {
        data.forEach(item => {
            options.push({value: item.name, text: item.name});
            });
        }) 
    
    .catch(err => {
        showError(err, "Search case failed"); 
    });
    return options;
}
async function CalculateEmailInfoAndAttachment() 
{
    const item = Office.context.mailbox.item;
    await CalculateSubject(item);
    await CalculateAttachments(item);   
    var data = await GetCurrentItemAsync(item) ;
}
 
async function CalculateAttachments(item)
{
    const $results = $("#email-attachment-container-id");
    $results.empty(); 
    var options = await  GetFolders();

    if (isComposeMode(item))
    {

    }
    else
    {
        for (const att of item.attachments) 
        {
            const $row = $("<div>").addClass("email-row");
        
            const checkbox = $("<input>", {
                type: "checkbox",
                class: "email-checkbox email_style",
                value: att.name,
                "data-node-id": att.id
            }).css("width", "15px");
        
            const data = $("<input>")
                .addClass("email_style")
                .val(att.name)
                .css({ width: "140px", "margin-left": "5px" });
        
            const select = $("<select>")
                .addClass("email_style")
                .css({ width: "65px", "margin-left": "5px" });
    
            options.forEach(opt => {
                select.append($("<option>", { value: opt.value, text: opt.text }));
            });
        
            $row.append(checkbox, data, select);
            $results.append($row);
        }
    }
}

function GetEmailsInLast7Days() 
{
    getRegisteredEmails()
    .then(data => {
        const $results = $("#email-tab-last-7-days-registered");
        $results.empty();  

        data.forEach(item => {
        const $row = $("<div>", { class: "result-row" });

        $row.append($("<div>", {class:"name"}).text(item.emailName));
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
  
async function GetAbbreviationAsync() {

    const options = [
        { value: "", text: "-- wybierz --" }
      ];
      await getAbbreviationApi()
        .then(data => {
            data.forEach(item => {
                    options.push({value: item.id, text: item.name});
                });

                const select = $("#email-abbreviation-select");
          
                options.forEach(opt => {
                    select.append($("<option>", { value: opt.value, text: opt.text }));
                });                
            })     
        .catch(err => {
            showError(err, "Search case failed"); 
        });
}
 
async function CalculateSubject(item)
{    
    const $emailText = $("#email-transfer-btn-text");

    if (isComposeMode(item))
    {
        var subjectInComposeMode = await  getEmailSubject(item);
        $emailText.val(subjectInComposeMode);
    }
    else {
        $emailText.val(item.subject);
    }
} 

async function GetCurrentItemAsync(item) 
{
    const id = await getUniqueEmailItemId(false, item);
    await getCurrentItem(id)
        .then(data => {
    
            if (data != null)
            {
                data.attachments.forEach(item => 
                {
                    const nodeId = item.id; // lub inna zmienna z ID
                    const checkbox = $(`input[data-node-id='${nodeId}']`);
                    checkbox.prop("checked", true);    // zaznacza
                    checkbox.prop("disabled", true);   // blokuje kliknięcie
                    checkbox.next().val(item.fileName);
                    debugger;
                });  

                if (data.emailContent != ''){

                    const checkbox = $('#email-transfer-btn-checkbox');
                    checkbox.prop("checked", true);    // zaznacza
                    checkbox.prop("disabled", true);   // blokuje kliknięcie
                }
            }      
        })     
        .catch(err => {
            showError(err, "Search case failed"); 
        });
}
 

//////
//Outlook functions
//////

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
function getEmailSubject(item)
{
    return new Promise((resolve, reject) => {
        Office.context.mailbox.item.subject.getAsync((result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              console.log("Temat wiadomości:", result.value);
              
              resolve( result.value);
            } else {
              console.error("Błąd pobierania tematu:", result.error.message);
              showError(result.error.message);
              reject(result.error.message);
            }
          });
        });
}

function getEmailContentAsync(item) {
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

async function getUniqueEmailItemId(isReadOnlyMode, item){
    const itemId = item.itemId;

    try 
    {        
      const internetMessageId = await getInternetMessageIdAsync(item);
      return internetMessageId;
    } catch (error) 
    {
        return itemId ;
    }    
}


async function  getReadModeAttachmentsAsync(item, attachemntId) {
     var result=[];
     var resultChecked=[];
     $(".email-checkbox:checked").each(function () {
        const id = $(this).data("node-id");
        const value = $(this).val();
        console.log("✅ Zaznaczony załącznik:", value, " | ID:", id);

        resultChecked.push({
                      id:id,
                      name: $(this).next().val(),
                      value:value
                    });
     
      });

        for (const att of resultChecked) {
            await new Promise((resolve) => {
                    item.getAttachmentContentAsync(att.id, (res) => {
                    if (res.status === Office.AsyncResultStatus.Succeeded) {
                        result.push({
                        fileName:att.name,
                        originalFileName : att.value,
                        id : att.id,
                        contentBase64: res.value.content
                        });
                    }
                    resolve();
                    });
                });
            }   
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