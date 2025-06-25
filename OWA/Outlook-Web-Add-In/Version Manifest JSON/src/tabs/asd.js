/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */ 
import { showSuccess, showError, setOptions } from "../helpers/toastrHelper";
import { getAbbreviationApi, searchCases, addService, getRegisteredService } from "../helpers/webApiReqests";
 
 ///THIS FILE IS FOR SERVICE FUNCTIONS - REPLACE SERVICE.JS WHEN NEEDED
export function initService() 
{
    document.getElementById("service-search-button").onclick = ServiceSearchStructure;
    document.getElementById("service-transfer-btn").onclick = AddService;

    GetRegisteredLast7Days();
    GetAbbreviationAsync();
    showSuccess("Service Tab Loaded", "Your Message"); 
} 


async function GetAbbreviationAsync() {

  const options = [
      { value: "", text: "-- choose --" }
    ];
    await getAbbreviationApi()
      .then(data => {
          data.forEach(item => {
                  options.push({value: item.id, text: item.name});
              });

              const select = $("#service-abbreviation-select");
        
              options.forEach(opt => {
                  select.append($("<option>", { value: opt.value, text: opt.text }));
              });                
          })     
      .catch(err => {
          showError(err, "Search case failed"); 
      });
}


export async function ServiceSearchStructure()
{
  const initialData =  document.getElementById('service-search-structure-input').value;
 
  searchCases(initialData)
    .then(data => {
        const $results = $("#service-search-results-container");
        $results.empty();  

        data.forEach(item => {
        const $row = $("<div>", { class: "result-row" });

        $row.append($("<div>", {class:"name"}).text(item.name));
        $row.append($("<div>", {class:"causa"}).text(item.causa));

        const $div = $("<div>", {"data-node-id": item.id, "data-node-text": item.name, class: "button"})
        .html(`<button>Add</button>`)
        .on("click", async function () 
            {
              const nodeId = $(this).data("node-text");
              console.log(nodeId);
              $("#service-case-id-input").val(nodeId);
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
 

export async function AddService()
{
    const item = Office.context.mailbox.item;
    var attachements = []; 
    var emailContent ;
    var itemId;
    
    try {
      const model = {
        caseId: $("#service-case-id-input").val(),
        serviceAbbreviationType:  $('#service-abbreviation-select').find(":selected").text(), ///to nie zwraca popwanej wartosci z select'a
        serviceSB:  $("#service-sb-input").val(),
        serviceTime:  $("#service-time-input").val(),
        serviceText:  $("#service-text-input").val(),
        internetMessageId :"itemId",// internetMessageId[1].trim(),
        userId :1
      };     
      await addService(model);
   await GetRegisteredLast7Days(); // jeśli zwraca Promise – jeśli nie, usuń await
  
    } catch (error) 
    {
      console.error("Błąd:", error);
    }
  
    console.log("email"); // to teraz wykona się PO zakończeniu
}




export async function GetRegisteredLast7Days() 
{
   
 await getRegisteredService()
    .then(data => {
        const $results = $("#service-tab-last-7-days-registered");
        $results.empty();  
        if (data != undefined)
        {
          data.forEach(item => {
          const $row = $("<div>", { class: "result-row-registered" });

          $row.append($("<div>", {class:"date"}).text(item.insertDate));
          $row.append($("<div>", {class:"sb"}).text(item.serviceTime));
          $row.append($("<div>", {class:"abbreviation"}).text(item.serviceAbbreviationType));
          $row.append($("<div>", {class:"sb"}).text(item.serviceText)); 
          $results.append($row);
          });
        }
    })
    .catch(err => {
        showError(err, "Search case failed"); 
    });
}
  


function isComposeMode(item) {
  return item.itemType === Office.MailboxEnums.ItemType.Message &&
   item.body.getTypeAsync !== undefined;
}
 