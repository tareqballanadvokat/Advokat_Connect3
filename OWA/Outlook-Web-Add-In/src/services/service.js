/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady((info) => {

  if (info.host === Office.HostType.Outlook) {
 
    document.getElementById("sideload-msg").style.display = "none";
    document.getElementById("app-body").style.display = "flex";
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
  const options = Office.AsyncContextOptions = { asyncContext: { currentItem: item,  } };
  Office.context.mailbox.item.getItemIdAsync(options, (result) => {
     const emailContent = result.value;
     debugger;
     const element = document.createElement("span");
     element.innerHTML= encodeURIComponent(emailContent);

     document.body.appendChild(element);
 
  });  

  Office.onReady(() => {
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
  });
}
export async function getUniqueId2() {
  /**
   * Insert your Outlook code here
   */

 

  Office.onReady(() => {
    const item = Office.context.mailbox.item;
  
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
 
  const item = Office.context.mailbox.item;
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
