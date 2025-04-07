/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady(async (info) => {
//   var jsonBlob = `{
//   "actions": [
//     {
//       "id": "executeWriteData",
//       "type": "ExecuteFunction",
//       "functionName": "writeData"
//     }
//   ],
//   "tabs": [
//     {
//       "id": "CtxTab1",
//       "label": "Contoso Data",
//       "groups": [
//         {
//           "id": "CustomGroup111",
//           "label": "Insertion",
//           "icon": [
//             {
//                 "size": 16,
//                 "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/Group16x16.png"
//             },
//             {
//                 "size": 32,
//                 "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/Group32x32.png"
//             },
//             {
//                 "size": 80,
//                 "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/Group80x80.png"
//             }
//           ],
//           "controls": [
//             {
//                 "type": "Button",
//                 "id": "CtxBt112",
//                 "actionId": "executeWriteData",
//                 "enabled": false,
//                 "label": "Write Data",
//                 "superTip": {
//                     "title": "Data Insertion",
//                     "description": "Use this button to insert data into the document."
//                 },
//                 "icon": [
//                     {
//                         "size": 16,
//                         "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/WriteDataButton16x16.png"
//                     },
//                     {
//                         "size": 32,
//                         "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/WriteDataButton32x32.png"
//                     },
//                     {
//                         "size": 80,
//                         "sourceLocation": "https://cdn.contoso.com/addins/datainsertion/Images/WriteDataButton80x80.png"
//                     }
//                 ]
//             }
//           ]
//         }
//       ]
//     }
//   ]
// }`

//  debugger;
//   const contextualTabJSON = jsonBlob; // Assign the JSON string such as the one at the end of the preceding section.
//   const contextualTab = JSON.parse(contextualTabJSON);
//   await Office.ribbon.requestCreateControls(contextualTab);
 
  if (info.host === Office.HostType.Outlook) {
 
    // document.getElementById("sideload-msg").style.display = "none";
    // document.getElementById("app-body").style.display = "flex";
    document.getElementById("caseStructureDownloaded").onclick = CaseDownloadStructure;
    document.getElementById("uniqueId").onclick = getUniqueId;
    document.getElementById("uniqueId2").onclick = getUniqueId2;
    document.getElementById("downloadId").onclick = getAsFileAsync;
  }
});
export async function getUniqueId() {
  /**
   * Insert your Outlook code here
   */

  const item = Office.context.mailbox.item;
  debugger;
  console.log("Office.context.mailbox.item.internetMessageId: "+ Office.context.mailbox.item.internetMessageId);
  const options = Office.AsyncContextOptions = { asyncContext: { currentItem: item,  } };
  Office.context.mailbox.item.getItemIdAsync(options, (result) => {
     const emailContent = result.value;
     debugger;
     const element = document.createElement("span");
     element.innerHTML= encodeURIComponent(emailContent);

     document.body.appendChild(element);
 
  });  
   
}
export async function getUniqueId2() {
  /**
   * Insert your Outlook code here
   */

 

  Office.onReady(() => {
    const item = Office.context.mailbox.item;  
    debugger;
    console.log("Office.context.mailbox.item.internetMessageId: "+ Office.context.mailbox.item.internetMessageId);
    item.getAllInternetHeadersAsync((asyncResult) => {
      if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
        const headers = asyncResult.value;
        const internetMessageId = headers.match(/Message-ID: (.+)/i);
  
        if (internetMessageId) {
          console.log("Internet Message ID:", internetMessageId[1].trim());
        } else {
          console.warn("Nie znaleziono Message-ID w nagłówkach.");
        }
      } else {
        console.error("Błąd pobierania nagłówków:", asyncResult.error);
      }
    });
  });
}


export async function getAsFileAsync() {
 
  const item = Office.context.mailbox.addHandlerAsyncitem;
  const options = Office.AsyncContextOptions = { asyncContext: { currentItem: item,  } };
  Office.context.mailbox.item.getAsFileAsync(options, (result) => {
     const emailContent = result.value;
     debugger;
    // const fileName = `${Office.context.mailbox.item.subject}.eml`;
    const fileName = "test.eml";
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(emailContent));
    element.setAttribute("download", `/Users/{user}/Desktop/${fileName}`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  });
}














export async function CaseDownloadStructure() {
// Define the API URL
const apiUrl = 'https://localhost:7231/WeatherForecast';
debugger;

$.ajax({
  type: 'GET',
  url: apiUrl,
  contentType: "application/json",
  //headers: { 'Authorization': 'Bearer ' + accessToken },
  async: false,
  success: function (data) {
     console.log(data);
  },
  error: function (textStatus, errorThrown) {
    console.log(errorThrown);
  }

});

 
}