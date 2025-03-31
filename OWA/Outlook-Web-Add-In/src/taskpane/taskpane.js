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


 
  const options = Office.AsyncContextOptions = { asyncContext: { currentItem: item,  } };
  //message compose ? 
  //Dok: says mailread
  // Office.context.mailbox.item.getItemIdAsync(options, (result) => {
  //   const emailContent = result.value;
  // console.log(emailContent);
  // });

  Office.context.mailbox.item.getAsFileAsync(options, (result) => {
     const emailContent = result.value;
     debugger;
    // const fileName = `${Office.context.mailbox.item.subject}.eml`;
    const fileName = "base64test.eml";
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(emailContent));
    element.setAttribute("download", `/Users/{user}/Desktop/${fileName}`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  });
}
