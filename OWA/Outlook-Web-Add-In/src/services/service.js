/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */
import { initCase } from "../cases/case.js";
import { initEmail, GetEmailsInLast7Days } from "../email/email.js";
 
Office.onReady(async (info) => { 

  if (info.host === Office.HostType.Outlook) 
  {
      initCase();
      initEmail();
      GetEmailsInLast7Days();
  }
});


 