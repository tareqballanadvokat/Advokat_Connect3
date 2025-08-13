export interface AttachmentInfo {
  id: string;
  fileName: string;
  originalFileName:string;
  folder:string;
}

// type OfficeItem = typeof Office.context.mailbox.item;
// export async function calculateAttachments(
//   item: OfficeItem
// ): Promise<AttachmentInfo[]> {
//   // In both read & compose, attachments[] exists on item
//   return (item.attachments || []).map(att => ({
//     id: att.id,
//     name: att.name
//   }));
// }
