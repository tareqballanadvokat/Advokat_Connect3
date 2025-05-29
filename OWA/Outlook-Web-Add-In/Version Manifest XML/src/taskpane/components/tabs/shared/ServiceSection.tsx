// // // src/taskpane/components/tabs/email/ServiceSection.tsx
// // import React from 'react';

// // export interface ServiceSectionProps {
// //   abbreviation: string;
// //   onAbbreviationChange: (value: string) => void;
// //   time: string;
// //   onTimeChange: (value: string) => void;
// //   text: string;
// //   onTextChange: (value: string) => void;
// //   sb: string
// //   onSbChange: (value: string) => void;
// // }

// // const ServiceSection: React.FC<ServiceSectionProps> = ({
// //   abbreviation,
// //   onAbbreviationChange,
// //   time,
// //   onTimeChange,
// //   text,
// //   onTextChange,
// //   sb,
// //   onSbChange,
// // }) => (

  
// //   <div style={{ marginBottom: 24 }}>
// //     <h3>Services</h3>
// //     <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
// //       <input
// //         type="text"
// //         placeholder="Abbreviation"
// //         value={abbreviation}
// //         onChange={e => onAbbreviationChange(e.target.value)}
// //         style={{
// //           width: 130,
// //           padding: '8px 12px',
// //           fontSize: 14,
// //           border: '1px solid #ccc',
// //           borderRadius: 4,
// //         }}
// //       />
// //       <input
// //         type="text"
// //         placeholder="SB"
// //         value={sb}
// //         onChange={e => onSbChange(e.target.value)}
// //         style={{
// //           width: 25,
// //           padding: '8px 12px',
// //           fontSize: 14,
// //           border: '1px solid #ccc',
// //           borderRadius: 4,
// //           textAlign: 'center',
// //           backgroundColor: '#f4f4f4',
// //         }}
// //       />
// //       <input
// //         type="text"
// //         placeholder="Time"
// //         value={time}
// //         onChange={e => onTimeChange(e.target.value)}
// //         style={{
// //           width: 40,
// //           padding: '8px 12px',
// //           fontSize: 14,
// //           border: '1px solid #ccc',
// //           borderRadius: 4,
// //         }}
// //       />
// //     </div>
// //     <input
// //       type="text"
// //       placeholder="Text"
// //       value={text}
// //       onChange={e => onTextChange(e.target.value)}
// //       style={{
// //         width: 262,
// //         padding: '8px 12px',
// //         fontSize: 14,
// //         border: '1px solid #ccc',
// //         borderRadius: 4,
// //       }}
// //     />
// //   </div>
// // );

// // export default ServiceSection;


// // src/taskpane/components/tabs/email/ServiceSection.tsx
// import React, { useState, useEffect } from 'react';
// import SelectBox from 'devextreme-react/select-box';
// import { getAbbreviationApi, Abbreviation,getSavedEmailInfo } from '../../../utils/api';

// export interface ServiceSectionProps {
//   abbreviation: string;
//   onAbbreviationChange: (value: string) => void;
//   time: string;
//   onTimeChange: (value: string) => void;
//   text: string;
//   onTextChange: (value: string) => void;
//   sb: string;
//   onSbChange: (value: string) => void;
// }

// const ServiceSection: React.FC<ServiceSectionProps> = ({
//   abbreviation,
//   onAbbreviationChange,
//   time,
//   onTimeChange,
//   text,
//   onTextChange,
//   sb,
//   onSbChange,
// }) => {
//   const [options, setOptions] = useState<Abbreviation[]>([]);

//   useEffect(() => {
//     (async () => {
//       try {
//   const data = await getAbbreviationApi(); // Abbreviation[]
//       setOptions(data);

//       const emailInfo = await getSavedEmailInfo("<71M6XT6PQVi3e1nUFNcQow@geopod-ismtpd-7>");
//       if (emailInfo != null) {
//         const abbreviationId = Number(emailInfo.serviceAbbreviationType);

//         // sprawdź, czy ID istnieje w dostępnych opcjach
//         const opt = data.find(x => x.id === abbreviationId);
//         if (opt) {
//           onAbbreviationChange(opt.id.toString()); // ✅ użyj ID zamiast name
//         }

//         onTextChange(emailInfo.serviceText);
//         onTimeChange(emailInfo.serviceTime);
//         onSbChange(emailInfo.serviceSB);
//       }


//       } catch (err) {
//         console.error('Failed to load abbreviations:', err);
//       }
//     })();
//   }, []);
 



//   return (
//     <div style={{ marginBottom: 24 }}>
//       <h3>Services</h3>
//       <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
//         <SelectBox
//           stylingMode="outlined"
//           dataSource={options}
//           value={abbreviation}
//           valueExpr="id"
//           displayExpr="name"
//           placeholder="Abbreviation"
//           onValueChanged={e => onAbbreviationChange(e.value)}
//           width={130}
//         />
//         <input
//           type="text"
//           placeholder="SB"
//           value={sb}
//           onChange={e => onSbChange(e.target.value)}
//           style={{
//             width: 25,
//             padding: '8px 12px',
//             fontSize: 14,
//             border: '1px solid #ccc',
//             borderRadius: 4,
//           }}
//         />
//         <input
//           type="text"
//           placeholder="Time"
//           value={time}
//           onChange={e => onTimeChange(e.target.value)}
//           style={{
//             width: 40,
//             padding: '8px 12px',
//             fontSize: 14,
//             border: '1px solid #ccc',
//             borderRadius: 4,
//           }}
//         />
//       </div>
//       <input
//         type="text"
//         placeholder="Text"
//         value={text}
//         onChange={e => onTextChange(e.target.value)}
//         style={{
//           width: 262,
//           padding: '8px 12px',
//           fontSize: 14,
//           border: '1px solid #ccc',
//           borderRadius: 4,
//         }}
//       />
//     </div>
//   );
// };

// export default ServiceSection;

// src/taskpane/components/tabs/email/ServiceSection.tsx
import React, { useState, useEffect } from 'react';
import SelectBox from 'devextreme-react/select-box';
import { getAbbreviationApi, Abbreviation,getSavedEmailInfo } from '../../../utils/api';

import {getInternetMessageIdAsync} from '../../../hooks/useOfficeItem';

export interface ServiceSectionProps {
  abbreviation: number;
  onAbbreviationChange: (value: number) => void;
  time: string;
  onTimeChange: (value: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  sb: string;
  onSbChange: (value: string) => void;
  oveerideDataOnStartup: boolean;
}

const ServiceSection: React.FC<ServiceSectionProps> = ({
  abbreviation,
  onAbbreviationChange,
  time,
  onTimeChange,
  text,
  onTextChange,
  sb,
  onSbChange,
  oveerideDataOnStartup
}) => {
  const [options, setOptions] = useState<Abbreviation[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAbbreviationApi();  
        setOptions(data);
        if (oveerideDataOnStartup)//not used
        {
          //   const item = Office.context.mailbox.item;
          //   var emailId=await getInternetMessageIdAsync(item);
          //   const emailInfo = await getSavedEmailInfo(emailId);
          //   if (emailInfo != null) 
          //   {
          //     const abbreviationId = Number(emailInfo.serviceAbbreviationType);

          //     // sprawdź, czy ID istnieje w dostępnych opcjach
          //     const opt = data.find(x => x.id === abbreviationId);
          //     if (opt) 
          //     {
          //       onAbbreviationChange(opt.id); // ✅ użyj ID zamiast name
          //     }

          //     onTextChange(emailInfo.serviceText);
          //     onTimeChange(emailInfo.serviceTime);
          //     onSbChange(emailInfo.serviceSB);
          // }
        }

      } catch (err) {
        console.error('Failed to load abbreviations:', err);
      }
    })();
  }, []);
 



  return (
    <div style={{ marginBottom: 24 }}>
      <h3>Services</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <SelectBox
          stylingMode="outlined"
          dataSource={options}
          value={abbreviation}
          valueExpr="id"
          displayExpr="name"
          placeholder="Abbreviation"
          onValueChanged={e => onAbbreviationChange(e.value)}
          width={130}
        />
        <input
          type="text"
          placeholder="SB"
          value={sb}
          onChange={e => onSbChange(e.target.value)}
          style={{
            width: 25,
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        />
        <input
          type="text"
          placeholder="Time"
          value={time}
          onChange={e => onTimeChange(e.target.value)}
          style={{
            width: 40,
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        />
      </div>
      <input
        type="text"
        placeholder="Text"
        value={text}
        onChange={e => onTextChange(e.target.value)}
        style={{
          width: 262,
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
      />
    </div>
  );
};

export default ServiceSection;

