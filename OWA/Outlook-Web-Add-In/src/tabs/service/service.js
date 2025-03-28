/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    document.getElementById("sideload-msg").style.display = "none";
    document.getElementById("app-body").style.display = "flex";
    document.getElementById("run").onclick = run;
  }
});

export async function run() {
  /**
   * Insert your Outlook code here
   */

  const item = Office.context.mailbox.item;
  let insertAt = document.getElementById("item-subject");
  let label = document.createElement("b").appendChild(document.createTextNode("Subject: "));
 
  insertAt.appendChild(label);
  insertAt.appendChild(document.createElement("br"));
  insertAt.appendChild(document.createTextNode(item.subject));
  insertAt.appendChild(document.createElement("br"));
  // console.log("Item type:", Office.context.mailbox.item.getAsFileAsync);
 
//   function getAttachmentContentCompose() {
//     const item = Office.context.mailbox.item;
//     const options: Office.AsyncContextOptions = { asyncContext: { currentItem: item } };
//     item.getAttachmentsAsync(options, callback);

//     function callback(result) {
//         if (result.status === Office.AsyncResultStatus.Failed) {
//             console.log(result.error.message);
//             return;
//         }

//         if (result.value.length <= 0) {
//             console.log("Mail item has no attachments.");
//             return;
//         }

//         const currentItem = result.asyncContext.currentItem;
//         for (let i = 0; i < result.value.length; i++) {
//             currentItem.getAttachmentContentAsync(result.value[i].id, (asyncResult) => {
//                 if (asyncResult.status === Office.AsyncResultStatus.Failed) {
//                     console.log(asyncResult.error.message);
//                     return;
//                 }

//                 console.log(asyncResult.value.content);
//             });
//         }
//     }
// }
 
  Office.context.mailbox.item.getAsync(options, (result) => {
     const emailContent = result.value;
     debugger;
    // const fileName = `${Office.context.mailbox.item.subject}.eml`;
    const fileName = "service.eml";
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(emailContent));
    element.setAttribute("download", `/Users/{user}/Desktop/${fileName}`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  });



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


  Office.context.mailbox.item.body.getAsync("text", (result) => {
    const emailContent = result.value;
    const fileName = `${Office.context.mailbox.item.subject}.eml`;
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(emailContent));
    element.setAttribute("download", `/Users/{user}/Desktop/${fileName}`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  });


}
