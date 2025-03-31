/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady((info) => {

  if (info.host === Office.HostType.Outlook) {
 
    document.getElementById("sideload-msg").style.display = "none";
    document.getElementById("app-body").style.display = "flex";
    document.getElementById("run2").onclick = run2;
  }
});

export async function run2() {
  /**
   * Insert your Outlook code here
   */

  const item = Office.context.mailbox.item;
 
const options = Office.AsyncContextOptions = { asyncContext: { currentItem: item,  } };
  Office.context.mailbox.item.getItemIdAsync(options, (result) => {
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


  // Office.context.mailbox.item.body.getAsync("text", (result) => {
  //   const emailContent = result.value;
  //   const fileName = `${Office.context.mailbox.item.subject}.eml`;
  //   const element = document.createElement("a");
  //   element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(emailContent));
  //   element.setAttribute("download", `/Users/{user}/Desktop/${fileName}`);
  //   element.style.display = "none";
  //   document.body.appendChild(element);
  //   element.click();
  //   document.body.removeChild(element);
  // });


}
